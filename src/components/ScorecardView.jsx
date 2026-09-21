'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Wand2,
  Save,
  Plus,
  Trash2,
  History,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  LayoutGrid,
  ListChecks,
} from 'lucide-react';
import { Button } from './ui/button';
import { ScorecardPalette } from './scorecard/ScorecardPalette';
import { ScorecardCanvas } from './scorecard/ScorecardCanvas';
import { ScorecardInspector } from './scorecard/ScorecardInspector';
import {
  fetchScorecardRegistry,
  generateScorecard,
  saveScorecard,
  fetchScorecardVersions,
  fetchScorecardVersion,
  deleteScorecardVersions,
} from '../utils/scorecardApi';
import {
  getNodeAtPath,
  deleteAtPath,
  insertAtPath,
  replacePropsAtPath,
  moveNode as moveNodeInTree,
  createNodeFromRegistry,
  findRegistryEntry,
} from '../utils/scorecardTree';
import { extractIndicatorsFromGraph, extractOverallRiskFromIndicators } from '../utils/mcvraToScorecard';

const DEMO_INDICATORS = [
  { id: 'i1', name: 'Flood zone status', pillar: 'Hazard & Exposure', category: 'Topographical', score: 24, scaleMin: 0, scaleMax: 30, unit: '%' },
  { id: 'i2', name: 'Distance to river', pillar: 'Hazard & Exposure', category: 'Topographical', score: 18, scaleMin: 0, scaleMax: 30, unit: '%' },
  { id: 'i3', name: 'Structural integrity', pillar: 'Physical Vulnerability', category: 'Structural', score: 12, scaleMin: 0, scaleMax: 35, unit: '%' },
  { id: 'i4', name: 'WASH access', pillar: 'Physical Vulnerability', category: 'WASH', score: 14, scaleMin: 0, scaleMax: 35, unit: '%' },
];

let indicatorSeq = 5;

const SCORE_MIN = 0;
const SCORE_MAX = 100;

function clampScoreInput(value) {
  if (value === '') return '';
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  return Math.min(SCORE_MAX, Math.max(SCORE_MIN, number));
}

function roundPercentage(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function adjustIndicatorsToOverall(target, currentIndicators) {
  if (!currentIndicators.length) return currentIndicators;

  const rows = currentIndicators.map((indicator) => {
    const scaleMin = Number(indicator.scaleMin);
    const scaleMax = Number(indicator.scaleMax);
    const min = Number.isFinite(scaleMin) ? Math.max(SCORE_MIN, Math.min(SCORE_MAX, scaleMin)) : SCORE_MIN;
    const max = Number.isFinite(scaleMax) ? Math.max(min, Math.min(SCORE_MAX, scaleMax)) : SCORE_MAX;
    const score = Number(indicator.score);
    return {
      indicator,
      min,
      max,
      score: Number.isFinite(score) ? Math.max(min, Math.min(max, score)) : min,
    };
  });

  const minimumTotal = rows.reduce((sum, row) => sum + row.min, 0);
  const maximumTotal = Math.min(SCORE_MAX, rows.reduce((sum, row) => sum + row.max, 0));
  const requestedTotal = Number(target);
  const total = Math.max(minimumTotal, Math.min(maximumTotal, requestedTotal));
  let remaining = total - minimumTotal;
  const allocations = rows.map((row) => row.min);
  const activeRows = rows.map((row, index) => ({ ...row, index })).filter((row) => row.max > row.min);

  while (remaining > 0.0001 && activeRows.length) {
    const weightTotal = activeRows.reduce((sum, row) => sum + Math.max(0, row.score - row.min) || row.max - row.min, 0);
    let allocated = 0;
    activeRows.forEach((row) => {
      const capacity = row.max - allocations[row.index];
      const weight = Math.max(0, row.score - row.min) || row.max - row.min;
      const amount = Math.min(capacity, remaining * (weight / weightTotal));
      allocations[row.index] += amount;
      allocated += amount;
    });
    remaining -= allocated;
    for (let index = activeRows.length - 1; index >= 0; index -= 1) {
      const row = activeRows[index];
      if (row.max - allocations[row.index] <= 0.0001) activeRows.splice(index, 1);
    }
    if (allocated <= 0.0001) break;
  }

  return rows.map((row, index) => ({
    ...row.indicator,
    score: roundPercentage(allocations[index]),
  }));
}

function updateDashboardScores(node, indicators, overallScore, isRoot = true) {
  if (!node) return node;
  const indicatorByName = new Map(indicators.map((indicator) => [indicator.name, Number(indicator.score) || 0]));
  const indicatorRows = new Map(indicators.map((indicator) => [indicator.name, indicator]));
  let props = node.props || {};

  if (node.type === 'KpiCard') {
    const isOverallCard = isRoot || !indicatorByName.has(props.label);
    if (isOverallCard) {
      props = { ...props, value: overallScore, scale: [0, 100] };
    } else if (indicatorByName.has(props.label)) {
      const indicator = indicatorRows.get(props.label);
      props = { ...props, value: indicator.score, scale: [indicator.scaleMin ?? 0, indicator.scaleMax ?? 100] };
    }
  } else if (node.type === 'Chart' && Array.isArray(props.data)) {
    props = {
      ...props,
      data: props.data.map((row) => indicatorByName.has(row.indicator)
        ? { ...row, score: indicatorByName.get(row.indicator) }
        : row),
    };
  } else if (node.type === 'Table' && Array.isArray(props.rows)) {
    props = {
      ...props,
      rows: props.rows.map((row) => {
        const indicator = indicatorRows.get(row[0]);
        return indicator ? row.map((cell, index) => (index === 3 ? indicator.score : index === 4 ? `${indicator.scaleMin ?? 0}-${indicator.scaleMax ?? 100}` : cell)) : row;
      }),
    };
  }

  return {
    ...node,
    props,
    children: Array.isArray(node.children)
      ? node.children.map((child) => updateDashboardScores(child, indicators, overallScore, false))
      : node.children,
  };
}

export function ScorecardView({ mcvraUrl, mcvraOnline, mcvraGraphContext }) {
  const [registry, setRegistry] = useState(null);
  const [leftTab, setLeftTab] = useState('generate'); // 'generate' | 'palette'

  const [assessmentId, setAssessmentId] = useState('demo-assessment');
  const [domain, setDomain] = useState('pokhara.dastaa.org');
  const [userId, setUserId] = useState('user-1');
  const [assessmentName, setAssessmentName] = useState('');
  const [facilityType, setFacilityType] = useState('');
  const [hazardType, setHazardType] = useState('');
  const [overallScore, setOverallScore] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [indicators, setIndicators] = useState([]);
  // 'none' | 'mcvra' | 'demo' | 'manual' - tracks where the current indicator
  // set came from, purely to drive the banner/labels below.
  const [indicatorSource, setIndicatorSource] = useState('none');

  const [document, setDocument] = useState(null);
  const [selectedPath, setSelectedPath] = useState(null);
  const [versions, setVersions] = useState([]);
  const [errors, setErrors] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  useEffect(() => {
    fetchScorecardRegistry(mcvraUrl)
      .then(setRegistry)
      .catch(() => setRegistry(null));
  }, [mcvraUrl]);

  // Pulls indicators (and the assessment context that produced them)
  // straight from the most recently generated MCVRA graph, per the paper's
  // "Extracted Numeric Risk Indicators" handoff step.
  const syncFromMcvraGraph = useCallback(() => {
    if (!mcvraGraphContext) return;
    const derived = extractIndicatorsFromGraph(
      mcvraGraphContext.nodes,
      mcvraGraphContext.edges,
      mcvraGraphContext.rawTreeData
    );
    setIndicators(derived);
    setOverallScore(extractOverallRiskFromIndicators(derived));
    setIndicatorSource('mcvra');
    if (mcvraGraphContext.assessmentId) setAssessmentId(mcvraGraphContext.assessmentId);
    if (mcvraGraphContext.userId) setUserId(mcvraGraphContext.userId);
    if (mcvraGraphContext.domain) setDomain(mcvraGraphContext.domain);
    if (mcvraGraphContext.facilityType) setFacilityType(mcvraGraphContext.facilityType);
    if (mcvraGraphContext.assessmentType) setHazardType(mcvraGraphContext.assessmentType);
    setAssessmentName(
      `${mcvraGraphContext.assessmentType || 'Risk'} Risk (${mcvraGraphContext.facilityType || 'Assessment'})`
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())
    );
  }, [mcvraGraphContext]);

  // Auto-sync graph data by default. Once the user edits an indicator, keep
  // those edits until they explicitly choose Re-sync.
  useEffect(() => {
    if (mcvraGraphContext && indicatorSource !== 'manual') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      syncFromMcvraGraph();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mcvraGraphContext]);

  const loadSampleData = () => {
    setIndicators(DEMO_INDICATORS);
    setIndicatorSource('demo');
    setAssessmentId('demo-assessment');
    setDomain('pokhara.dastaa.org');
    setUserId('user-1');
    setAssessmentName('Flood Risk (Health Facility)');
    setFacilityType('health_facility');
    setHazardType('flood');
    setOverallScore(68);
    setRecommendation('Reinforce drainage near the east wing before monsoon season.');
  };

  const refreshVersions = useCallback(() => {
    if (!assessmentId) return;
    fetchScorecardVersions(mcvraUrl, assessmentId, { domain, userId })
      .then((res) => setVersions(res.versions || []))
      .catch(() => setVersions([]));
  }, [mcvraUrl, assessmentId, domain, userId]);

  useEffect(() => {
    refreshVersions();
  }, [refreshVersions]);

  // ---- indicator form helpers ----
  const applyIndicatorUpdate = (nextIndicators) => {
    const normalizedIndicators = nextIndicators.map((indicator) => ({
      ...indicator,
      weightedScorePercent: Number(indicator.score) || 0,
    }));
    const nextOverallScore = roundPercentage(extractOverallRiskFromIndicators(normalizedIndicators));
    setIndicators(normalizedIndicators);
    setOverallScore(nextOverallScore);
    setDocument((prev) => (prev ? {
      ...prev,
      root: updateDashboardScores(prev.root, normalizedIndicators, nextOverallScore),
    } : prev));
  };

  const addIndicatorRow = () => {
    setIndicatorSource('manual');
    applyIndicatorUpdate([
      ...indicators,
      { id: `i${indicatorSeq++}`, name: 'New indicator', pillar: '', category: '', score: 0, scaleMin: 0, scaleMax: 100, unit: '' },
    ]);
  };
  const removeIndicatorRow = (id) => {
    setIndicatorSource('manual');
    applyIndicatorUpdate(indicators.filter((row) => row.id !== id));
  };
  const updateIndicatorField = (id, field, value) => {
    setIndicatorSource('manual');
    let boundedValue = value;
    if (['score', 'scaleMin', 'scaleMax'].includes(field)) {
      boundedValue = clampScoreInput(value);
    }
    if (field === 'score') {
      const otherScores = indicators
        .filter((row) => row.id !== id)
        .reduce((sum, row) => sum + (Number(row.score) || 0), 0);
      const remainingPercentage = Math.max(0, SCORE_MAX - otherScores);
      const currentRow = indicators.find((row) => row.id === id);
      const scaleMin = Number(currentRow?.scaleMin);
      const scaleMax = Number(currentRow?.scaleMax);
      const rowMax = Number.isFinite(scaleMax) ? Math.min(SCORE_MAX, scaleMax) : SCORE_MAX;
      const rowMin = Number.isFinite(scaleMin) ? Math.min(rowMax, scaleMin) : SCORE_MIN;
      boundedValue = Math.max(rowMin, Math.min(Number(boundedValue) || 0, remainingPercentage, rowMax));
    } else if (field === 'scaleMin') {
      const currentRow = indicators.find((row) => row.id === id);
      const currentScore = Number(currentRow?.score) || 0;
      const scaleMax = Number(currentRow?.scaleMax);
      const rowMax = Number.isFinite(scaleMax) ? scaleMax : SCORE_MAX;
      boundedValue = Math.min(Number(boundedValue) || 0, currentScore, rowMax);
    } else if (field === 'scaleMax') {
      const currentRow = indicators.find((row) => row.id === id);
      const currentScore = Number(currentRow?.score) || 0;
      boundedValue = Math.max(Number(boundedValue) || 0, currentScore);
    }
    applyIndicatorUpdate(indicators.map((row) => (row.id === id ? { ...row, [field]: boundedValue } : row)));
  };

  const updateOverallScore = (value) => {
    const boundedValue = clampScoreInput(value);
    if (boundedValue === '' || !indicators.length) {
      setOverallScore(boundedValue);
      return;
    }
    setIndicatorSource('manual');
    applyIndicatorUpdate(adjustIndicatorsToOverall(boundedValue, indicators));
  };

  // ---- generate ----
  const handleGenerate = async () => {
    setErrors([]);
    setStatusMessage(null);

    const parsedOverallScore = overallScore === '' ? null : Number(overallScore);
    if (parsedOverallScore !== null && (!Number.isFinite(parsedOverallScore) || parsedOverallScore < SCORE_MIN || parsedOverallScore > SCORE_MAX)) {
      setErrors([{ path: 'overall_score', message: 'Overall score must be between 0 and 100%.' }]);
      return;
    }

    const invalidIndicator = indicators.find((row) => {
      const score = Number(row.score);
      const scaleMin = Number(row.scaleMin);
      const scaleMax = Number(row.scaleMax);
      return (
        !row.name?.trim() ||
        !Number.isFinite(score) ||
        score < SCORE_MIN ||
        score > SCORE_MAX ||
        !Number.isFinite(scaleMin) ||
        !Number.isFinite(scaleMax) ||
        scaleMin < SCORE_MIN ||
        scaleMax > SCORE_MAX ||
        scaleMin > scaleMax
      );
    });
    if (invalidIndicator) {
      setErrors([{ path: 'indicators', message: 'Each indicator needs a percentage score from 0 to 100 and a valid percentage range.' }]);
      return;
    }

    setGenerating(true);
    try {
      const payload = {
        assessment_id: assessmentId || null,
        domain,
        user_id: userId,
        assessment_name: assessmentName,
        facility_type: facilityType,
        hazard_type: hazardType,
        overall_score: parsedOverallScore,
        overall_scale: [0, 100],
        recommendation,
        indicators: indicators.map((row) => ({
          name: row.name,
          pillar: row.pillar || null,
          category: row.category || null,
          score: Number(row.score) || 0,
          scale: [Number(row.scaleMin) || 0, Number(row.scaleMax) || 100],
          unit: row.unit || null,
        })),
      };
      const res = await generateScorecard(mcvraUrl, payload);
      setDocument(res.document);
      setWarnings(res.warnings || []);
      setSelectedPath(null);
      setStatusMessage('Scorecard generated successfully.');
    } catch (err) {
      setErrors([{ path: 'generate', message: err?.response?.data?.detail || err.message || 'Generation failed' }]);
    } finally {
      setGenerating(false);
    }
  };

  // ---- tree edit helpers ----
  const mutateRoot = (updater) => {
    setDocument((prev) => (prev ? { ...prev, root: updater(prev.root) } : prev));
  };

  const handleSelect = (path) => setSelectedPath(path);

  const handleDeleteNode = (path) => {
    mutateRoot((root) => deleteAtPath(root, path));
    setSelectedPath(null);
  };

  const handleDropPaletteItem = (containerPath, index, componentType) => {
    const entry = findRegistryEntry(registry, componentType);
    if (!entry) return;
    const newNode = createNodeFromRegistry(componentType, entry);
    mutateRoot((root) => insertAtPath(root, containerPath, index, newNode));
  };

  const handleMoveNode = (fromPath, toContainerPath, toIndex) => {
    mutateRoot((root) => moveNodeInTree(root, fromPath, toContainerPath, toIndex));
    setSelectedPath(null);
  };

  const handleChangeProps = (path, newProps) => {
    mutateRoot((root) => replacePropsAtPath(root, path, newProps));
  };

  // ---- save ----
  const handleSave = async () => {
    if (!document) return;
    setSaving(true);
    setErrors([]);
    setStatusMessage(null);
    try {
      const res = await saveScorecard(mcvraUrl, assessmentId, {
        domain,
        userId,
        document: { title: document.title, root: document.root },
        editMetadata: { edited_via: 'scorecard-editor' },
      });
      if (res.status === 'success') {
        setDocument(res.document);
        setWarnings(res.warnings || []);
        setStatusMessage('Saved as a new reviewed version.');
        refreshVersions();
      } else {
        setErrors(res.errors || [{ path: 'save', message: 'Validation failed' }]);
      }
    } catch (err) {
      setErrors([{ path: 'save', message: err?.response?.data?.detail || err.message || 'Save failed' }]);
    } finally {
      setSaving(false);
    }
  };

  const handleLoadVersion = async (versionId) => {
    try {
      const res = await fetchScorecardVersion(mcvraUrl, assessmentId, versionId, { domain, userId });
      setDocument(res.document);
      setSelectedPath(null);
      setErrors([]);
      setStatusMessage(`Loaded version ${res.document.version} (${res.document.version_type}).`);
    } catch (err) {
      setErrors([{ path: 'load', message: err.message || 'Failed to load version' }]);
    }
  };

  const handleClearVersions = async () => {
    if (!assessmentId || versions.length === 0) return;
    if (!window.confirm(`Delete all ${versions.length} saved versions for this assessment?`)) return;
    try {
      await deleteScorecardVersions(mcvraUrl, assessmentId, { domain, userId });
      setVersions([]);
      setStatusMessage('Saved versions cleared. Current edits remain a preview until you click Save.');
      setErrors([]);
    } catch (err) {
      setErrors([{ path: 'versions', message: err?.response?.data?.detail || err.message || 'Failed to clear versions' }]);
    }
  };

  const selectedNode = document && selectedPath ? getNodeAtPath(document.root, selectedPath) : null;
  const selectedEntry = selectedNode ? findRegistryEntry(registry, selectedNode.type) : null;

  return (
    <div className="scorecard-shell flex h-full w-full overflow-hidden bg-[#f8fafc] text-slate-900">
      {/* Left sidebar */}
      <aside className="scorecard-sidebar scorecard-sidebar-left w-80 shrink-0 border-r border-slate-200 bg-white flex flex-col overflow-hidden">
        <div className="flex border-b border-slate-200">
          <button
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold ${leftTab === 'generate' ? 'text-[#208661] border-b-2 border-[#208661]' : 'text-slate-400'}`}
            onClick={() => setLeftTab('generate')}
          >
            <ListChecks size={13} /> Indicators
          </button>
          <button
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold ${leftTab === 'palette' ? 'text-[#208661] border-b-2 border-[#208661]' : 'text-slate-400'}`}
            onClick={() => setLeftTab('palette')}
          >
            <LayoutGrid size={13} /> Components
          </button>
        </div>

        <div className="scorecard-sidebar-scroll flex-1 overflow-y-auto p-4">
          {leftTab === 'generate' ? (
            <div>
              {mcvraGraphContext ? (
                <div className="mb-4 rounded-lg border border-[#63ab91] bg-[#e9f3f0] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] font-bold text-[#1a6d4f]">
                      {indicatorSource === 'mcvra' ? 'Synced from MCVRA graph' : 'MCVRA graph available'}
                    </div>
                    <button
                      onClick={syncFromMcvraGraph}
                      className="flex items-center gap-1 text-[10px] font-bold text-[#208661] hover:text-[#1a6d4f]"
                    >
                      <RefreshCw size={10} /> Re-sync
                    </button>
                  </div>
                  <p className="text-[10px] text-[#1a6d4f]/80 mt-1 leading-snug">
                    {mcvraGraphContext.nodes?.length || 0} graph nodes from &ldquo;{mcvraGraphContext.assessmentType}&rdquo; /
                    &ldquo;{mcvraGraphContext.facilityType}&rdquo;. Level 1 criteria are shown once and allocated from
                    percentages supplied by the MCVRA graph. Choice scores are provisional until live survey responses are available.
                  </p>
                </div>
              ) : (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-[11px] font-bold text-amber-800">No MCVRA graph loaded</p>
                  <p className="text-[10px] text-amber-700/90 mt-1 leading-snug">
                    Generate a graph in the &ldquo;MCVRA Graph Generator&rdquo; tab first so indicators come from real
                    assessment data, or load sample data to try the editor now.
                  </p>
                  <button
                    onClick={loadSampleData}
                    className="mt-2 text-[10px] font-bold text-amber-800 underline hover:no-underline"
                  >
                    Load sample data
                  </button>
                </div>
              )}

              <div className="space-y-2.5 mb-4">
                <label className="block">
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Assessment name</span>
                  <input className="input-rich" value={assessmentName} onChange={(e) => setAssessmentName(e.target.value)} />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Facility type</span>
                    <input className="input-rich" value={facilityType} onChange={(e) => setFacilityType(e.target.value)} />
                  </label>
                  <label className="block">
                    <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Hazard type</span>
                    <input className="input-rich" value={hazardType} onChange={(e) => setHazardType(e.target.value)} />
                  </label>
                </div>
                <label className="block">
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Overall risk score (%)</span>
                          <input
                    type="number"
                    step="0.1"
                            min={SCORE_MIN}
                            max={SCORE_MAX}
                    className="input-rich"
                    value={overallScore}
                            onChange={(e) => updateOverallScore(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Recommendation</span>
                  <textarea
                    className="input-rich"
                    rows={2}
                    value={recommendation}
                    onChange={(e) => setRecommendation(e.target.value)}
                  />
                </label>
              </div>

              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Risk indicators</span>
                <button onClick={addIndicatorRow} className="text-[#208661] hover:text-[#1a6d4f]" title="Add indicator">
                  <Plus size={14} />
                </button>
              </div>
              <div className="space-y-2 mb-4">
                {indicators.map((row) => (
                  <div key={row.id} className="rounded-lg border border-slate-200 p-2 space-y-1.5 bg-slate-50/60">
                    <div className="flex items-center gap-1.5">
                      <input
                        className="input-rich text-[11px] py-1.5"
                        placeholder="Indicator name"
                        value={row.name}
                        onChange={(e) => updateIndicatorField(row.id, 'name', e.target.value)}
                      />
                      <button onClick={() => removeIndicatorRow(row.id)} className="text-rose-400 hover:text-rose-600 shrink-0">
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <input
                        className="input-rich text-[11px] py-1.5"
                        placeholder="Pillar"
                        value={row.pillar}
                        onChange={(e) => updateIndicatorField(row.id, 'pillar', e.target.value)}
                      />
                      <input
                        className="input-rich text-[11px] py-1.5"
                        placeholder="Category"
                        value={row.category}
                        onChange={(e) => updateIndicatorField(row.id, 'category', e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <label className="block">
                        <span className="block text-[9px] font-semibold text-slate-500 mb-0.5">Weighted risk %</span>
                        <input
                          type="number"
                          step="0.01"
                          min={SCORE_MIN}
                          max={SCORE_MAX}
                          className="input-rich text-[11px] py-1.5"
                          aria-label="Weighted risk percentage"
                          value={row.score}
                          onChange={(e) => updateIndicatorField(row.id, 'score', e.target.value)}
                        />
                      </label>
                      <label className="block">
                        <span className="block text-[9px] font-semibold text-slate-500 mb-0.5">Scale min %</span>
                        <input
                          type="number"
                          step="0.01"
                          min={SCORE_MIN}
                          max={SCORE_MAX}
                          className="input-rich text-[11px] py-1.5"
                          aria-label="Risk scale minimum percentage"
                          value={row.scaleMin}
                          onChange={(e) => updateIndicatorField(row.id, 'scaleMin', e.target.value)}
                        />
                      </label>
                      <label className="block">
                        <span className="block text-[9px] font-semibold text-slate-500 mb-0.5">Scale max %</span>
                        <input
                          type="number"
                          step="0.01"
                          min={SCORE_MIN}
                          max={SCORE_MAX}
                          className="input-rich text-[11px] py-1.5"
                          aria-label="Risk scale maximum percentage"
                          value={row.scaleMax}
                          onChange={(e) => updateIndicatorField(row.id, 'scaleMax', e.target.value)}
                        />
                      </label>
                    </div>
                    <div className="text-[9px] leading-snug text-slate-500">
                      <span className="font-semibold text-slate-600">Risk:</span> {Number(row.rawScorePercent ?? row.score ?? 0).toFixed(2)}%
                      {' | '}
                      <span className="font-semibold text-slate-600">Component:</span> {Number(row.componentPercentage ?? 100).toFixed(2)}%
                      {' | '}
                      <span className="font-semibold text-slate-600">Allocation:</span> 0-{Number(row.scaleMax ?? 100).toFixed(2)}%
                    </div>
                  </div>
                ))}
                {indicators.length === 0 && <p className="text-[11px] text-slate-400">No indicators yet - add one above.</p>}
              </div>

              <Button variant="gradient" size="sm" className="w-full" onClick={handleGenerate} disabled={generating}>
                {generating ? <RefreshCw size={14} className="animate-spin" /> : <Wand2 size={14} />}
                {generating ? 'Generating...' : 'Generate scorecard'}
              </Button>
            </div>
          ) : (
            <ScorecardPalette registry={registry} />
          )}
        </div>
      </aside>

      {/* Center: toolbar + canvas */}
      <main className="scorecard-workspace flex-1 min-w-0 flex flex-col overflow-hidden">
        <div className="scorecard-toolbar border-b border-slate-200 bg-white px-4 py-2.5 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Assessment ID</span>
            <input
              className="input-rich w-40 py-1.5 text-[11px]"
              value={assessmentId}
              onChange={(e) => setAssessmentId(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Domain</span>
            <input className="input-rich w-36 py-1.5 text-[11px]" value={domain} onChange={(e) => setDomain(e.target.value)} />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">User</span>
            <input className="input-rich w-28 py-1.5 text-[11px]" value={userId} onChange={(e) => setUserId(e.target.value)} />
          </div>

          <div className="scorecard-toolbar-spacer flex-1" />

          {document && (
            <span
              className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide ${
                document.version_type === 'reviewed'
                  ? 'bg-[#e9f3f0] text-[#208661] border border-[#63ab91]'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              v{document.version} - {document.version_type}
            </span>
          )}

          {versions.length > 0 && (
            <>
              <select
                className="input-rich w-auto py-1.5 text-[11px]"
                onChange={(e) => e.target.value && handleLoadVersion(Number(e.target.value))}
                value=""
              >
                <option value="">Load version...</option>
                {versions.map((v) => (
                  <option key={v.version_id} value={v.version_id}>
                    v{v.version} ({v.version_type}) - {new Date(v.created_at).toLocaleTimeString()}
                  </option>
                ))}
              </select>
              <Button variant="default" size="sm" onClick={handleClearVersions} title="Delete all saved versions">
                <Trash2 size={14} /> Clear versions
              </Button>
            </>
          )}

          <Button variant="default" size="sm" onClick={handleSave} disabled={Boolean(!document || saving)}>
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>

        {(errors.length > 0 || warnings.length > 0 || statusMessage) && (
          <div className="scorecard-status-panel px-4 py-2 space-y-1 border-b border-slate-200 bg-white">
            {statusMessage && errors.length === 0 && (
              <div className="flex items-center gap-1.5 text-[11px] text-[#208661]">
                <CheckCircle2 size={12} /> {statusMessage}
              </div>
            )}
            {errors.map((e, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[11px] text-rose-600">
                <AlertTriangle size={12} /> <span className="font-mono text-[10px]">{e.path}:</span> {e.message}
              </div>
            ))}
            {warnings.map((w, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[11px] text-amber-600">
                <AlertTriangle size={12} /> {w}
              </div>
            ))}
          </div>
        )}

        <div className="scorecard-canvas-scroll flex-1 overflow-auto">
          {document ? (
            <ScorecardCanvas
              root={document.root}
              selectedPath={selectedPath}
              onSelect={handleSelect}
              onDelete={handleDeleteNode}
              onDropPaletteItem={handleDropPaletteItem}
              onMoveNode={handleMoveNode}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center px-6 text-slate-400">
              <Wand2 size={26} className="mb-2 text-[#208661]" />
              <p className="text-sm font-medium text-slate-500">No scorecard yet</p>
              <p className="text-xs mt-1 max-w-xs">
                Add risk indicators on the left and click &ldquo;Generate scorecard&rdquo; to produce an editable
                dashboard.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Right sidebar: inspector */}
      <aside className="scorecard-sidebar scorecard-sidebar-right w-80 shrink-0 border-l border-slate-200 bg-white overflow-hidden">
        <ScorecardInspector
          key={selectedPath ? `${selectedPath.join('.')}:${JSON.stringify(selectedNode?.props || {})}` : 'none'}
          node={selectedNode}
          path={selectedPath}
          registryEntry={selectedEntry}
          onChangeProps={(newProps) => selectedPath && handleChangeProps(selectedPath, newProps)}
        />
      </aside>
    </div>
  );
}
