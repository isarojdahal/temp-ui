'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  X
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
  const [showMiniMap, setShowMiniMap] = useState(true);
  const [isExportingPng, setIsExportingPng] = useState(false);
  const [activeNodeModal, setActiveNodeModal] = useState(null); // null | 'formula' | 'choices'

  const { fitView } = useReactFlow();

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
