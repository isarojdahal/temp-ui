'use client';

import React, { useState } from 'react';
import { GripVertical, Trash2, TrendingUp, TrendingDown, Minus as MinusIcon, Link as LinkIcon, ImageOff, Plus } from 'lucide-react';
import { ChartRenderer } from './ChartRenderer';

const STATUS_COLORS = {
  low: { bg: '#e6f4ea', text: '#137333', border: '#a8dab5' },
  moderate: { bg: '#fff8ec', text: '#92600a', border: '#fde3ad' },
  high: { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
  critical: { bg: '#fce8e6', text: '#c5221f', border: '#f5c2c0' },
};

const TREND_ICON = { up: TrendingUp, down: TrendingDown, flat: MinusIcon };

function parseDragData(e) {
  if (e && e.source) return e;
  if (typeof window !== 'undefined' && window.__scorecardPointerDrag) {
    return window.__scorecardPointerDrag;
  }
  try {
    const raw = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearPointerDrag() {
  if (typeof window !== 'undefined') delete window.__scorecardPointerDrag;
}

// A standalone drop target that is NEVER placed inside a CSS grid/flex
// container alongside real children - it always sits either as a sibling
// AFTER the styled grid/flex box, or replaces it entirely when empty. This
// is the key fix: this used to interleave thin "divider" elements as direct
// grid/flex children, which made the browser's auto-placement treat every
// divider as its own grid cell and pushed all real content into one column.
function EndDropZone({ orientation, onDropHere, label }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        setHover(true);
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setHover(true);
      }}
      onPointerEnter={() => {
        if (parseDragData(null)) setHover(true);
      }}
      onPointerUp={(e) => {
        const data = parseDragData(null);
        if (!data) return;
        e.preventDefault();
        e.stopPropagation();
        setHover(false);
        onDropHere(data);
        clearPointerDrag();
      }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setHover(false);
        onDropHere(e);
      }}
      className={`mt-2 flex items-center justify-center gap-1.5 rounded-lg border-2 border-dashed text-[11px] font-medium transition-colors ${
        hover ? 'border-[#208661] bg-[#e9f3f0] text-[#208661]' : 'border-slate-200 text-slate-300'
      } ${orientation === 'row' ? 'h-full min-h-[60px] px-4' : 'py-2.5'} scorecard-end-drop-zone`}
    >
      <Plus size={12} /> {label}
    </div>
  );
}

// Wraps a single real child. Adds a thin, ABSOLUTELY POSITIONED insertion
// indicator on the half of the wrapper closest to the pointer, based purely
// on drag position - this never adds an extra item to the parent's
// grid/flex layout because the indicator is positioned relative to this
// wrapper, not a flow sibling of it.
function ChildDropWrapper({ children, orientation, onDropBefore, onDropAfter, className = '' }) {
  const [side, setSide] = useState(null); // 'before' | 'after' | null

  return (
    <div
      className={`relative scorecard-child-wrapper ${className}`}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        const rect = e.currentTarget.getBoundingClientRect();
        const before =
          orientation === 'row'
            ? e.clientX - rect.left < rect.width / 2
            : e.clientY - rect.top < rect.height / 2;
        setSide(before ? 'before' : 'after');
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onPointerMove={(e) => {
        if (!parseDragData(null)) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const before =
          orientation === 'row'
            ? e.clientX - rect.left < rect.width / 2
            : e.clientY - rect.top < rect.height / 2;
        setSide(before ? 'before' : 'after');
      }}
      onPointerUp={(e) => {
        const data = parseDragData(null);
        if (!data) return;
        e.preventDefault();
        e.stopPropagation();
        const chosen = side;
        setSide(null);
        if (chosen === 'after') onDropAfter(data);
        else onDropBefore(data);
        clearPointerDrag();
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setSide(null);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const chosen = side;
        setSide(null);
        if (chosen === 'after') onDropAfter(e);
        else onDropBefore(e);
      }}
    >
      {side === 'before' && (
        <div
          className={
            orientation === 'row'
              ? 'absolute left-0 top-0 bottom-0 w-1 rounded bg-[#208661] z-20 pointer-events-none'
              : 'absolute left-0 right-0 top-0 h-1 rounded bg-[#208661] z-20 pointer-events-none'
          }
        />
      )}
      {children}
      {side === 'after' && (
        <div
          className={
            orientation === 'row'
              ? 'absolute right-0 top-0 bottom-0 w-1 rounded bg-[#208661] z-20 pointer-events-none'
              : 'absolute left-0 right-0 bottom-0 h-1 rounded bg-[#208661] z-20 pointer-events-none'
          }
        />
      )}
    </div>
  );
}

function KpiCardView({ props }) {
  const { label, value, scale = [0, 5], trend = 'flat', status = 'moderate', unit } = props;
  const colors = STATUS_COLORS[status] || STATUS_COLORS.moderate;
  const TrendIcon = TREND_ICON[trend] || MinusIcon;
  const [lo, hi] = scale;
  const pct = hi > lo ? Math.max(0, Math.min(100, ((value - lo) / (hi - lo)) * 100)) : 0;
  return (
    <div className="scorecard-kpi-card rounded-xl border p-3.5 bg-white text-left" style={{ borderColor: colors.border }}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-semibold text-slate-500 leading-tight">{label}</span>
        <span
          className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide shrink-0"
          style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
        >
          {status}
        </span>
      </div>
      <div className="scorecard-kpi-value flex items-baseline gap-1.5 mt-1.5">
        <span className="text-2xl font-bold text-slate-900">{value}</span>
        {unit && <span className="text-xs text-slate-400">{unit}</span>}
        <span className="text-[11px] text-slate-400">/ {hi}</span>
        <TrendIcon size={13} className="ml-1 text-slate-400" />
      </div>
      <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: colors.text }} />
      </div>
    </div>
  );
}

function TableView({ props }) {
  const { title, columns = [], rows = [] } = props;
  return (
    <div className="scorecard-table rounded-xl border border-slate-200 bg-white overflow-hidden text-left">
      {title && <div className="px-3 py-2 text-xs font-bold text-slate-700 border-b border-slate-100">{title}</div>}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50">
              {columns.map((c, i) => (
                <th key={i} className="text-left px-3 py-1.5 font-semibold text-slate-500 whitespace-nowrap">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length || 1} className="px-3 py-3 text-slate-400 text-center">
                  No rows
                </td>
              </tr>
            )}
            {rows.map((row, ri) => (
              <tr key={ri} className="border-t border-slate-100">
                {row.map((cell, ci) => (
                  <td key={ci} className="px-3 py-1.5 text-slate-700 whitespace-nowrap">
                    {String(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmbedLinkView({ props }) {
  const { url, label, description } = props;
  return (
    <a
      className="scorecard-link flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-3 hover:border-[#208661] transition-colors text-left"
      href={url || '#'}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => !url && e.preventDefault()}
    >
      <LinkIcon size={15} className="text-[#208661] mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-xs font-semibold text-slate-800 truncate">{label || 'Untitled link'}</div>
        {description && <div className="text-[11px] text-slate-500 mt-0.5">{description}</div>}
        <div className="text-[10px] text-slate-400 mt-0.5 truncate">{url || 'No URL set'}</div>
      </div>
    </a>
  );
}

function ImageView({ props }) {
  const { src, alt, caption } = props;
  return (
    <div className="scorecard-image rounded-xl border border-slate-200 bg-white overflow-hidden text-left">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt || ''} className="w-full h-auto block" />
      ) : (
        <div className="flex flex-col items-center justify-center gap-1.5 h-32 text-slate-300">
          <ImageOff size={22} />
          <span className="text-[10px]">No image source</span>
        </div>
      )}
      {caption && <div className="px-3 py-1.5 text-[11px] text-slate-500 border-t border-slate-100">{caption}</div>}
    </div>
  );
}

function LeafContent({ node }) {
  const { type, props } = node;
  switch (type) {
    case 'Text':
      return (
        <p
          className={`${props.size === 'lg' ? 'text-base' : props.size === 'sm' ? 'text-xs' : 'text-sm'} text-slate-700`}
          style={{ textAlign: props.align || 'left', color: props.color || undefined }}
        >
          {props.content || <span className="text-slate-300 italic">Empty text</span>}
        </p>
      );
    case 'Heading': {
      const Tag = `h${props.level || 2}`;
      const sizeClass = { 1: 'text-2xl', 2: 'text-xl', 3: 'text-base', 4: 'text-sm' }[props.level || 2];
      return (
        <Tag className={`${sizeClass} font-bold text-slate-900`} style={{ textAlign: props.align || 'left' }}>
          {props.content || <span className="text-slate-300 italic">Heading</span>}
        </Tag>
      );
    }
    case 'Spacer':
      return <div style={{ height: props.size ?? 16, flexGrow: props.grow ? 1 : 0 }} />;
    case 'KpiCard':
      return <KpiCardView props={props} />;
    case 'Chart':
      return (
        <div className="scorecard-chart">
          <ChartRenderer spec={props.vegaLiteSpec} />
        </div>
      );
    case 'Table':
      return <TableView props={props} />;
    case 'EmbedLink':
      return <EmbedLinkView props={props} />;
    case 'Image':
      return <ImageView props={props} />;
    default:
      return <div className="text-xs text-rose-500">Unknown component type: {type}</div>;
  }
}

function containerStyle(node) {
  const { type, props } = node;
  if (type === 'Grid') {
    return {
      display: 'grid',
      gridTemplateColumns: `repeat(${props.columns || 3}, minmax(0, 1fr))`,
      gap: `${props.gap ?? 16}px`,
      alignItems: 'start',
    };
  }
  return {
    display: 'flex',
    flexDirection: props.direction || 'column',
    gap: `${props.gap ?? 12}px`,
    flexWrap: props.wrap ? 'wrap' : 'nowrap',
    alignItems: props.align || 'stretch',
    justifyContent: props.justify || 'flex-start',
  };
}

export function ScorecardNode({
  node,
  path,
  selectedPath,
  onSelect,
  onDelete,
  onDropPaletteItem,
  onMoveNode,
  isRoot = false,
}) {
  const isSelected = selectedPath && selectedPath.join('.') === path.join('.');
  const isContainer = node.type === 'Grid' || node.type === 'Flex';
  // Orientation only ever affects which axis the insertion indicator uses;
  // Grid containers read top/bottom like a column layout since tree order
  // follows the grid's row-major auto-flow reading order.
  const orientation = node.type === 'Flex' && node.props?.direction === 'row' ? 'row' : 'column';

  const applyDrop = (index) => (eventOrData) => {
    const data = parseDragData(eventOrData);
    if (!data) return;
    if (data.source === 'palette') {
      onDropPaletteItem(path, index, data.componentType);
    } else if (data.source === 'canvas') {
      const fromPath = JSON.parse(data.fromPath);
      onMoveNode(fromPath, path, index);
    }
  };

  const children = node.children || [];

  return (
    <div
      className={`relative scorecard-node group/node ${isSelected ? 'scorecard-node-selected outline outline-2 outline-[#208661] outline-offset-2 rounded-xl' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(path);
      }}
    >
      {/* Floating toolbar - pointer-events-none by default so it can never
          intercept clicks meant for the content below it; only its buttons
          (each individually) re-enable pointer events. */}
      <div
        className={`scorecard-node-toolbar relative z-30 flex min-h-7 items-center justify-end gap-1 pb-1 opacity-0 group-hover/node:opacity-100 pointer-events-none transition-opacity ${isSelected ? 'opacity-100' : ''}`}
      >
        {!isRoot && (
          <span
            draggable={false}
            onPointerDown={() => {
              if (typeof window !== 'undefined') {
                window.__scorecardPointerDrag = { source: 'canvas', fromPath: JSON.stringify(path) };
              }
            }}
            onDragStart={(e) => {
              e.stopPropagation();
              const payload = JSON.stringify({ source: 'canvas', fromPath: JSON.stringify(path) });
              e.dataTransfer.setData('application/json', payload);
              e.dataTransfer.setData('text/plain', payload);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onClick={(e) => e.stopPropagation()}
            className="pointer-events-auto bg-white border border-slate-300 rounded p-1 cursor-grab active:cursor-grabbing shadow-sm"
            title="Drag to move"
          >
            <GripVertical size={11} className="text-slate-500" />
          </span>
        )}
        <span className="pointer-events-auto bg-slate-800 text-white text-[9px] font-bold px-1.5 py-1 rounded shadow-sm select-none">
          {node.type}
        </span>
        {!isRoot && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(path);
            }}
            className="pointer-events-auto bg-white border border-rose-200 text-rose-600 rounded p-1 hover:bg-rose-50 shadow-sm"
            title="Delete"
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>

      {isContainer ? (
        <div
          className={`scorecard-container ${isRoot ? 'scorecard-container-root' : ''} ${isSelected ? 'scorecard-container-selected' : ''} rounded-xl border-2 border-dashed p-3 ${isSelected ? 'border-[#208661]/60 bg-[#e9f3f0]/30' : 'border-slate-200 bg-slate-50/40'}`}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          }}
          onPointerUp={(e) => {
            const data = parseDragData(null);
            if (!data) return;
            e.preventDefault();
            e.stopPropagation();
            applyDrop(children.length)(data);
            clearPointerDrag();
          }}
          onDrop={applyDrop(children.length)}
        >
          {children.length === 0 ? (
            <EndDropZone orientation={orientation} onDropHere={applyDrop(0)} label="Drop components here" />
          ) : (
            <>
              <div className={isRoot ? 'scorecard-root-grid' : ''} style={containerStyle(node)}>
                {children.map((child, i) => (
                  <ChildDropWrapper
                    key={child.id || i}
                    orientation={orientation}
                    onDropBefore={applyDrop(i)}
                    onDropAfter={applyDrop(i + 1)}
                    className={isRoot ? `scorecard-root-child scorecard-root-child-${child.type.toLowerCase()}` : ''}
                  >
                    <ScorecardNode
                      node={child}
                      path={[...path, i]}
                      selectedPath={selectedPath}
                      onSelect={onSelect}
                      onDelete={onDelete}
                      onDropPaletteItem={onDropPaletteItem}
                      onMoveNode={onMoveNode}
                    />
                  </ChildDropWrapper>
                ))}
              </div>
              {/* Sibling of the styled grid/flex box, never a child of it -
                  this cannot corrupt the column/row layout above. */}
              <EndDropZone orientation="column" onDropHere={applyDrop(children.length)} label="Add to end" />
            </>
          )}
        </div>
      ) : (
        <div
          draggable={false}
          onPointerDown={() => {
            if (!isRoot && typeof window !== 'undefined') {
              window.__scorecardPointerDrag = { source: 'canvas', fromPath: JSON.stringify(path) };
            }
          }}
          onDragStart={(e) => {
            e.stopPropagation();
            const payload = JSON.stringify({ source: 'canvas', fromPath: JSON.stringify(path) });
            e.dataTransfer.setData('application/json', payload);
            e.dataTransfer.setData('text/plain', payload);
            e.dataTransfer.effectAllowed = 'move';
          }}
        >
          <LeafContent node={node} />
        </div>
      )}
    </div>
  );
}

export function ScorecardCanvas({ root, selectedPath, onSelect, onDelete, onDropPaletteItem, onMoveNode }) {
  return (
    <div className="scorecard-canvas min-h-full w-full p-6" onClick={() => onSelect([])} onDragOver={(e) => e.preventDefault()}>
      <div className="scorecard-canvas-inner max-w-5xl mx-auto">
        <ScorecardNode
          node={root}
          path={[]}
          selectedPath={selectedPath}
          onSelect={onSelect}
          onDelete={onDelete}
          onDropPaletteItem={onDropPaletteItem}
          onMoveNode={onMoveNode}
          isRoot
        />
      </div>
    </div>
  );
}
