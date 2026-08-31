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
import { generateMcvraGraph, fetchMcvraFrameworks } from '../utils/api';
import { Button } from './ui/button';

const edgeTypes = { curved: CurvedEdge };

function FlowViewer({ mcvraUrl, mcvraOnline, sidebarOpen, setSidebarOpen }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [prompt, setPrompt] = useState('Flood Risk & Vulnerability Assessment');
  const [facilityType, setFacilityType] = useState('health_facility');
  const [assessmentType, setAssessmentType] = useState('flood');
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
  const [error, setError] = useState(null);
  const [domain, setDomain] = useState('health_facility');
  const [rawTreeData, setRawTreeData] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);
  const [showMiniMap, setShowMiniMap] = useState(true);
  const [isExportingPng, setIsExportingPng] = useState(false);

  const { fitView } = useReactFlow();

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

  const handleGenerate = async (e) => {
    e?.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = await generateMcvraGraph(mcvraUrl, {
        prompt,
        frameworkId,
        file,
        facilityType,
        assessmentType,
        surveyFileColumnNames: surveyColumnsText
      });

      if (data && data.graph) {
        loadTreeData(data.graph, data.domain || facilityType || 'health_facility');
      } else {
        throw new Error('Invalid graph payload returned from MCVRA generator.');
      }
    } catch (err) {
      console.error('MCVRA generation error:', err);
      let detailMsg = 'Failed to generate graph from backend.';
      if (err.response?.data?.detail) {
        const detail = err.response.data.detail;
        if (typeof detail === 'string') {
          detailMsg = detail;
        } else if (Array.isArray(detail)) {
          detailMsg = detail
            .map((item) => {
              const locStr = item.loc ? item.loc.filter((l) => l !== 'body' && l !== 'query').join(' > ') : '';
              return `${locStr ? locStr + ': ' : ''}${item.msg || JSON.stringify(item)}`;
            })
            .join(' | ');
        } else if (typeof detail === 'object') {
          detailMsg = JSON.stringify(detail);
        }
      } else if (err.message) {
        detailMsg = err.message;
      }
      setError(detailMsg);
    } finally {
      setLoading(false);
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
              <span className="font-bold text-[#208661] capitalize">{domain.replace(/_/g, ' ')}</span>
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

        {/* Legend Card - integrated-tool-frontend color palette */}
        <div className="absolute bottom-5 right-5 bg-white/95 backdrop-blur-md border border-slate-200 px-4 py-2 rounded-xl flex gap-3 text-xs text-slate-700 shadow-md z-10">
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#E9F3F0] border border-[#208661]" /> Goal / Criteria</div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#FFF8EC] border border-amber-400" /> Metric</div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#F5F5F5] border border-slate-400" /> Question</div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#FEF3C7] border border-amber-500" /> Raster Calc</div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#F1CBCB] border border-rose-400" /> Raster</div>
        </div>
      </div>
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
