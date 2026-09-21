'use client';

import React from 'react';
import {
  Grid3x3,
  Columns,
  Minus,
  Type,
  Heading,
  BarChart3,
  Table,
  Link as LinkIcon,
  Gauge,
  Image as ImageIcon,
  Square,
} from 'lucide-react';

const ICONS = {
  grid: Grid3x3,
  columns: Columns,
  minus: Minus,
  type: Type,
  heading: Heading,
  'bar-chart': BarChart3,
  table: Table,
  link: LinkIcon,
  gauge: Gauge,
  image: ImageIcon,
};

export function ScorecardPalette({ registry }) {
  if (!registry) {
    return <div className="text-xs text-slate-400 px-1">Loading component registry...</div>;
  }

  return (
    <div className="space-y-5">
      {registry.categories.map((cat) => (
        <div key={cat.id}>
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2 px-0.5">
            {cat.label}
          </div>
          <div className="space-y-1.5">
            {cat.components.map((comp) => {
              const Icon = ICONS[comp.icon] || Square;
              return (
                <div
                  key={comp.type}
                  draggable={false}
                  onPointerDown={() => {
                    if (typeof window !== 'undefined') {
                      window.__scorecardPointerDrag = { source: 'palette', componentType: comp.type };
                    }
                  }}
                  onPointerCancel={() => {
                    if (typeof window !== 'undefined') delete window.__scorecardPointerDrag;
                  }}
                  onPointerUp={() => {
                    if (typeof window !== 'undefined') delete window.__scorecardPointerDrag;
                  }}
                  onDragStart={(e) => {
                    const payload = JSON.stringify({ source: 'palette', componentType: comp.type });
                    e.dataTransfer.setData('application/json', payload);
                    e.dataTransfer.setData('text/plain', payload);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-slate-200 bg-white hover:border-[#208661] hover:bg-[#e9f3f0] cursor-grab active:cursor-grabbing transition-colors select-none"
                  title={comp.description}
                >
                  <Icon size={14} className="text-[#208661] shrink-0" />
                  <span className="text-xs font-medium text-slate-700">{comp.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
