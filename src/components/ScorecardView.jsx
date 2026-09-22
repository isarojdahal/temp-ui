'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Wand2,
  Save,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  PanelLeftClose,
  PanelLeftOpen,
  LayoutDashboard,
  Building2,
  ClipboardList,
  SlidersHorizontal,
} from 'lucide-react';
import { Puck } from '@puckeditor/core';
import '@puckeditor/core/dist/index.css';

import { Button } from './ui/button';
import { puckConfig } from './scorecard/puckConfig';
import { treeToPuckData, puckDataToTree, updatePuckDataScores } from '../utils/puckAdapter';
import {
  generateScorecard,
  saveScorecard,
  fetchScorecardVersions,
  fetchScorecardVersion,
  deleteScorecardVersions,
} from '../utils/scorecardApi';
import { DEFAULT_SCORECARD_URL } from '../utils/api';
import { extractIndicatorsFromGraph, extractOverallRiskFromIndicators } from '../utils/mcvraToScorecard';

const DEMO_INDICATORS = [
  { id: 'i1', name: 'Perimeter Inundation', pillar: 'Hazard & Exposure', category: 'Topographical', score: 35, scaleMin: 0, scaleMax: 50, unit: '%' },
  { id: 'i2', name: 'Distance to River', pillar: 'Hazard & Exposure', category: 'Topographical', score: 25, scaleMin: 0, scaleMax: 50, unit: '%' },
  { id: 'i3', name: 'Structural Elevation', pillar: 'Physical Vulnerability', category: 'Structural', score: 28, scaleMin: 0, scaleMax: 50, unit: '%' },
  { id: 'i4', name: 'Emergency Access Route', pillar: 'Physical Vulnerability', category: 'Access', score: 32, scaleMin: 0, scaleMax: 50, unit: '%' },
];

const DEFAULT_SURVEY_ITEMS = [
  { id: 's1', key: 'building_construction', value: 'Reinforced Concrete' },
  { id: 's2', key: 'flood_barrier_present', value: 'No' },
  { id: 's3', key: 'backup_power_elevated', value: 'Yes' },
  { id: 's4', key: 'emergency_water_supply_days', value: '3' },
];

let indicatorSeq = 5;
let surveySeq = 5;

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

export function ScorecardView({ mcvraUrl, mcvraOnline, mcvraGraphContext, scorecardUrl, scorecardOnline }) {
  const activeScorecardUrl = scorecardUrl || DEFAULT_SCORECARD_URL;

  // Sidebar visibility & active tab
  const [indicatorsSidebarOpen, setIndicatorsSidebarOpen] = useState(true);
  const [activeDrawerTab, setActiveDrawerTab] = useState('profile'); // 'profile' | 'scores' | 'survey'

  // Card Profile attributes (Compulsory Payload 1)
  const [assessmentId, setAssessmentId] = useState('demo-assessment');
  const [domain, setDomain] = useState('health_facility');
  const [userId, setUserId] = useState('analyst-1');
  const [assessmentName, setAssessmentName] = useState('Nilgunj Clinic Risk Assessment');
  const [facilityName, setFacilityName] = useState('Nilgunj Primary Health Center');
  const [location, setLocation] = useState('Chitwan District, Ward 4');
  const [facilityType, setFacilityType] = useState('Primary Health Clinic');
  const [hazardType, setHazardType] = useState('Monsoon Riverine Flood');
  const [assessmentDate, setAssessmentDate] = useState('2026-09-22');
  const [layoutSize, setLayoutSize] = useState('a4');
  const [recommendation, setRecommendation] = useState('Reinforce drainage near the east wing and elevate emergency supplies before monsoon peak.');

  // MCVRA Graph & Indicators (Compulsory Payload 2)
  const [overallScore, setOverallScore] = useState(68.5);
  const [indicators, setIndicators] = useState(DEMO_INDICATORS);
  const [indicatorSource, setIndicatorSource] = useState('demo');

  // Survey Column Name & Values (Compulsory Payload 3)
  const [surveyItems, setSurveyItems] = useState(DEFAULT_SURVEY_ITEMS);

  // Puck Data & Backend Document state
  const [document, setDocument] = useState(null);
  const [rootNodeId, setRootNodeId] = useState('root');
  const [puckData, setPuckData] = useState(null);

  // History & versions
  const [versions, setVersions] = useState([]);
  const [errors, setErrors] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  // Pulls indicators and profile from most recently generated MCVRA graph
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
    if (mcvraGraphContext.facilityType) {
      setFacilityType(mcvraGraphContext.facilityType);
      setFacilityName(`${mcvraGraphContext.facilityType.replace(/_/g, ' ')} Unit`.replace(/\b\w/g, (c) => c.toUpperCase()));
    }
    if (mcvraGraphContext.assessmentType) setHazardType(mcvraGraphContext.assessmentType);
    setAssessmentName(
      `${mcvraGraphContext.assessmentType || 'Risk'} Risk (${mcvraGraphContext.facilityType || 'Assessment'})`
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())
    );
  }, [mcvraGraphContext]);

  useEffect(() => {
    if (mcvraGraphContext && indicatorSource !== 'manual') {
      syncFromMcvraGraph();
    }
  }, [mcvraGraphContext, indicatorSource, syncFromMcvraGraph]);

  const loadSampleData = () => {
    setIndicators(DEMO_INDICATORS);
    setIndicatorSource('demo');
    setAssessmentId('demo-assessment');
    setDomain('health_facility');
    setUserId('analyst-1');
    setAssessmentName('Nilgunj Clinic Risk Assessment');
    setFacilityName('Nilgunj Primary Health Center');
    setLocation('Chitwan District, Ward 4');
    setFacilityType('Primary Health Clinic');
    setHazardType('Monsoon Riverine Flood');
    setAssessmentDate('2026-09-22');
    setLayoutSize('a4');
    setOverallScore(68.5);
    setRecommendation('Reinforce drainage near the east wing and elevate emergency supplies before monsoon peak.');
    setSurveyItems(DEFAULT_SURVEY_ITEMS);
  };

  const refreshVersions = useCallback(() => {
    if (!assessmentId) return;
    fetchScorecardVersions(activeScorecardUrl, assessmentId, { domain, userId })
      .then((res) => setVersions(res.versions || []))
      .catch(() => setVersions([]));
  }, [activeScorecardUrl, assessmentId, domain, userId]);

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

    // Live sync into Puck data
    setPuckData((prev) => (prev ? updatePuckDataScores(prev, normalizedIndicators, nextOverallScore) : prev));
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

  // ---- survey attributes helpers ----
  const addSurveyItem = () => {
    setSurveyItems((prev) => [...prev, { id: `s${surveySeq++}`, key: '', value: '' }]);
  };

  const removeSurveyItem = (id) => {
    setSurveyItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateSurveyItem = (id, field, value) => {
    setSurveyItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  // ---- generate scorecard with 3 compulsory payloads ----
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
      // 1. Build survey dictionary (Compulsory Payload 3)
      const surveyColValues = {};
      surveyItems.forEach((item) => {
        const k = item.key?.trim();
        if (k) {
          const v = item.value;
          const num = Number(v);
          surveyColValues[k] = (Number.isFinite(num) && String(v).trim() !== '') ? num : v;
        }
      });

      // 2. Group pillars from indicators (Compulsory Payload 2)
      const pillarMap = {};
      indicators.forEach((ind) => {
        const pName = ind.pillar?.trim() || 'General';
        if (!pillarMap[pName]) {
          pillarMap[pName] = { name: pName, scores: [], scale: [Number(ind.scaleMin) || 0, Number(ind.scaleMax) || 100] };
        }
        pillarMap[pName].scores.push(Number(ind.score) || 0);
      });
      const pillars = Object.values(pillarMap).map((p) => ({
        name: p.name,
        score: p.scores.length ? Math.round((p.scores.reduce((a, b) => a + b, 0) / p.scores.length) * 10) / 10 : 0,
        scale: p.scale,
      }));

      // 3. Assemble full request conforming to GenerateScorecardRequest
      const payload = {
        card_profile_detatils: {
          assessment_id: assessmentId || 'demo-assessment',
          title: assessmentName,
          facility_name: facilityName || assessmentName,
          facility_type: facilityType,
          hazard_type: hazardType,
          location: location,
          domain,
          user_id: userId,
          date: assessmentDate,
          layout_size: layoutSize,
          persist: false,
          bbox: [80.0, 26.0, 88.0, 30.0],
          recommendation,
        },
        mcvra_graph_json_with_scores: {
          overall_score: parsedOverallScore ?? (indicators.length ? roundPercentage(extractOverallRiskFromIndicators(indicators)) : 68.5),
          overall_scale: [0.0, 100.0],
          pillars: pillars.length ? pillars : [
            { name: 'Hazard & Exposure', score: 75.0, scale: [0.0, 100.0] },
            { name: 'Physical Vulnerability', score: 62.0, scale: [0.0, 100.0] },
          ],
          indicators: indicators.map((row) => ({
            name: row.name,
            pillar: row.pillar || 'General',
            category: row.category || 'General',
            score: Number(row.score) || 0,
            scale: [Number(row.scaleMin) || 0, Number(row.scaleMax) || 100],
            unit: row.unit || '%',
            weight: 1.0,
            status: Number(row.score) >= 70 ? 'critical' : Number(row.score) >= 50 ? 'high' : Number(row.score) >= 30 ? 'moderate' : 'low',
            description: row.description || '',
          })),
          ...(mcvraGraphContext?.nodes?.length ? {
            nodes: mcvraGraphContext.nodes,
            edges: mcvraGraphContext.edges || [],
          } : {}),
        },
        survey_col_name_and_values: Object.keys(surveyColValues).length ? surveyColValues : {
          building_construction: 'Reinforced Concrete',
          flood_barrier_present: 'No',
          backup_power_elevated: 'Yes',
          emergency_water_supply_days: 3,
        },
      };

      const res = await generateScorecard(activeScorecardUrl, payload);
      setDocument(res.document);

      // Convert generated backend document tree into Puck editor format
      const { rootId, puckData: generatedPuckData } = treeToPuckData(res.document);
      setRootNodeId(rootId);
      setPuckData(generatedPuckData);

      setWarnings(res.warnings || []);
      setStatusMessage('Scorecard generated with Profile, Scores, and Interpretation sections loaded into Puck Editor.');
    } catch (err) {
      setErrors([{ path: 'generate', message: err?.response?.data?.detail || err.message || 'Generation failed' }]);
    } finally {
      setGenerating(false);
    }
  };

  // ---- save to backend ----
  const handleSave = async () => {
    if (!puckData) return;
    setSaving(true);
    setErrors([]);
    setStatusMessage(null);

    try {
      // Convert Puck Data format back to backend tree format
      const docTree = puckDataToTree(puckData, rootNodeId, assessmentName || document?.title || 'Risk Scorecard');

      const res = await saveScorecard(activeScorecardUrl, assessmentId, {
        domain,
        userId,
        document: { title: docTree.title, root: docTree.root },
        editMetadata: { edited_via: 'puck-editor' },
      });

      if (res.status === 'success') {
        setDocument(res.document);
        const { rootId, puckData: savedPuckData } = treeToPuckData(res.document);
        setRootNodeId(rootId);
        setPuckData(savedPuckData);
        setWarnings(res.warnings || []);
        setStatusMessage('Scorecard saved successfully as a new reviewed version.');
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

  // ---- version loading ----
  const handleLoadVersion = async (versionId) => {
    try {
      const res = await fetchScorecardVersion(activeScorecardUrl, assessmentId, versionId, { domain, userId });
      setDocument(res.document);
      const { rootId, puckData: loadedPuckData } = treeToPuckData(res.document);
      setRootNodeId(rootId);
      setPuckData(loadedPuckData);
      setErrors([]);
      setStatusMessage(`Loaded version ${res.document.version} (${res.document.version_type}) into Puck Editor.`);
    } catch (err) {
      setErrors([{ path: 'load', message: err.message || 'Failed to load version' }]);
    }
  };

  const handleClearVersions = async () => {
    if (!assessmentId || versions.length === 0) return;
    if (!window.confirm(`Delete all ${versions.length} saved versions for this assessment?`)) return;
    try {
      await deleteScorecardVersions(activeScorecardUrl, assessmentId, { domain, userId });
      setVersions([]);
      setStatusMessage('All versions cleared for this assessment.');
    } catch (err) {
      setErrors([{ path: 'clear', message: err.message || 'Failed to clear versions' }]);
    }
  };

  return (
    <div className="scorecard-view-container flex h-full w-full overflow-hidden bg-slate-50 text-slate-900">
      {/* Left drawer: Risk Indicators & Auto-Generation Parameters */}
      <aside
        className={`scorecard-sidebar shrink-0 border-r border-slate-200 bg-white flex flex-col transition-all duration-300 ${indicatorsSidebarOpen ? 'w-84' : 'w-0 overflow-hidden border-none'
          }`}
      >
        {/* Drawer Header */}
        <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2">
            <LayoutDashboard size={16} className="text-[#208661]" />
            <h2 className="text-xs font-bold text-slate-800 tracking-tight">Scorecard Parameters & Generator</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIndicatorsSidebarOpen(false)}
            title="Collapse parameters drawer"
            className="h-7 w-7 text-slate-500 hover:text-slate-800"
          >
            <PanelLeftClose size={15} />
          </Button>
        </div>

        {/* 3-Section Tab Bar matching the 3 compulsory payloads */}
        <div className="flex border-b border-slate-200 bg-slate-50/80 p-1 gap-1 shrink-0">
          <button
            onClick={() => setActiveDrawerTab('profile')}
            className={`flex-1 py-1.5 px-2 text-[10px] font-bold rounded-md flex items-center justify-center gap-1 transition-all ${activeDrawerTab === 'profile'
              ? 'bg-white text-[#208661] shadow-xs border border-slate-200/90'
              : 'text-slate-500 hover:text-slate-800'
              }`}
          >
            <Building2 size={11} /> Profile
          </button>
          <button
            onClick={() => setActiveDrawerTab('scores')}
            className={`flex-1 py-1.5 px-2 text-[10px] font-bold rounded-md flex items-center justify-center gap-1 transition-all ${activeDrawerTab === 'scores'
              ? 'bg-white text-[#208661] shadow-xs border border-slate-200/90'
              : 'text-slate-500 hover:text-slate-800'
              }`}
          >
            <SlidersHorizontal size={11} /> Scores ({indicators.length})
          </button>
          <button
            onClick={() => setActiveDrawerTab('survey')}
            className={`flex-1 py-1.5 px-2 text-[10px] font-bold rounded-md flex items-center justify-center gap-1 transition-all ${activeDrawerTab === 'survey'
              ? 'bg-white text-[#208661] shadow-xs border border-slate-200/90'
              : 'text-slate-500 hover:text-slate-800'
              }`}
          >
            <ClipboardList size={11} /> Survey ({surveyItems.length})
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* TAB 1: CARD PROFILE DETAILS */}
          {activeDrawerTab === 'profile' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Card Profile (Section 1)</span>
                <button
                  onClick={loadSampleData}
                  className="text-[10px] text-[#208661] hover:underline font-semibold"
                >
                  Load Sample
                </button>
              </div>

              <label className="block">
                <span className="block text-[10px] font-semibold text-slate-500 mb-0.5">Facility Name</span>
                <input
                  className="input-rich text-[11px] py-1.5"
                  value={facilityName}
                  onChange={(e) => setFacilityName(e.target.value)}
                  placeholder="e.g. Nilgunj Primary Health Center"
                />
              </label>

              <label className="block">
                <span className="block text-[10px] font-semibold text-slate-500 mb-0.5">Assessment Title</span>
                <input
                  className="input-rich text-[11px] py-1.5"
                  value={assessmentName}
                  onChange={(e) => setAssessmentName(e.target.value)}
                  placeholder="e.g. Flood Vulnerability Assessment"
                />
              </label>

              <label className="block">
                <span className="block text-[10px] font-semibold text-slate-500 mb-0.5">Location / Study Area</span>
                <input
                  className="input-rich text-[11px] py-1.5"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Chitwan District, Ward 4"
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="block text-[10px] font-semibold text-slate-500 mb-0.5">Facility Type</span>
                  <input
                    className="input-rich text-[11px] py-1.5"
                    value={facilityType}
                    onChange={(e) => setFacilityType(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="block text-[10px] font-semibold text-slate-500 mb-0.5">Hazard Assessed</span>
                  <input
                    className="input-rich text-[11px] py-1.5"
                    value={hazardType}
                    onChange={(e) => setHazardType(e.target.value)}
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="block text-[10px] font-semibold text-slate-500 mb-0.5">Assessment Date</span>
                  <input
                    type="date"
                    className="input-rich text-[11px] py-1.5"
                    value={assessmentDate}
                    onChange={(e) => setAssessmentDate(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="block text-[10px] font-semibold text-slate-500 mb-0.5">Page Layout Size</span>
                  <select
                    className="input-rich text-[11px] py-1.5 bg-white"
                    value={layoutSize}
                    onChange={(e) => setLayoutSize(e.target.value)}
                  >
                    <option value="a4">A4 (Standard 210x297)</option>
                    <option value="a3">A3 (Expanded Canvas)</option>
                    <option value="full_width">Full Width Fluid</option>
                  </select>
                </label>
              </div>
            </div>
          )}

          {/* TAB 2: MCVRA GRAPH & RISK SCORES */}
          {activeDrawerTab === 'scores' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Indicators & Pillars (Section 2)</span>
                <div className="flex items-center gap-1.5">
                  {mcvraGraphContext && (
                    <button
                      onClick={syncFromMcvraGraph}
                      className="text-[10px] text-[#208661] hover:underline font-semibold flex items-center gap-1"
                      title="Re-sync indicators from MCVRA Graph"
                    >
                      <RefreshCw size={10} /> Sync MCVRA
                    </button>
                  )}
                  <button
                    onClick={loadSampleData}
                    className="text-[10px] text-slate-500 hover:text-[#208661] font-semibold"
                  >
                    Sample
                  </button>
                </div>
              </div>

              <label className="block">
                <span className="block text-[10px] font-semibold text-slate-500 mb-0.5">Overall Risk Score %</span>
                <input
                  type="number"
                  step="0.01"
                  min={SCORE_MIN}
                  max={SCORE_MAX}
                  className="input-rich text-[11px] py-1.5"
                  value={overallScore}
                  onChange={(e) => updateOverallScore(e.target.value)}
                />
              </label>

              <label className="block">
                <span className="block text-[10px] font-semibold text-slate-500 mb-0.5">Recommendation</span>
                <textarea
                  className="input-rich text-[11px] py-1.5 resize-none"
                  rows={2}
                  value={recommendation}
                  onChange={(e) => setRecommendation(e.target.value)}
                />
              </label>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Risk Indicators</span>
                  <button onClick={addIndicatorRow} className="text-[#208661] hover:text-[#1a6d4f] flex items-center gap-0.5 text-[10px] font-semibold" title="Add indicator">
                    <Plus size={13} /> Add
                  </button>
                </div>

                <div className="space-y-2 max-h-80 overflow-y-auto pr-0.5">
                  {indicators.map((row) => (
                    <div key={row.id} className="rounded-lg border border-slate-200 p-2 space-y-1.5 bg-slate-50/60">
                      <div className="flex items-center gap-1.5">
                        <input
                          className="input-rich text-[11px] py-1"
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
                          className="input-rich text-[11px] py-1"
                          placeholder="Pillar"
                          value={row.pillar}
                          onChange={(e) => updateIndicatorField(row.id, 'pillar', e.target.value)}
                        />
                        <input
                          className="input-rich text-[11px] py-1"
                          placeholder="Category"
                          value={row.category}
                          onChange={(e) => updateIndicatorField(row.id, 'category', e.target.value)}
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        <label className="block">
                          <span className="block text-[9px] font-semibold text-slate-500 mb-0.5">Score %</span>
                          <input
                            type="number"
                            step="0.01"
                            min={SCORE_MIN}
                            max={SCORE_MAX}
                            className="input-rich text-[11px] py-1"
                            value={row.score}
                            onChange={(e) => updateIndicatorField(row.id, 'score', e.target.value)}
                          />
                        </label>
                        <label className="block">
                          <span className="block text-[9px] font-semibold text-slate-500 mb-0.5">Min %</span>
                          <input
                            type="number"
                            step="0.01"
                            min={SCORE_MIN}
                            max={SCORE_MAX}
                            className="input-rich text-[11px] py-1"
                            value={row.scaleMin}
                            onChange={(e) => updateIndicatorField(row.id, 'scaleMin', e.target.value)}
                          />
                        </label>
                        <label className="block">
                          <span className="block text-[9px] font-semibold text-slate-500 mb-0.5">Max %</span>
                          <input
                            type="number"
                            step="0.01"
                            min={SCORE_MIN}
                            max={SCORE_MAX}
                            className="input-rich text-[11px] py-1"
                            value={row.scaleMax}
                            onChange={(e) => updateIndicatorField(row.id, 'scaleMax', e.target.value)}
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                  {indicators.length === 0 && <p className="text-[11px] text-slate-400">No indicators defined.</p>}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: FIELD SURVEY OBSERVATIONS */}
          {activeDrawerTab === 'survey' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Survey Observations (Section 1 & 3)</span>
                <button
                  onClick={() => setSurveyItems(DEFAULT_SURVEY_ITEMS)}
                  className="text-[10px] text-[#208661] hover:underline font-semibold"
                >
                  Reset Defaults
                </button>
              </div>

              <p className="text-[10px] text-slate-500 leading-relaxed">
                Field survey attributes mapped directly into Section 1 Profile Attributes and Section 3 Risk Interpretation analysis.
              </p>

              <div className="space-y-1.5">
                {surveyItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-1.5 p-1.5 rounded-lg border border-slate-200 bg-slate-50/60">
                    <input
                      className="input-rich text-[11px] py-1 w-1/2"
                      placeholder="column_name"
                      value={item.key}
                      onChange={(e) => updateSurveyItem(item.id, 'key', e.target.value)}
                    />
                    <input
                      className="input-rich text-[11px] py-1 w-1/2"
                      placeholder="Observed value"
                      value={item.value}
                      onChange={(e) => updateSurveyItem(item.id, 'value', e.target.value)}
                    />
                    <button
                      onClick={() => removeSurveyItem(item.id)}
                      className="text-rose-400 hover:text-rose-600 shrink-0 p-1"
                      title="Remove survey row"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs gap-1 py-1 h-8"
                onClick={addSurveyItem}
              >
                <Plus size={13} /> Add Survey Attribute
              </Button>
            </div>
          )}
        </div>

        {/* Pinned Bottom Action: Generate Scorecard */}
        <div className="p-3 border-t border-slate-200 bg-white shrink-0">
          <Button variant="gradient" size="sm" className="w-full gap-2 shadow-xs" onClick={handleGenerate} disabled={generating}>
            {generating ? <RefreshCw size={14} className="animate-spin" /> : <Wand2 size={14} />}
            {generating ? 'Synthesizing Scorecard...' : 'Generate Scorecard'}
          </Button>
        </div>
      </aside>

      {/* Main workspace: Puck visual editor and top toolbar */}
      <main className="scorecard-workspace flex-1 min-w-0 flex flex-col overflow-hidden relative">
        {/* Top toolbar */}
        <div className="scorecard-toolbar border-b border-slate-200 bg-white px-4 py-2.5 flex items-center gap-3 flex-wrap shrink-0 z-20">
          {!indicatorsSidebarOpen && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIndicatorsSidebarOpen(true)}
              className="gap-1.5 text-xs text-slate-700"
              title="Open parameters & indicators drawer"
            >
              <PanelLeftOpen size={14} className="text-[#208661]" /> Parameters
            </Button>
          )}

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Assessment ID</span>
            <input
              className="input-rich w-36 py-1 text-[11px]"
              value={assessmentId}
              onChange={(e) => setAssessmentId(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Domain</span>
            <input className="input-rich w-36 py-1 text-[11px]" value={domain} onChange={(e) => setDomain(e.target.value)} />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">User</span>
            <input className="input-rich w-24 py-1 text-[11px]" value={userId} onChange={(e) => setUserId(e.target.value)} />
          </div>

          <div className="flex-1" />

          {document && (
            <span
              className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${document.version_type === 'reviewed'
                ? 'bg-[#e9f3f0] text-[#208661] border border-[#63ab91]'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}
            >
              v{document.version} — {document.version_type}
            </span>
          )}

          {versions.length > 0 && (
            <>
              <select
                className="input-rich w-auto py-1 text-[11px]"
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
                <Trash2 size={13} />
              </Button>
            </>
          )}

          <Button variant="gradient" size="sm" onClick={handleSave} disabled={Boolean(!puckData || saving)}>
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving...' : 'Save Version'}
          </Button>
        </div>

        {/* Status banner */}
        {(errors.length > 0 || warnings.length > 0 || statusMessage) && (
          <div className="scorecard-status-panel px-4 py-1.5 space-y-1 border-b border-slate-200 bg-white shrink-0 z-10">
            {statusMessage && errors.length === 0 && (
              <div className="flex items-center gap-1.5 text-[11px] text-[#208661] font-medium">
                <CheckCircle2 size={12} /> {statusMessage}
              </div>
            )}
            {errors.map((e, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[11px] text-rose-600 font-medium">
                <AlertTriangle size={12} /> <span className="font-mono text-[10px]">{e.path}:</span> {e.message}
              </div>
            ))}
            {warnings.map((w, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[11px] text-amber-600 font-medium">
                <AlertTriangle size={12} /> {w}
              </div>
            ))}
          </div>
        )}

        {/* Puck Visual Editor Workspace */}
        <div className="puck-editor-container flex-1 min-h-0 h-full w-full overflow-hidden relative">
          {puckData ? (
            <Puck
              config={puckConfig}
              data={puckData}
              onChange={setPuckData}
              onPublish={handleSave}
              iframe={{ enabled: false }}
            />
          ) : (
            <div className="h-full w-full flex flex-col items-center justify-center text-center px-6 bg-slate-50 text-slate-400">
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm max-w-md space-y-3">
                <div className="w-12 h-12 rounded-xl bg-[#e9f3f0] text-[#208661] flex items-center justify-center mx-auto">
                  <LayoutDashboard size={24} />
                </div>
                <h3 className="text-base font-bold text-slate-900">Puck Visual Scorecard Editor</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Configure risk parameters in the left drawer and click <strong>Generate with Puck</strong>, or launch
                  a default template to start designing right away.
                </p>
                <div className="pt-2 flex items-center justify-center gap-2">
                  <Button variant="gradient" size="sm" onClick={handleGenerate} disabled={generating}>
                    {generating ? <RefreshCw size={14} className="animate-spin" /> : <Wand2 size={14} />}
                    Generate Scorecard
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
