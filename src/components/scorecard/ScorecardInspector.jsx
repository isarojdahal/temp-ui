'use client';

import React, { useState } from 'react';
import { Info, Check, RotateCcw } from 'lucide-react';

function Field({ label, children }) {
  return (
    <label className="block mb-3">
      <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">{label}</span>
      {children}
    </label>
  );
}

const inputCls = 'input-rich';
const textareaCls = 'input-rich font-mono text-[11px]';
const PERCENT_MIN = 0;
const PERCENT_MAX = 100;

function TextInput({ value, onChange, placeholder }) {
  return (
    <input
      type="text"
      className={inputCls}
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function NumberInput({ value, onChange, min, max, step }) {
  const handleChange = (event) => {
    if (event.target.value === '') {
      onChange(min ?? 0);
      return;
    }

    const number = Number(event.target.value);
    if (!Number.isFinite(number)) return;
    onChange(Math.min(max ?? number, Math.max(min ?? number, number)));
  };

  return (
    <input
      type="number"
      className={inputCls}
      value={value ?? 0}
      min={min}
      max={max}
      step={step ?? 1}
      onChange={handleChange}
    />
  );
}

function SelectInput({ value, onChange, options }) {
  return (
    <select className={inputCls} value={value ?? options[0]} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function CheckboxInput({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

// A textarea bound to a JSON value: keeps free-typed text in local state so
// invalid-but-in-progress JSON doesn't get clobbered, and only commits
// upstream (and shows a parse error) once the text parses. The parent
// remounts this (via a `key` tied to the selected node's path) whenever the
// selection changes, so local state never needs to be synced from props.
function JsonTextarea({ value, onCommit, rows = 5 }) {
  const [text, setText] = useState(() => JSON.stringify(value ?? [], null, 2));
  const [error, setError] = useState(null);

  return (
    <div>
      <textarea
        className={textareaCls}
        rows={rows}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          try {
            const parsed = JSON.parse(e.target.value);
            setError(null);
            onCommit(parsed);
          } catch {
            setError('Invalid JSON - not yet saved');
          }
        }}
      />
      {error && <div className="text-[10px] text-amber-600 mt-1">{error}</div>}
    </div>
  );
}

export function ScorecardInspector({ node, path, onChangeProps, registryEntry }) {
  // Edits are buffered locally and only pushed to the canvas when "Apply
  // changes" is pressed. The parent remounts this component (via a `key`
  // tied to the selected node's path) whenever the selection changes, so
  // this local buffer always starts fresh for whichever node is selected -
  // switching nodes without applying simply discards the unsaved edit.
  const [localProps, setLocalProps] = useState(() => node?.props || {});
  const [dirty, setDirty] = useState(false);

  if (!node) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4 py-10 text-slate-400">
        <Info size={20} className="mb-2" />
        <p className="text-xs">Select a component on the canvas to edit its properties.</p>
      </div>
    );
  }

  const props = localProps;
  const set = (patch) => {
    setLocalProps((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  };

  const handleApply = () => {
    onChangeProps(localProps);
    setDirty(false);
  };

  const handleDiscard = () => {
    setLocalProps(node.props || {});
    setDirty(false);
  };

  return (
    <div className="p-4 pb-4 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            {registryEntry?.category?.replace('_', ' ') || 'component'}
          </div>
          <div className="text-sm font-bold text-slate-800">{registryEntry?.label || node.type}</div>
        </div>
        {dirty && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wide">
            Unapplied
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">

      {node.type === 'Grid' && (
        <>
          <Field label="Columns">
            <NumberInput value={props.columns} min={1} max={12} onChange={(v) => set({ columns: v })} />
          </Field>
          <Field label="Gap (px)">
            <NumberInput value={props.gap} min={0} max={64} onChange={(v) => set({ gap: v })} />
          </Field>
        </>
      )}

      {node.type === 'Flex' && (
        <>
          <Field label="Direction">
            <SelectInput value={props.direction} options={['row', 'column']} onChange={(v) => set({ direction: v })} />
          </Field>
          <Field label="Gap (px)">
            <NumberInput value={props.gap} min={0} max={64} onChange={(v) => set({ gap: v })} />
          </Field>
          <Field label="Align">
            <SelectInput
              value={props.align}
              options={['stretch', 'flex-start', 'center', 'flex-end']}
              onChange={(v) => set({ align: v })}
            />
          </Field>
          <Field label="Justify">
            <SelectInput
              value={props.justify}
              options={['flex-start', 'center', 'flex-end', 'space-between', 'space-around']}
              onChange={(v) => set({ justify: v })}
            />
          </Field>
          <CheckboxInput checked={props.wrap} onChange={(v) => set({ wrap: v })} label="Wrap children" />
        </>
      )}

      {node.type === 'Spacer' && (
        <>
          <Field label="Size (px)">
            <NumberInput value={props.size} min={0} max={200} onChange={(v) => set({ size: v })} />
          </Field>
          <CheckboxInput checked={props.grow} onChange={(v) => set({ grow: v })} label="Grow to fill space" />
        </>
      )}

      {node.type === 'Text' && (
        <>
          <Field label="Content">
            <textarea
              className={inputCls}
              rows={3}
              value={props.content || ''}
              onChange={(e) => set({ content: e.target.value })}
            />
          </Field>
          <Field label="Align">
            <SelectInput value={props.align} options={['left', 'center', 'right']} onChange={(v) => set({ align: v })} />
          </Field>
          <Field label="Size">
            <SelectInput value={props.size} options={['sm', 'md', 'lg']} onChange={(v) => set({ size: v })} />
          </Field>
          <Field label="Color (optional, hex)">
            <TextInput value={props.color} placeholder="#0f172a" onChange={(v) => set({ color: v || null })} />
          </Field>
        </>
      )}

      {node.type === 'Heading' && (
        <>
          <Field label="Content">
            <TextInput value={props.content} onChange={(v) => set({ content: v })} />
          </Field>
          <Field label="Level">
            <SelectInput value={String(props.level)} options={['1', '2', '3', '4']} onChange={(v) => set({ level: Number(v) })} />
          </Field>
          <Field label="Align">
            <SelectInput value={props.align} options={['left', 'center', 'right']} onChange={(v) => set({ align: v })} />
          </Field>
        </>
      )}

      {node.type === 'KpiCard' && (
        <>
          {(() => {
            const scaleMin = props.scale?.[0] ?? PERCENT_MIN;
            const scaleMax = props.scale?.[1] ?? PERCENT_MAX;
            const value = props.value ?? scaleMin;

            return (
              <>
          <Field label="Label">
            <TextInput value={props.label} onChange={(v) => set({ label: v })} />
          </Field>
          <Field label="Value">
            <NumberInput value={value} min={scaleMin} max={scaleMax} step={0.1} onChange={(v) => set({ value: v })} />
          </Field>
          <Field label="Scale min / max">
            <div className="flex gap-2">
              <NumberInput
                value={scaleMin}
                min={PERCENT_MIN}
                max={Math.min(scaleMax, value)}
                onChange={(v) => set({ scale: [Math.min(v, Math.min(scaleMax, value)), scaleMax] })}
              />
              <NumberInput
                value={scaleMax}
                min={Math.max(scaleMin, value)}
                max={PERCENT_MAX}
                onChange={(v) => set({ scale: [scaleMin, Math.max(v, Math.max(scaleMin, value))] })}
              />
            </div>
          </Field>
          <Field label="Trend">
            <SelectInput value={props.trend} options={['up', 'down', 'flat']} onChange={(v) => set({ trend: v })} />
          </Field>
          <Field label="Status">
            <SelectInput value={props.status} options={['low', 'moderate', 'high', 'critical']} onChange={(v) => set({ status: v })} />
          </Field>
          <Field label="Unit (optional)">
            <TextInput value={props.unit} onChange={(v) => set({ unit: v || null })} />
          </Field>
              </>
            );
          })()}
        </>
      )}

      {node.type === 'Chart' && (
        <>
          <Field label="Chart type">
            <SelectInput
              value={props.chartType}
              options={['bar', 'grouped_bar', 'line', 'radar']}
              onChange={(v) => set({ chartType: v })}
            />
          </Field>
          <Field label="Title">
            <TextInput value={props.title} onChange={(v) => set({ title: v })} />
          </Field>
          <Field label="X field">
            <TextInput value={props.xField} onChange={(v) => set({ xField: v })} />
          </Field>
          <Field label="Y field">
            <TextInput value={props.yField} onChange={(v) => set({ yField: v })} />
          </Field>
          {props.chartType === 'grouped_bar' && (
            <Field label="Series field">
              <TextInput value={props.seriesField} onChange={(v) => set({ seriesField: v })} />
            </Field>
          )}
          <Field label="Data (JSON array)">
            <JsonTextarea value={props.data} onCommit={(v) => set({ data: v })} rows={6} />
          </Field>
          <p className="text-[10px] text-slate-400 leading-snug">
            The chart spec itself is rebuilt by the server from a fixed template on save - only data and field
            names are editable here.
          </p>
        </>
      )}

      {node.type === 'Table' && (
        <>
          <Field label="Title">
            <TextInput value={props.title} onChange={(v) => set({ title: v })} />
          </Field>
          <Field label="Columns (comma separated)">
            <TextInput
              value={(props.columns || []).join(', ')}
              onChange={(v) => set({ columns: v.split(',').map((c) => c.trim()).filter(Boolean) })}
            />
          </Field>
          <Field label="Rows (JSON array of arrays)">
            <JsonTextarea value={props.rows} onCommit={(v) => set({ rows: v })} rows={6} />
          </Field>
        </>
      )}

      {node.type === 'EmbedLink' && (
        <>
          <Field label="URL">
            <TextInput value={props.url} placeholder="https://..." onChange={(v) => set({ url: v })} />
          </Field>
          <Field label="Label">
            <TextInput value={props.label} onChange={(v) => set({ label: v })} />
          </Field>
          <Field label="Description">
            <TextInput value={props.description} onChange={(v) => set({ description: v })} />
          </Field>
        </>
      )}

      {node.type === 'Image' && (
        <>
          <Field label="Image URL">
            <TextInput value={props.src} placeholder="https://..." onChange={(v) => set({ src: v })} />
          </Field>
          <Field label="Alt text">
            <TextInput value={props.alt} onChange={(v) => set({ alt: v })} />
          </Field>
          <Field label="Caption">
            <TextInput value={props.caption} onChange={(v) => set({ caption: v })} />
          </Field>
        </>
      )}
      </div>

      <div className="flex items-center gap-2 pt-3 mt-3 border-t border-slate-200 shrink-0">
        <button
          onClick={handleApply}
          disabled={!dirty}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-colors ${
            dirty ? 'bg-[#208661] text-white hover:bg-[#1a6d4f]' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
        >
          <Check size={13} /> Apply changes
        </button>
        <button
          onClick={handleDiscard}
          disabled={!dirty}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-2 px-3 text-xs font-semibold border transition-colors ${
            dirty ? 'border-slate-300 text-slate-600 hover:bg-slate-50' : 'border-slate-200 text-slate-300 cursor-not-allowed'
          }`}
          title="Discard unapplied edits"
        >
          <RotateCcw size={13} />
        </button>
      </div>
    </div>
  );
}
