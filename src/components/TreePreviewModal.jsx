import React, { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Eye, Layers, Sparkles, X, CheckCircle2 } from 'lucide-react';
import { nodeTypes } from './CustomNodes';
import { CurvedEdge } from './CurvedEdge';
import { transformMCVRATreeToReactFlow } from '../utils/graphTransformer';
import { Button } from './ui/button';

const edgeTypes = { curved: CurvedEdge };

export function TreePreviewModal({ open, onClose, treeData, onApply }) {
  const { nodes, edges, counts } = useMemo(() => {
    if (!treeData) {
      return {
        nodes: [],
        edges: [],
        counts: { criteria: 0, metric: 0, question: 0, total: 0 },
      };
    }

    const { nodes: flowNodes, edges: flowEdges } = transformMCVRATreeToReactFlow(treeData);

    let criteriaCount = 0;
    let metricCount = 0;
    let questionCount = 0;

    flowNodes.forEach((n) => {
      const type = n.type || n.data?.nodeType;
      if (type === 'criteria' || type === 'Criteria') criteriaCount++;
      else if (type === 'metric' || type === 'Metric') metricCount++;
      else questionCount++;
    });

    return {
      nodes: flowNodes,
      edges: flowEdges,
      counts: {
        criteria: criteriaCount,
        metric: metricCount,
        question: questionCount,
        total: flowNodes.length,
      },
    };
  }, [treeData]);

  if (!open || !treeData) return null;

  const handleApply = () => {
    if (onApply) {
      onApply(treeData);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#208661] text-white flex items-center justify-center shadow-md shadow-[#208661]/20">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                MCVRA Assessment Tree Preview
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-[#208661]">
                  AI Generated
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Inspect the multi-criteria hierarchy before applying to the main canvas
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
            title="Close Preview"
          >
            <X size={18} />
          </button>
        </div>

        {/* Summary Badges Bar */}
        <div className="px-6 py-2.5 bg-slate-50/40 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs">
              <Layers size={13} className="text-[#208661]" />
              Total Nodes: <strong className="text-slate-900">{counts.total}</strong>
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
              Criteria (Pillars): <strong>{counts.criteria}</strong>
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
              Metrics: <strong>{counts.metric}</strong>
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
              Indicators: <strong>{counts.question}</strong>
            </span>
          </div>

          <span className="text-[11px] text-slate-400 font-medium">
            Interactive preview — zoom and pan to inspect
          </span>
        </div>

        {/* Canvas Area */}
        <div className="relative flex-1 min-h-[460px] h-[58vh] w-full bg-[#f8fafc] overflow-hidden">
          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              fitView
              minZoom={0.15}
              maxZoom={2}
              nodesDraggable={true}
              nodesConnectable={false}
            >
              <Background color="#cbd5e1" gap={20} size={1} />
              <Controls />
              <MiniMap
                pannable
                zoomable
                maskColor="rgba(32, 134, 97, 0.12)"
                maskStrokeColor="#208661"
                style={{
                  background: '#ffffff',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  width: 180,
                  height: 120,
                }}
              />
            </ReactFlow>
          </ReactFlowProvider>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-200 bg-white">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={handleApply}
            className="bg-[#208661] hover:bg-[#186a4d] text-white flex items-center gap-2 px-5 font-semibold shadow-md shadow-emerald-900/10"
          >
            <CheckCircle2 size={16} />
            Apply to Canvas
          </Button>
        </div>
      </div>
    </div>
  );
}
