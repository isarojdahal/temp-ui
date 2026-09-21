'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  ReactFlow,
  Controls,
  ControlButton,
  Background,
  MiniMap,
  NodeToolbar,
  Position,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Layers,
  Play,
  Square,
  RefreshCw,
  FileSpreadsheet,
  AlertCircle,
  Download,
  Copy,
  Sparkles,
  Wand2,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Pencil,
  Settings2,
  X,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { toPng } from 'html-to-image';

import { nodeTypes } from './CustomNodes';
import { CurvedEdge } from './CurvedEdge';
import { transformMCVRATreeToReactFlow } from '../utils/graphTransformer';
import { sampleMCVRATree } from '../utils/sampleTree';
import { generateMcvraGraph, generateMcvraGraphStream } from '../utils/api';
import { Button } from './ui/button';
import { McvraChatDrawer } from './McvraChatDrawer';

const edgeTypes = { curved: CurvedEdge };

function highlightJsonSyntax(code) {
  if (!code) return '';

  const escapeHtml = (str) =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  const regex = /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?|[{}[\],:])/g;

  let lastIndex = 0;
  let html = '';
  let match;

  while ((match = regex.exec(code)) !== null) {
    if (match.index > lastIndex) {
      html += escapeHtml(code.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('"')) {
      if (token.includes(':')) {
        const colonIdx = token.lastIndexOf(':');
        const keyPart = token.slice(0, colonIdx);
        const afterColon = token.slice(colonIdx);
        html += `<span class="text-sky-700 font-bold">${escapeHtml(keyPart)}</span><span class="text-slate-400">${escapeHtml(afterColon)}</span>`;
      } else {
        html += `<span class="text-emerald-700 font-medium">${escapeHtml(token)}</span>`;
      }
    } else if (token === 'true' || token === 'false') {
      html += `<span class="text-purple-700 font-bold">${escapeHtml(token)}</span>`;
    } else if (token === 'null') {
      html += `<span class="text-rose-600 font-bold">${escapeHtml(token)}</span>`;
    } else if (/^-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?$/.test(token)) {
      html += `<span class="text-amber-700 font-semibold">${escapeHtml(token)}</span>`;
    } else if (/[{}[\]]/.test(token)) {
      html += `<span class="text-indigo-600 font-bold">${escapeHtml(token)}</span>`;
    } else if (token === ':' || token === ',') {
      html += `<span class="text-slate-400 font-bold">${escapeHtml(token)}</span>`;
    } else {
      html += escapeHtml(token);
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < code.length) {
    html += escapeHtml(code.slice(lastIndex));
  }

  if (code.endsWith('\n')) {
    html += ' ';
  }

  return html;
}

function FlowViewer({ mcvraUrl, mcvraOnline, sidebarOpen, setSidebarOpen, onGraphChange }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [prompt, setPrompt] = useState('Flood Risk & Vulnerability Assessment');
  const [facilityType, setFacilityType] = useState('health_facility');
  const [assessmentType, setAssessmentType] = useState('flood');
  const [assessmentId, setAssessmentId] = useState('asm-default');
  const [userId, setUserId] = useState('user-1');
  const [currentDomain, setCurrentDomain] = useState('pokhara.dastaa.org');
  const [surveyColumnsText, setSurveyColumnsText] = useState(
    JSON.stringify([
      {
        name: "flood_zone_status",
        datatype: "boolean",
        description: "Yes=1  No=0"
      },
      {
        name: "school_closure_days",
        datatype: "range",
        description: "no_closure=0 ;  1 day = 0.3 ;  2–3 day =0.6 ;  4–7 day =0.8 ;  >7day =1"
      }
    ], null, 2)
  );
  const [frameworkId, setFrameworkId] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [streamProgress, setStreamProgress] = useState(null);
  const [error, setError] = useState(null);
  const [domain, setDomain] = useState('health_facility');
  const [rawTreeData, setRawTreeData] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showMiniMap, setShowMiniMap] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isExportingPng, setIsExportingPng] = useState(false);
  const [activeNodeModal, setActiveNodeModal] = useState(null); // null | 'formula' | 'choices'
  const [showStorageContext, setShowStorageContext] = useState(false);
  const abortControllerRef = useRef(null);
  const surveyPreRef = useRef(null);
  const surveyTextareaRef = useRef(null);

  const highlightedSurveyHtml = useMemo(() => {
    return highlightJsonSyntax(surveyColumnsText);
  }, [surveyColumnsText]);

  const handleSurveyScroll = (e) => {
    if (surveyPreRef.current) {
      surveyPreRef.current.scrollTop = e.target.scrollTop;
      surveyPreRef.current.scrollLeft = e.target.scrollLeft;
    }
  };

  const handleSurveyKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.target;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const value = target.value;
      const newValue = value.substring(0, start) + '  ' + value.substring(end);
      setSurveyColumnsText(newValue);
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      }, 0);
    }
  };

  const { fitView, setCenter } = useReactFlow();

  const navigateToNodeType = useCallback(
    (type) => {
      const matchingNodes = nodes.filter((n) => n.type === type);
      if (matchingNodes.length > 0) {
        fitView({
          nodes: matchingNodes,
          duration: 600,
          padding: 0.35,
        });
        setSelectedNode(matchingNodes[0]);
      }
    },
    [nodes, fitView, setSelectedNode]
  );

  // Handle stopping/canceling active graph generation
  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort();
      } catch (e) {
        // ignore abort error
      }
      abortControllerRef.current = null;
    }
    setLoading(false);
    setStreamProgress(null);
    setError('Generation stopped by user.');
  }, []);

  // Close any open node-detail viewer whenever the selected node changes
  // (including deselection), so a stale modal never shows another node's data.
  useEffect(() => {
    // Keep state-dependent controls identical during SSR and the first client render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveNodeModal(null);
  }, [selectedNode?.id]);

  // Auto-detect hostname if available in browser
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentDomain(window.location.hostname);
    }
  }, []);

  // Surface the current graph + assessment context to the parent page, so
  // other tabs (e.g. the Scorecard Editor) can derive their own data from
  // whatever graph was most recently generated here, instead of requiring
  // it to be re-entered by hand.
  useEffect(() => {
    if (!onGraphChange || nodes.length === 0) return;
    onGraphChange({
      nodes,
      edges,
      rawTreeData,
      assessmentId,
      userId,
      domain: currentDomain || domain,
      facilityType,
      assessmentType,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, rawTreeData, assessmentId, userId, currentDomain, domain, facilityType, assessmentType]);

  // Load tree onto canvas
  const loadTreeData = useCallback((treeData, domainName = 'csv_framework') => {
    setRawTreeData(treeData);
    const { nodes: parsedNodes, edges: parsedEdges } = transformMCVRATreeToReactFlow(treeData);
    setNodes(parsedNodes);
    setEdges(parsedEdges);
    setDomain(domainName);
    setTimeout(() => fitView({ padding: 0.2 }), 100);
  }, [fitView, setNodes, setEdges]);

  const handleApplyUpdatedGraph = useCallback((updatedGraph) => {
    if (!updatedGraph || !updatedGraph.length) return;
    loadTreeData(updatedGraph, domain);
  }, [loadTreeData, domain]);

  const handleGenerate = async (e) => {
    e?.preventDefault();
    if (!file) {
      setError('Upload an Excel or CSV framework file before generating the MCVRA graph.');
      return;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setLoading(true);
    setError(null);
    setStreamProgress({
      step: 1,
      total_steps: 7,
      title: 'Initializing LangGraph Engine',
      description: 'Preparing facility framework and survey column schemas...',
      completedNodes: []
    });

    const activeDomain = currentDomain || ((typeof window !== 'undefined' && window.location.hostname) ? window.location.hostname : 'pokhara.dastaa.org');

    try {
      const data = await generateMcvraGraphStream(
        mcvraUrl,
        {
          prompt,
          frameworkId,
          file,
          facilityType,
          assessmentType,
          surveyFileColumnNames: surveyColumnsText,
          assessmentId,
          userId,
          domain: activeDomain,
          signal: abortController.signal
        },
        (progress) => {
          setStreamProgress((prev) => {
            const completed = prev?.completedNodes ? [...prev.completedNodes] : [];
            const doneNode = progress.completed_node || (progress.event === 'progress' && progress.node);
            if (doneNode && !completed.includes(doneNode)) {
              completed.push(doneNode);
            }
            return {
              step: progress.step || prev?.step || 1,
              total_steps: progress.total_steps || 7,
              title: progress.title || 'Processing Graph Node',
              description: progress.description || progress.message || 'Executing LangGraph agent...',
              completedNodes: completed,
              currentNode: progress.current_node || (completed.length === 0 ? 'select_framework_and_generate_components' : null),
            };
          });
        }
      );

      if (data && data.graph) {
        loadTreeData(data.graph, data.domain || facilityType || 'health_facility');
        setDomain(data.domain || facilityType || 'health_facility');
      } else {
        throw new Error('Invalid graph payload returned from MCVRA generator.');
      }
    } catch (err) {
      if (abortController.signal.aborted || err.name === 'AbortError' || err.message?.includes('Aborted')) {
        setLoading(false);
        setStreamProgress(null);
        setError('Generation stopped by user.');
        return;
      }
      console.error('MCVRA streaming generation error, attempting synchronous fallback:', err);
      try {
        const fallbackData = await generateMcvraGraph(mcvraUrl, {
          prompt,
          frameworkId,
          file,
          facilityType,
          assessmentType,
          surveyFileColumnNames: surveyColumnsText,
          assessmentId,
          userId,
          domain: activeDomain,
          signal: abortController.signal
        });
        if (fallbackData && fallbackData.graph) {
          loadTreeData(fallbackData.graph, fallbackData.domain || facilityType || 'health_facility');
          setDomain(fallbackData.domain || facilityType || 'health_facility');
        } else {
          throw new Error('Invalid graph payload returned from MCVRA generator fallback.');
        }
      } catch (fallbackErr) {
        if (abortController.signal.aborted || fallbackErr.name === 'AbortError' || fallbackErr.message?.includes('Aborted')) {
          setLoading(false);
          setStreamProgress(null);
          setError('Generation stopped by user.');
          return;
        }
        let detailMsg = 'Failed to generate graph from backend.';
        if (fallbackErr.response?.data?.detail) {
          const detail = fallbackErr.response.data.detail;
          detailMsg = typeof detail === 'string' ? detail : JSON.stringify(detail);
        } else if (fallbackErr.message) {
          detailMsg = fallbackErr.message;
        }
        setError(detailMsg);
      }
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
      setLoading(false);
      setTimeout(() => {
        setStreamProgress(null);
      }, 1800);
    }
  };

  const handleExportJson = () => {
    const jsonStr = JSON.stringify(rawTreeData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mcvra-tree-${domain}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(rawTreeData, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportPng = async () => {
    const flowViewport = document.querySelector('.xyflow__viewport') || document.querySelector('.react-flow__viewport');
    if (!flowViewport) return;

    setIsExportingPng(true);
    try {
      const dataUrl = await toPng(flowViewport, {
        backgroundColor: '#070a12',
        quality: 0.95,
        pixelRatio: 2,
      });

      const link = document.createElement('a');
      link.download = `mcvra-graph-${domain}-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export graph image:', err);
    } finally {
      setIsExportingPng(false);
    }
  };

  const handleBeautify = useCallback(() => {
    if (!nodes.length) return;

    const parentMap = new Map();
    const childrenMap = new Map();

    edges.forEach((edge) => {
      parentMap.set(edge.target, edge.source);
      if (!childrenMap.has(edge.source)) {
        childrenMap.set(edge.source, []);
      }
      childrenMap.get(edge.source).push(edge.target);
    });

    const nodeMap = new Map(nodes.map((n) => [n.id, { ...n }]));
    const rootNodes = nodes.filter((n) => !parentMap.has(n.id));

    const HORIZONTAL_SPACING = 380;
    const VERTICAL_SPACING = 160;

    let currentY = 50;

    const layoutSubtree = (nodeId, depth) => {
      const node = nodeMap.get(nodeId);
      if (!node) return currentY;

      const children = childrenMap.get(nodeId) || [];
      const posX = depth * HORIZONTAL_SPACING + 50;

      if (children.length === 0) {
        node.position = { x: posX, y: currentY };
        const nextY = currentY + VERTICAL_SPACING;
        currentY = nextY;
        return nextY;
      }

      const childYStart = currentY;
      children.forEach((childId) => {
        layoutSubtree(childId, depth + 1);
      });

      const firstChildY = nodeMap.get(children[0])?.position.y ?? childYStart;
      const lastChildY = nodeMap.get(children[children.length - 1])?.position.y ?? currentY;
      const parentY = (firstChildY + lastChildY) / 2;

      node.position = { x: posX, y: parentY };
      return currentY;
    };

    rootNodes.forEach((root) => {
      layoutSubtree(root.id, 0);
    });

    const updatedNodes = Array.from(nodeMap.values());
    setNodes(updatedNodes);

    setTimeout(() => {
      fitView({ padding: 0.2 });
    }, 50);
  }, [nodes, edges, setNodes, fitView]);

  return (
    <div className="flex h-full w-full relative overflow-hidden bg-[#f8fafc]">
      {/* Rich Controls Sidebar */}
      <div className={`sidebar-container-rich ${sidebarOpen ? 'w-[360px]' : 'w-0 overflow-hidden p-0 border-none'}`}>
        <div className="space-y-4">
          {/* Header */}
          <div className="border-b border-slate-200 pb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layers size={18} className="text-[#208661]" />
              MCVRA Risk Visualizer
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Generate & inspect multi-criteria assessment trees.
            </p>
          </div>

          {/* Generation Form */}
          <form onSubmit={handleGenerate} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">Facility Type</label>
                <select
                  value={facilityType}
                  onChange={(e) => setFacilityType(e.target.value)}
                  className="input-rich"
                >
                  <option value="health_facility">Health Facility</option>
                  <option value="school">School</option>
                  <option value="household">Household</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">Assessment Hazard</label>
                <select
                  value={assessmentType}
                  onChange={(e) => setAssessmentType(e.target.value)}
                  className="input-rich"
                >
                  <option value="flood">Flood Risk</option>
                  <option value="heatwave">Heatwave</option>
                  <option value="drought">Drought</option>
                  <option value="landslide">Landslides</option>
                </select>
              </div>
            </div>

            {/* Domain & Tenancy (SQLite Cache Context) */}
            <div className="rounded-xl bg-slate-50 border border-slate-200 shadow-2xs overflow-hidden transition-all">
              <button
                type="button"
                onClick={() => setShowStorageContext(!showStorageContext)}
                className="w-full p-2.5 flex items-center justify-between text-left hover:bg-slate-100/80 transition cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  {showStorageContext ? (
                    <ChevronDown size={14} className="text-slate-500" />
                  ) : (
                    <ChevronRight size={14} className="text-slate-500" />
                  )}
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Domain & Storage Context
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 text-[#208661] font-semibold">
                    SQLite Cache
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {showStorageContext ? 'Hide' : 'Show'}
                  </span>
                </div>
              </button>

              {showStorageContext && (
                <div className="p-3 pt-1 space-y-2 border-t border-slate-200/60">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">Domain / Tenant Name</label>
                    <input
                      type="text"
                      value={currentDomain}
                      onChange={(e) => setCurrentDomain(e.target.value)}
                      placeholder="e.g. pokhara.dastaa.org"
                      className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#208661] focus:border-[#208661]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">Assessment ID</label>
                      <input
                        type="text"
                        value={assessmentId}
                        onChange={(e) => setAssessmentId(e.target.value)}
                        placeholder="asm-default"
                        className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#208661] focus:border-[#208661]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">User ID</label>
                      <input
                        type="text"
                        value={userId}
                        onChange={(e) => setUserId(e.target.value)}
                        placeholder="user-1"
                        className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#208661] focus:border-[#208661]"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-700 block mb-1">Upload Framework File (.xlsx / .csv)</label>
              <div className="p-2.5 rounded-xl border border-dashed border-slate-300 bg-slate-50 hover:border-[#208661] transition">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => setFile(e.target.files[0])}
                  className="w-full text-xs text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-[11px] file:font-semibold file:bg-[#e9f3f0] file:text-[#208661]"
                />
              </div>
              {file && (
                <div className="flex items-center justify-between text-xs text-emerald-800 bg-emerald-50 p-2 rounded-lg border border-emerald-200 mt-1.5">
                  <span className="flex items-center gap-1.5 truncate">
                    <FileSpreadsheet size={14} /> {file.name}
                  </span>
                  <button type="button" onClick={() => setFile(null)} className="text-rose-600 font-bold hover:text-rose-800">×</button>
                </div>
              )}
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-[11px] font-semibold text-slate-700 block">
                  Survey Column Fields
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        const parsed = JSON.parse(surveyColumnsText);
                        setSurveyColumnsText(JSON.stringify(parsed, null, 2));
                      } catch {
                        // ignore if invalid JSON
                      }
                    }}
                    className="text-[10px] text-[#208661] hover:underline font-semibold hover:text-[#186a4d]"
                    title="Prettify JSON indentation"
                  >
                    Format JSON
                  </button>
                  <span className="text-[9px] text-slate-400 font-medium">JSON format</span>
                </div>
              </div>
              <div className="relative w-full rounded-xl border border-slate-300 bg-slate-50/50 overflow-hidden focus-within:ring-1 focus-within:ring-[#208661] focus-within:border-[#208661] shadow-sm">
                {/* Syntax highlighted background preview */}
                <pre
                  ref={surveyPreRef}
                  aria-hidden="true"
                  className="absolute inset-0 p-3 font-mono text-xs leading-[1.6] whitespace-pre-wrap break-words pointer-events-none select-none overflow-hidden m-0 text-slate-800"
                  style={{ tabSize: 2 }}
                  dangerouslySetInnerHTML={{ __html: highlightedSurveyHtml }}
                />
                {/* Transparent editable textarea overlay */}
                <textarea
                  ref={surveyTextareaRef}
                  rows={18}
                  value={surveyColumnsText}
                  onChange={(e) => setSurveyColumnsText(e.target.value)}
                  onScroll={handleSurveyScroll}
                  onKeyDown={handleSurveyKeyDown}
                  placeholder='[&#10;  {&#10;    "name": "flood_zone_status",&#10;    "datatype": "boolean"&#10;  }&#10;]'
                  spellCheck={false}
                  className="relative z-10 w-full min-h-[360px] h-[380px] p-3 font-mono text-xs leading-[1.6] whitespace-pre-wrap break-words bg-transparent text-transparent caret-[#208661] selection:bg-[#208661]/25 selection:text-transparent resize-y focus:outline-none m-0 border-none block"
                  style={{ tabSize: 2 }}
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Specify survey dataset column names to map against assessment question indicators.
              </p>
            </div>
          </form>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Export Action Buttons */}
          <div className="flex gap-1.5 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPng}
              disabled={isExportingPng}
              className="flex-1 text-[#208661] border-[#208661]/40 hover:bg-[#e9f3f0]"
            >
              {isExportingPng ? <RefreshCw size={13} className="animate-spin" /> : <ImageIcon size={13} />} PNG
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportJson}
              className="flex-1"
            >
              <Download size={13} /> JSON
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyJson}
            >
              <Copy size={13} /> {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Canvas */}
      <div className="flex-1 h-full w-full relative min-h-[300px] bg-[#f8fafc]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={(_, node) => setSelectedNode(node)}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
        >
          <Background color="#cbd5e1" gap={20} size={1} />

          {/* Contextual Selected-Node Toolbar (view-only Formula / Choice Scores actions) */}
          <NodeToolbar
            nodeId={selectedNode?.id}
            isVisible={!!selectedNode}
            position={Position.Top}
            offset={12}
            className="flex items-center gap-1 bg-white rounded-xl border border-slate-200 shadow-lg p-1"
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setActiveNodeModal('formula')}
              title="View Formula"
            >
              <Pencil size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setActiveNodeModal('choices')}
              title="View Choice Scores"
            >
              <Settings2 size={14} />
            </Button>
          </NodeToolbar>

          <Controls className="react-flow-controls">
            <ControlButton title="Beautify / Auto Layout" onClick={handleBeautify}>
              <Wand2 size={15} className="text-[#208661]" />
            </ControlButton>
            <ControlButton
              title={showMiniMap ? 'Hide MiniMap' : 'Show MiniMap'}
              onClick={() => setShowMiniMap((prev) => !prev)}
            >
              {showMiniMap ? <Eye size={15} className="text-slate-600" /> : <EyeOff size={15} className="text-slate-400" />}
            </ControlButton>
          </Controls>
          {nodes.length === 0 && !loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10 p-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mb-4 shadow-md">
                <Layers size={28} className="text-[#208661]" />
              </div>
              <h3 className="text-base font-semibold text-slate-800 mb-1">No MCVRA Graph Loaded</h3>
              <p className="text-xs text-slate-500 max-w-sm">
                Select a <strong className="text-slate-700">Facility Type</strong> and <strong className="text-slate-700">Assessment Hazard</strong>, then click <strong className="text-slate-700">&quot;Generate Graph&quot;</strong> to render the MCVRA tree.
              </p>
            </div>
          )}
          {showMiniMap && (
            <MiniMap
              pannable
              zoomable
              nodeColor={(node) => {
                switch (node.type) {
                  case 'criteria': return '#63ab91';
                  case 'metric': return '#f59e0b';
                  case 'question': return '#94a3b8';
                  case 'raster_calculation': return '#8b5cf6';
                  case 'raster': return '#f43f5e';
                  default: return '#cbd5e1';
                }
              }}
              maskColor="rgba(32, 134, 97, 0.12)"
              maskStrokeColor="#208661"
              maskStrokeWidth={2}
              onClick={(event, position) => {
                if (position && typeof position.x === 'number' && typeof position.y === 'number') {
                  setCenter(position.x, position.y, { duration: 500 });
                }
              }}
              onNodeClick={(event, node) => {
                if (node) {
                  const nodeW = node.measured?.width || node.width || 180;
                  const nodeH = node.measured?.height || node.height || 60;
                  const targetX = (node.position?.x ?? 0) + nodeW / 2;
                  const targetY = (node.position?.y ?? 0) + nodeH / 2;
                  setCenter(targetX, targetY, { duration: 500 });
                  setSelectedNode(node);
                }
              }}
              style={{
                background: '#ffffff',
                borderRadius: '12px',
                border: '1.5px solid #cbd5e1',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
                cursor: 'crosshair',
                width: 220,
                height: 150
              }}
              ariaLabel="Graph Overview Navigator"
            />
          )}
        </ReactFlow>

        {/* Top-Left Canvas Overview & Node Navigation Panel */}
        <div className="absolute top-4 left-4 z-20 hidden sm:flex flex-col gap-2 bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-sm px-3.5 py-2 rounded-xl text-xs text-slate-700">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => fitView({ duration: 500, padding: 0.2 })}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity text-left cursor-pointer group"
              title="Click to reset view & fit all nodes"
            >
              <span className="w-2 h-2 rounded-full bg-[#208661] group-hover:scale-125 transition-transform" />
              <span className="font-semibold text-slate-500">Domain:</span>
              <span className="font-mono text-[#208661] font-bold">{currentDomain || 'pokhara.dastaa.org'}</span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-500 font-mono text-[11px]">{assessmentId}</span>
            </button>
            <span className="text-[10px] bg-slate-100 text-slate-500 font-semibold px-1.5 py-0.5 rounded">
              Overview
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 pt-1.5 border-t border-slate-100 text-[11px]">
            <span className="text-[10px] text-slate-400 mr-0.5 font-medium">Navigate:</span>
            {[
              { type: 'criteria', label: 'Goal / Criteria', color: 'bg-[#E9F3F0] border-[#208661]' },
              { type: 'metric', label: 'Metric', color: 'bg-[#FFF8EC] border-amber-400' },
              { type: 'question', label: 'Question', color: 'bg-[#F5F5F5] border-slate-400' },
              { type: 'raster_calculation', label: 'Raster Calc', color: 'bg-[#FEF3C7] border-amber-500' },
              { type: 'raster', label: 'Raster', color: 'bg-[#F1CBCB] border-rose-400' },
            ].map(({ type, label, color }) => {
              const count = nodes.filter((n) => n.type === type).length;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => navigateToNodeType(type)}
                  disabled={isHydrated && count === 0}
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md transition-all ${count > 0
                    ? 'hover:bg-slate-100 hover:text-slate-900 cursor-pointer font-medium text-slate-700'
                    : 'opacity-40 cursor-not-allowed text-slate-400'
                    }`}
                  title={count > 0 ? `Click to navigate to ${count} ${label} node(s)` : `No ${label} nodes`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full border ${color}`} />
                  <span>{label}</span>
                  {count > 0 && <span className="text-[10px] text-slate-400">({count})</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Floating Chat with Graph AI Button on Canvas */}
        <button
          onClick={() => setIsChatOpen(true)}
          className="absolute top-4 right-4 z-20 bg-white/95 hover:bg-white backdrop-blur-md border border-[#208661]/40 text-[#208661] hover:text-[#1a6d4f] shadow-lg shadow-emerald-900/10 px-3.5 py-2 rounded-full flex items-center gap-2 text-xs font-bold transition-all hover:scale-105 cursor-pointer group"
          title="Open MCVRA Graph Copilot"
        >
          <div className="w-2 h-2 rounded-full bg-[#208661] animate-ping" />
          <Sparkles size={14} className="text-[#208661] group-hover:rotate-12 transition-transform" />
          <span>Chat with Graph AI</span>
        </button>

        {/* Centered Streaming Progress Status & Loading Indicator Overlay */}
        {loading && (
          <div className="absolute inset-0 z-40 bg-slate-900/20 backdrop-blur-xs flex items-center justify-center p-4 pointer-events-auto">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-emerald-200/80 shadow-2xl p-6 max-w-md w-full space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                    <Sparkles size={20} className="text-[#208661] animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Generating MCVRA Graph</h3>
                    <p className="text-[11px] text-slate-500">LangGraph Multi-Agent Pipeline Active</p>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              {streamProgress && (
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-[#208661] to-emerald-400 h-2 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${Math.min(100, Math.max(10, (streamProgress.step / streamProgress.total_steps) * 100))}%` }}
                  />
                </div>
              )}

              {/* Current Agent Activity Card */}
              {streamProgress ? (
                <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200/70 space-y-1">
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                    <RefreshCw size={14} className="animate-spin text-[#208661]" />
                    <span>{streamProgress.title}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed pl-5">
                    {streamProgress.description}
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2.5 py-6 text-xs font-semibold text-slate-600">
                  <RefreshCw size={18} className="animate-spin text-[#208661]" />
                  <span>Initializing MCVRA Multi-Agent Pipeline...</span>
                </div>
              )}

              {/* Stop Button */}
              <div className="pt-2 border-t border-slate-100 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleStop}
                  className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-semibold px-4 py-1.5 rounded-lg flex items-center gap-1.5 text-xs transition cursor-pointer"
                  title="Stop generation"
                >
                  <Square size={12} className="fill-rose-600 text-rose-600" />
                  <span>Stop Generation</span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Floating Generate Graph Action Bar (Bottom Center) */}
        <div className="absolute bottom-7 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 transition-all">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            className="bg-[#208661] hover:bg-[#1a6d4f] text-white shadow-2xl shadow-emerald-950/30 font-bold px-12 py-4 min-w-[260px] h-14 justify-center rounded-full flex items-center gap-3 cursor-pointer transition-all hover:scale-105 active:scale-95 text-base tracking-wide border border-emerald-400/40 disabled:opacity-85"
          >
            {loading ? <RefreshCw size={20} className="animate-spin" /> : <Play size={20} className="fill-white" />}
            <span>{loading ? 'Generating Graph...' : 'Generate Graph'}</span>
          </button>
          {loading && (
            <button
              type="button"
              onClick={handleStop}
              className="bg-white/95 hover:bg-white text-rose-600 border border-rose-200 shadow-2xl font-bold px-6 py-4 h-14 rounded-full flex items-center gap-2 transition cursor-pointer text-base hover:scale-105 active:scale-95"
              title="Stop generation"
            >
              <Square size={16} className="fill-rose-600 text-rose-600" />
              <span>Stop</span>
            </button>
          )}
        </div>
      </div>

      {/* MCVRA Graph AI Copilot Drawer */}
      <McvraChatDrawer
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        mcvraUrl={mcvraUrl}
        rawTreeData={rawTreeData || sampleMCVRATree}
        assessmentId={assessmentId}
        userId={userId}
        assessmentName={prompt}
        domain={currentDomain || domain}
        onApplyUpdatedGraph={handleApplyUpdatedGraph}
        onFitView={() => fitView({ padding: 0.2 })}
      />

      {/* Formula Viewer Modal (read-only) */}
      {activeNodeModal === 'formula' && selectedNode && (
        <div className="pdf-modal-backdrop" onClick={() => setActiveNodeModal(null)}>
          <div className="card-rich w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-slate-200 pb-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Pencil size={14} className="text-[#208661]" />
                Formula
              </h3>
              <button
                onClick={() => setActiveNodeModal(null)}
                className="pdf-close-btn"
                title="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="text-xs space-y-2 max-h-[60vh] overflow-y-auto">
              <span className="text-slate-500 block font-medium">{selectedNode.data.label}</span>

              {selectedNode.data.formula ? (
                <pre className="font-mono text-xs text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200 whitespace-pre-wrap break-words">
                  {selectedNode.data.formula}
                </pre>
              ) : (
                <p className="text-slate-400 text-center py-6 border border-dashed border-slate-200 rounded-xl">
                  No formula configured for this node.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Choice Scores Viewer Modal (read-only) */}
      {activeNodeModal === 'choices' && selectedNode && (
        <div className="pdf-modal-backdrop" onClick={() => setActiveNodeModal(null)}>
          <div className="card-rich w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-slate-200 pb-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Settings2 size={14} className="text-[#208661]" />
                Choice Scores
              </h3>
              <button
                onClick={() => setActiveNodeModal(null)}
                className="pdf-close-btn"
                title="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="text-xs space-y-2">
              <span className="text-slate-500 block font-medium">{selectedNode.data.label}</span>

              {selectedNode.data.choices && selectedNode.data.choices.length > 0 ? (
                <div className="rounded-lg border border-slate-200 overflow-hidden max-h-[50vh] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="text-left font-semibold text-slate-600 px-3 py-2">Choice</th>
                        <th className="text-right font-semibold text-slate-600 px-3 py-2">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedNode.data.choices.map((choice, idx) => (
                        <tr key={idx} className="border-t border-slate-100">
                          <td className="px-3 py-2 text-slate-800 font-medium">{choice.name}</td>
                          <td className="px-3 py-2 text-right font-mono text-[#208661] font-bold">{choice.score}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-slate-400 text-center py-6 border border-dashed border-slate-200 rounded-xl">
                  No choice scores configured for this node.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function McvraVisualizer(props) {
  return (
    <ReactFlowProvider>
      <FlowViewer {...props} />
    </ReactFlowProvider>
  );
}
