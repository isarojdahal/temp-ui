import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Shield, Layers, HelpCircle, Cpu, Globe, FileText } from 'lucide-react';

// Node card design system matching integrated-tool-frontend MindMapNode tokens:
// Root / Goal Node -> bg-[#E9F3F0]
// Criteria Node    -> bg-[#F4F7FE]
// Metric Node      -> bg-[#FFF8EC]
// Question Node    -> bg-[#F5F5F5]
// Text Node        -> bg-[#F0F4FF]
// Raster Calc Node -> bg-[#FEF3C7]
// Raster Node      -> bg-[#F1CBCB]

export const CriteriaNode = memo(({ data }) => {
  const isRoot = data?.depth === 0;
  return (
    <div
      className={`min-w-[200px] max-w-[320px] rounded-xl p-3 shadow-md border transition-all hover:shadow-lg ${isRoot
        ? 'bg-[#E9F3F0] text-slate-900 border-[#63ab91]/60'
        : 'bg-[#F4F7FE] text-slate-900 border-[#7aa5da]/50'
        }`}
    >
      {data.depth > 0 && (
        <Handle
          type="target"
          position={Position.Left}
          className="!w-2.5 !h-2.5 !bg-[#208661] !border-2 !border-white"
        />
      )}

      <div className="flex items-center gap-2 mb-1">
        <Shield size={16} className={isRoot ? 'text-[#208661]' : 'text-[#417ec9]'} />
        <span className="font-bold text-xs text-slate-900 leading-tight">{data.label}</span>
      </div>

      <span className="text-[10px] font-semibold text-slate-500 block">
        {isRoot ? 'Goal / Root Assessment' : `Level ${data.depth || 1} Criteria`}
      </span>

      {data.formula && (
        <div className="mt-2 p-1.5 rounded-lg bg-white/80 border border-slate-200/80 text-[10px] font-mono text-[#208661] font-semibold shadow-xs">
          Formula: {data.formula}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-[#208661] !border-2 !border-white"
      />
    </div>
  );
});

export const MetricNode = memo(({ data }) => (
  <div className="min-w-[190px] max-w-[300px] rounded-xl p-3 shadow-md border border-amber-200/80 bg-[#FFF8EC] text-amber-950 transition-all hover:shadow-lg">
    <Handle
      type="target"
      position={Position.Left}
      className="!w-2.5 !h-2.5 !bg-amber-500 !border-2 !border-white"
    />
    <div className="flex items-center gap-2 mb-1">
      <Layers size={16} className="text-amber-600" />
      <span className="font-bold text-xs text-amber-950 leading-tight">{data.label}</span>
    </div>
    <span className="text-[10px] font-semibold text-amber-700/80 block">Assessment Metric</span>
    <Handle
      type="source"
      position={Position.Right}
      className="!w-2.5 !h-2.5 !bg-amber-500 !border-2 !border-white"
    />
  </div>
));

export const QuestionNode = memo(({ data }) => (
  <div className="min-w-[190px] max-w-[300px] rounded-xl p-3 shadow-md border border-slate-300/80 bg-[#F5F5F5] text-slate-900 transition-all hover:shadow-lg">
    <Handle
      type="target"
      position={Position.Left}
      className="!w-2.5 !h-2.5 !bg-slate-600 !border-2 !border-white"
    />
    <div className="flex items-center gap-2 mb-1">
      <HelpCircle size={16} className="text-slate-600" />
      <span className="font-bold text-xs text-slate-900 leading-tight">{data.label}</span>
    </div>
    <span className="text-[10px] font-semibold text-slate-500 block">
      {data.depth === 4 ? 'Survey Column Name' : 'Survey Question Indicator'}
    </span>

    {data.formula && (
      <div className="mt-2 p-1.5 rounded-lg bg-white/80 border border-slate-200/80 text-[10px] font-mono text-[#208661] font-semibold shadow-xs">
        Mapped Column: {data.formula}
      </div>
    )}

    {data.choices && data.choices.length > 0 && (
      <div className="mt-2 space-y-1 text-[10px] bg-white/80 p-1.5 rounded-lg border border-slate-200">
        <span className="text-[9px] text-slate-500 uppercase tracking-wider block font-bold">Choice Score Mapping:</span>
        {data.choices.map((c, i) => (
          <div key={i} className="flex justify-between px-1 py-0.5 rounded text-slate-700 font-medium">
            <span>{c.name}</span>
            <span className="font-mono text-[#208661] font-bold">{c.score}</span>
          </div>
        ))}
      </div>
    )}

    {data.depth !== 4 && (
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-slate-600 !border-2 !border-white"
      />
    )}
  </div>
));

export const TextNode = memo(({ data }) => (
  <div className="min-w-[190px] max-w-[300px] rounded-xl p-3 shadow-md border border-indigo-200/80 bg-[#F0F4FF] text-indigo-950 transition-all hover:shadow-lg">
    <Handle
      type="target"
      position={Position.Left}
      className="!w-2.5 !h-2.5 !bg-indigo-600 !border-2 !border-white"
    />
    <div className="flex items-center gap-2 mb-1">
      <FileText size={16} className="text-indigo-600" />
      <span className="font-bold text-xs text-indigo-950 leading-tight">{data.label}</span>
    </div>
    <span className="text-[10px] font-semibold text-indigo-600/80 block">Text Field / Value</span>
  </div>
));

export const RasterCalcNode = memo(({ data }) => (
  <div className="min-w-[190px] max-w-[300px] rounded-xl p-3 shadow-md border border-amber-300 bg-[#FEF3C7] text-amber-950 transition-all hover:shadow-lg">
    <Handle
      type="target"
      position={Position.Left}
      className="!w-2.5 !h-2.5 !bg-amber-600 !border-2 !border-white"
    />
    <div className="flex items-center gap-2 mb-1">
      <Cpu size={16} className="text-amber-700" />
      <span className="font-bold text-xs text-amber-950 leading-tight">{data.label}</span>
    </div>
    <span className="text-[10px] font-semibold text-amber-800/80 block">Raster Calculation Engine</span>
    <Handle
      type="source"
      position={Position.Right}
      className="!w-2.5 !h-2.5 !bg-amber-600 !border-2 !border-white"
    />
  </div>
));

export const RasterNode = memo(({ data }) => (
  <div className="min-w-[190px] max-w-[300px] rounded-xl p-3 shadow-md border border-rose-300 bg-[#F1CBCB] text-rose-950 transition-all hover:shadow-lg">
    <Handle
      type="target"
      position={Position.Left}
      className="!w-2.5 !h-2.5 !bg-rose-600 !border-2 !border-white"
    />
    <div className="flex items-center gap-2 mb-1">
      <Globe size={16} className="text-rose-700" />
      <span className="font-bold text-xs text-rose-950 leading-tight">{data.label}</span>
    </div>
    <span className="text-[10px] font-semibold text-rose-800/80 block">GIS Raster Layer</span>
  </div>
));

export const nodeTypes = {
  criteria: CriteriaNode,
  metric: MetricNode,
  question: QuestionNode,
  text: TextNode,
  raster_calculation: RasterCalcNode,
  raster: RasterNode
};
