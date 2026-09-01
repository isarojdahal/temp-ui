'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ReactFlow,
  Controls,
  ControlButton,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Layers,
  Play,
  RefreshCw,
  FileSpreadsheet,
  Info,
  AlertCircle,
  Download,
  Copy,
  Code,
  Sparkles,
  Wand2,
  Eye,
  EyeOff,
  Image as ImageIcon
} from 'lucide-react';
import { toPng } from 'html-to-image';

import { nodeTypes } from './CustomNodes';
import { CurvedEdge } from './CurvedEdge';
import { transformMCVRATreeToReactFlow } from '../utils/graphTransformer';
import { sampleMCVRATree } from '../utils/sampleTree';
import { generateMcvraGraph, generateMcvraGraphStream, fetchMcvraFrameworks } from '../utils/api';
import { Button } from './ui/button';
import { McvraChatDrawer } from './McvraChatDrawer';

const edgeTypes = { curved: CurvedEdge };

function FlowViewer({ mcvraUrl, mcvraOnline, sidebarOpen, setSidebarOpen }) {
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
  const [frameworksList, setFrameworksList] = useState([]);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [streamProgress, setStreamProgress] = useState(null);
  const [error, setError] = useState(null);
  const [domain, setDomain] = useState('health_facility');
  const [rawTreeData, setRawTreeData] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);
  const [showMiniMap, setShowMiniMap] = useState(true);
  const [isExportingPng, setIsExportingPng] = useState(false);

  const { fitView } = useReactFlow();

  // Auto-detect hostname if available in browser
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      setCurrentDomain(window.location.hostname);
    }
  }, []);

  // Load registered framework templates from backend
  useEffect(() => {
    async function loadFrameworks() {
      if (mcvraOnline) {
        const list = await fetchMcvraFrameworks(mcvraUrl);
        if (list && list.length > 0) {
          setFrameworksList(list);
        }
      }
    }
    loadFrameworks();
  }, [mcvraOnline, mcvraUrl]);

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
          domain: activeDomain
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
          domain: activeDomain
        });
        if (fallbackData && fallbackData.graph) {
          loadTreeData(fallbackData.graph, fallbackData.domain || facilityType || 'health_facility');
          setDomain(fallbackData.domain || facilityType || 'health_facility');
        } else {
          throw new Error('Invalid graph payload returned from MCVRA generator fallback.');
        }
      } catch (fallbackErr) {
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
          <div className="flex justify-between items-center border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Layers size={18} className="text-[#208661]" />
                MCVRA Risk Visualizer
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Generate & inspect multi-criteria assessment trees.
              </p>
            </div>

            <span className={`status-badge-rich ${mcvraOnline ? 'online' : 'offline'}`}>
              <span className="status-dot-rich" />
              {mcvraOnline ? 'API Active' : 'Offline'}
            </span>
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
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2 shadow-2xs">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                  Domain & Storage Context
                </label>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 text-[#208661] font-semibold">
                  SQLite Cache
                </span>
              </div>

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
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-semibold text-slate-700 block">
                  Survey Column Fields
                </label>
                <span className="text-[9px] text-slate-400 font-medium">Comma-separated or JSON</span>
              </div>
              <textarea
                rows={2}
                value={surveyColumnsText}
                onChange={(e) => setSurveyColumnsText(e.target.value)}
                placeholder="e.g. flood_zone_status, river_distance_m, building_typology"
                className="w-full text-xs p-2 rounded-xl border border-slate-300 bg-white font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#208661] focus:border-[#208661]"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Specify survey dataset column names to map against assessment question indicators.
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                type="submit"
                variant="gradient"
                size="sm"
                disabled={loading}
                className="flex-1 bg-[#208661] hover:bg-[#1a6d4f] text-white"
              >
                {loading ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
                Generate Graph
              </Button>
            </div>
          </form>

          {loading && streamProgress && (
            <div className="p-3.5 rounded-xl bg-emerald-50/90 border border-emerald-200/90 shadow-sm space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-[#208661] animate-pulse" />
                  LangGraph Pipeline Active
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#208661] text-white">
                  Step {streamProgress.step} of {streamProgress.total_steps}
                </span>
              </div>

              <div className="w-full bg-emerald-200/60 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-[#208661] h-1.5 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${Math.min(100, Math.max(10, (streamProgress.step / streamProgress.total_steps) * 100))}%` }}
                />
              </div>

              <div className="bg-white/90 p-2.5 rounded-lg border border-emerald-200/60 space-y-0.5">
                <div className="text-[11px] font-bold text-slate-900 flex items-center gap-1.5">
                  <RefreshCw size={12} className="animate-spin text-[#208661]" />
                  {streamProgress.title}
                </div>
                <p className="text-[10px] text-slate-600 leading-tight">
                  {streamProgress.description}
                </p>
              </div>

              <div className="space-y-1 pt-1 border-t border-emerald-200/50">
                {[
                  { key: "select_framework_and_generate_components", label: "Pillar Components Agent" },
                  { key: "generate_parameter_nodes", label: "Parameter Sub-criteria Agent" },
                  { key: "generate_optional_nodes", label: "Optional GIS & Capacity Agent" },
                  { key: "generate_question_ideas", label: "Question Generator Agent" },
                  { key: "map_survey_columns", label: "Survey Column Alignment Agent" },
                  { key: "evaluate_formulas_and_layout", label: "Formula & Layout Agent" },
                  { key: "calculate_usage_metadata", label: "Usage & Pricing Agent" },
                ].map((agent, idx) => {
                  const isDone = streamProgress.completedNodes?.includes(agent.key);
                  const isCurrent = !isDone && (
                    streamProgress.currentNode === agent.key ||
                    (!streamProgress.currentNode && streamProgress.step === idx + 1)
                  );
                  return (
                    <div key={agent.key} className="flex items-center justify-between text-[10px]">
                      <span className={`flex items-center gap-1.5 ${isDone ? 'text-emerald-800 font-semibold' : isCurrent ? 'text-slate-900 font-bold' : 'text-slate-400'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isDone ? 'bg-emerald-500' : isCurrent ? 'bg-[#208661] animate-ping' : 'bg-slate-300'}`} />
                        {agent.label}
                      </span>
                      <span className="font-mono text-[9px] font-semibold">
                        {isDone ? '✓ Done' : isCurrent ? 'Working...' : 'Waiting'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Graph Statistics Card */}
          <div className="card-rich space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">Predicted Domain:</span>
              <span className="font-bold text-[#208661] capitalize">
                {(domain || facilityType || 'health_facility').replace(/_/g, ' ')}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">Total Graph Nodes:</span>
              <span className="font-bold text-slate-900 text-sm">{nodes.length}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">Total Connections:</span>
              <span className="font-bold text-slate-900 text-sm">{edges.length}</span>
            </div>
          </div>

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

          {/* AI Graph Copilot Chat Trigger */}
          <Button
            variant="gradient"
            size="sm"
            onClick={() => setIsChatOpen(true)}
            className="w-full bg-[#208661] hover:bg-[#1a6d4f] text-white shadow-sm flex items-center justify-center gap-2 font-semibold"
          >
            <Sparkles size={14} className="animate-pulse" />
            Chat with Graph Copilot
          </Button>

          {/* Node Inspector */}
          <div className="card-rich space-y-2">
            <div className="flex justify-between items-center border-b border-slate-200 pb-2">
              <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Info size={14} className="text-[#208661]" />
                Node Inspector
              </h3>
              {selectedNode && (
                <Button
                  variant="link"
                  size="xs"
                  onClick={() => setSelectedNode(null)}
                >
                  Clear
                </Button>
              )}
            </div>

            {selectedNode ? (
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">ID:</span>
                  <span className="font-mono text-[#208661] font-semibold">{selectedNode.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Type:</span>
                  <span className="font-semibold text-purple-700 capitalize">{selectedNode.type}</span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-0.5">Label:</span>
                  <span className="font-medium text-slate-800 block bg-slate-50 p-2 rounded-lg border border-slate-200">
                    {selectedNode.data.label}
                  </span>
                </div>
                {selectedNode.data.formula && (
                  <div>
                    <span className="text-slate-500 block mb-0.5">Formula:</span>
                    <span className="font-mono text-xs text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200 block">
                      {selectedNode.data.formula}
                    </span>
                  </div>
                )}
                <div>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => setShowRawJson(!showRawJson)}
                    className="mt-1"
                  >
                    <Code size={12} /> {showRawJson ? 'Hide Raw JSON' : 'View Raw Node JSON'}
                  </Button>
                  {showRawJson && (
                    <pre className="bg-slate-50 p-2.5 rounded-lg text-[10px] text-emerald-700 font-mono overflow-x-auto max-h-40 border border-slate-200 mt-1">
                      {JSON.stringify(selectedNode.data, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center py-6 border border-dashed border-slate-200 rounded-xl">
                Click any node on the graph canvas to inspect parameters, formulas, choices and scores.
              </p>
            )}
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
          <Controls className="react-flow-controls">
            <ControlButton title="Beautify / Auto Layout" onClick={handleBeautify}>
              <Wand2 size={15} className="text-[#208661]" />
            </ControlButton>
            <ControlButton
              title="Chat with MCVRA Graph AI"
              onClick={() => setIsChatOpen((prev) => !prev)}
            >
              <Sparkles size={15} className="text-[#208661]" />
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
                Select a <strong className="text-slate-700">Facility Type</strong> and <strong className="text-slate-700">Assessment Hazard</strong>, then click <strong className="text-slate-700">"Generate Graph"</strong> to render the MCVRA tree.
              </p>
            </div>
          )}
          {showMiniMap && (
            <MiniMap
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
              maskColor="rgba(248, 250, 252, 0.7)"
              style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1' }}
            />
          )}
        </ReactFlow>

        {/* Top-Left Canvas Context Pill */}
        <div className="absolute top-4 left-4 z-20 hidden sm:flex items-center gap-2 bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-sm px-3.5 py-1.5 rounded-full text-xs text-slate-700">
          <span className="w-2 h-2 rounded-full bg-[#208661]" />
          <span className="font-semibold text-slate-500">Domain:</span>
          <span className="font-mono text-[#208661] font-bold">{currentDomain || 'pokhara.dastaa.org'}</span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500 font-mono text-[11px]">{assessmentId}</span>
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

        {/* Legend Card - integrated-tool-frontend color palette */}
        <div className="absolute bottom-5 right-5 bg-white/95 backdrop-blur-md border border-slate-200 px-4 py-2 rounded-xl flex gap-3 text-xs text-slate-700 shadow-md z-10">
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#E9F3F0] border border-[#208661]" /> Goal / Criteria</div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#FFF8EC] border border-amber-400" /> Metric</div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#F5F5F5] border border-slate-400" /> Question</div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#FEF3C7] border border-amber-500" /> Raster Calc</div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#F1CBCB] border border-rose-400" /> Raster</div>
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
