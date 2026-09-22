import React from 'react';
import { DropZone } from '@puckeditor/core';
import {
  TrendingUp,
  TrendingDown,
  Minus as MinusIcon,
  Link as LinkIcon,
  ImageOff,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Lightbulb,
  Activity,
  FileText,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { ChartRenderer } from './ChartRenderer';

const STATUS_COLORS = {
  low: { bg: '#e6f4ea', text: '#137333', border: '#a8dab5' },
  moderate: { bg: '#fff8ec', text: '#92600a', border: '#fde3ad' },
  high: { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
  critical: { bg: '#fce8e6', text: '#c5221f', border: '#f5c2c0' },
};

const TREND_ICON = { up: TrendingUp, down: TrendingDown, flat: MinusIcon };

export const puckConfig = {
  categories: {
    layout: {
      label: 'Layout & Structure',
      components: ['Grid', 'Flex', 'Spacer'],
    },
    typography: {
      label: 'Typography',
      components: ['Heading', 'Text'],
    },
    visualization: {
      label: 'Risk Data & Visuals',
      components: ['KpiCard', 'Chart', 'Table', 'Map', 'AdditionalInfo'],
    },
    ui: {
      label: 'UI Elements',
      components: ['Card', 'Image'],
    },
    media: {
      label: 'Media & References',
      components: ['EmbedLink'],
    },
  },

  root: {
    fields: {
      title: { type: 'text', label: 'Scorecard Document Title' },
      layout_size: {
        type: 'select',
        label: 'Page Layout Size',
        options: [
          { label: 'A4 Page (Standard 210 × 297 mm)', value: 'a4' },
          { label: 'A3 Page (Large 297 × 420 mm)', value: 'a3' },
          { label: 'Full Width (Responsive)', value: 'full_width' },
        ],
      },
      layout: {
        type: 'select',
        label: 'Top-Level Layout',
        options: [
          { label: '2 Column Grid', value: 'grid-2' },
          { label: '3 Column Grid', value: 'grid-3' },
          { label: '1 Column Vertical Stack', value: 'flex' },
        ],
      },
      gap: { type: 'number', label: 'Cell Gap (px)', min: 0, max: 64 },
    },
    defaultProps: {
      title: 'Risk Scorecard',
      layout_size: 'a4',
      layout: 'grid-1',
      gap: 14,
    },
    render: ({ children, title, layout = 'grid-1', layout_size = 'a4', gap = 14 }) => {
      const isGrid = layout.startsWith('grid');
      const cols = layout === 'grid-3' ? 3 : layout === 'grid-2' ? 2 : 1;
      const sizeClasses = {
        a4: 'max-w-[800px] min-h-[1130px] shadow-lg border border-slate-200/80',
        a3: 'max-w-[1140px] min-h-[1600px] shadow-xl border border-slate-200/80',
        full_width: 'max-w-6xl shadow-sm border border-slate-200',
      }[layout_size] || 'max-w-[800px] min-h-[1130px] shadow-lg border border-slate-200/80';

      return (
        <div className="puck-canvas-wrapper w-full py-6 px-4 flex justify-center bg-slate-100/70 min-h-full overflow-y-auto">
          <div
            className={`puck-scorecard-doc w-full bg-white rounded-xl p-6 md:p-8 transition-all relative ${sizeClasses}`}
            style={
              isGrid && cols > 1
                ? {
                  display: 'grid',
                  gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                  gap: `${gap}px`,
                  alignItems: 'stretch',
                }
                : {
                  display: 'flex',
                  flexDirection: 'column',
                  gap: `${gap}px`,
                }
            }
          >
            {children}
          </div>
        </div>
      );
    },
  },

  components: {
    // ----------------- LAYOUT -----------------
    Grid: {
      label: 'Grid Container',
      fields: {
        columns: { type: 'number', label: 'Grid Columns (1-12)', min: 1, max: 12 },
        gap: { type: 'number', label: 'Grid Gap (px)', min: 0, max: 64 },
      },
      defaultProps: {
        columns: 2,
        gap: 12,
      },
      render: ({ columns = 2, gap = 12 }) => {
        const colNum = Math.max(1, Math.min(12, Number(columns) || 2));
        const itemBasisPercent = colNum > 1 ? `${(100 / colNum).toFixed(2)}%` : '100%';
        const minItemWidth = colNum >= 4 ? '150px' : colNum === 3 ? '180px' : '240px';

        return (
          <div className="scorecard-grid-container w-full col-span-full">
            <DropZone
              zone="children"
              minEmptyHeight={48}
              className="scorecard-grid-dropzone w-full flex flex-wrap items-stretch transition-all"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: `${gap}px`,
                alignItems: 'stretch',
                width: '100%',
                '--grid-item-basis': `calc(${itemBasisPercent} - ${gap}px)`,
                '--grid-item-min-width': minItemWidth,
              }}
            />
          </div>
        );
      },
    },

    Flex: {
      label: 'Flex Box Container',
      fields: {
        direction: {
          type: 'select',
          label: 'Flex Direction',
          options: [
            { label: 'Row (Horizontal with Wrap)', value: 'row' },
            { label: 'Column (Vertical)', value: 'column' },
          ],
        },
        wrap: {
          type: 'radio',
          label: 'Flex Wrap',
          options: [
            { label: 'Wrap onto next line', value: true },
            { label: 'No Wrap', value: false },
          ],
        },
        gap: { type: 'number', label: 'Item Gap (px)', min: 0, max: 64 },
        align: {
          type: 'select',
          label: 'Align Items',
          options: [
            { label: 'Stretch', value: 'stretch' },
            { label: 'Flex Start', value: 'flex-start' },
            { label: 'Center', value: 'center' },
            { label: 'Flex End', value: 'flex-end' },
          ],
        },
        justify: {
          type: 'select',
          label: 'Justify Content',
          options: [
            { label: 'Start', value: 'flex-start' },
            { label: 'Center', value: 'center' },
            { label: 'End', value: 'flex-end' },
            { label: 'Space Between', value: 'space-between' },
            { label: 'Space Around', value: 'space-around' },
          ],
        },
      },
      defaultProps: {
        direction: 'row',
        wrap: true,
        gap: 12,
        align: 'stretch',
        justify: 'flex-start',
      },
      render: ({ direction = 'row', wrap = true, gap = 12, align = 'stretch', justify = 'flex-start' }) => (
        <div className="scorecard-flex-container w-full col-span-full">
          <DropZone
            zone="children"
            minEmptyHeight={48}
            className="scorecard-flex-dropzone w-full transition-all"
            style={{
              display: 'flex',
              flexDirection: direction,
              flexWrap: wrap !== false ? 'wrap' : 'nowrap',
              gap: `${gap}px`,
              alignItems: align,
              justifyContent: justify,
              width: '100%',
            }}
          />
        </div>
      ),
    },

    Spacer: {
      label: 'Spacer / Divider',
      fields: {
        size: { type: 'number', label: 'Height (px)', min: 2, max: 100 },
        grow: {
          type: 'radio',
          label: 'Flex Grow',
          options: [
            { label: 'Fixed Size', value: false },
            { label: 'Auto Fill Space', value: true },
          ],
        },
      },
      defaultProps: {
        size: 8,
        grow: false,
      },
      render: ({ size = 8, grow = false }) => (
        <div
          className="scorecard-spacer col-span-full w-full flex items-center"
          style={{ height: `${Math.max(4, size)}px`, flexGrow: grow ? 1 : 0 }}
        >
          <div className="w-full border-t border-slate-100" />
        </div>
      ),
    },

    // ----------------- TYPOGRAPHY -----------------
    Heading: {
      label: 'Heading',
      fields: {
        content: { type: 'text', label: 'Heading Text' },
        level: {
          type: 'select',
          label: 'Heading Level',
          options: [
            { label: 'H1 - Document Title', value: 1 },
            { label: 'H2 - Section Header', value: 2 },
            { label: 'H3 - Subtitle / Group', value: 3 },
            { label: 'H4 - Small Label', value: 4 },
          ],
        },
        align: {
          type: 'select',
          label: 'Alignment',
          options: [
            { label: 'Left', value: 'left' },
            { label: 'Center', value: 'center' },
            { label: 'Right', value: 'right' },
          ],
        },
      },
      defaultProps: {
        content: 'Section Heading',
        level: 2,
        align: 'left',
      },
      render: ({ content = 'Section Heading', level = 2, align = 'left' }) => {
        if (level === 1) {
          return (
            <div className="w-full col-span-full pb-3 mb-3.5 border-b border-slate-200/90">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-widest text-[#208661] bg-[#e9f3f0] px-2 py-0.5 rounded-full inline-flex items-center gap-1 border border-[#63ab91]/30">
                  <ShieldCheck size={11} className="text-[#208661]" />
                  Risk Scorecard
                </span>
              </div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-snug mt-1.5" style={{ textAlign: align }}>
                {content || <span className="text-slate-300 italic">Untitled Scorecard</span>}
              </h1>
            </div>
          );
        }

        if (level === 2) {
          return (
            <div className="w-full col-span-full pt-2 pb-1 mb-2.5 flex items-center gap-2">
              <span className="w-1.5 h-3.5 bg-[#208661] rounded-full inline-block shrink-0" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800" style={{ textAlign: align }}>
                {content || <span className="text-slate-300 italic">Section Title</span>}
              </h2>
            </div>
          );
        }

        const Tag = `h${level}`;
        const sizeClass = level === 3 ? 'text-xs font-bold text-slate-700' : 'text-[11px] font-semibold text-slate-500 uppercase tracking-wide';
        return (
          <div className="w-full col-span-full py-0.5 mb-2">
            <Tag
              className={`${sizeClass} tracking-tight leading-snug`}
              style={{ textAlign: align }}
            >
              {content || <span className="text-slate-300 italic">Heading</span>}
            </Tag>
          </div>
        );
      },
    },

    Text: {
      label: 'Paragraph Text',
      fields: {
        content: { type: 'textarea', label: 'Body Text Content' },
        size: {
          type: 'select',
          label: 'Font Size',
          options: [
            { label: 'Small', value: 'sm' },
            { label: 'Regular (Medium)', value: 'md' },
            { label: 'Large', value: 'lg' },
          ],
        },
        align: {
          type: 'select',
          label: 'Alignment',
          options: [
            { label: 'Left', value: 'left' },
            { label: 'Center', value: 'center' },
            { label: 'Right', value: 'right' },
          ],
        },
        color: { type: 'text', label: 'Custom Text Color (Hex)' },
      },
      defaultProps: {
        content: 'Add descriptive observations, notes, or recommendations here.',
        size: 'md',
        align: 'left',
        color: '',
      },
      render: ({ content = '', size = 'md', align = 'left', color }) => {
        const sizeClass = size === 'lg' ? 'text-xs md:text-sm' : size === 'sm' ? 'text-[10px]' : 'text-[11px] md:text-xs';
        return (
          <div className="w-full col-span-full">
            <p
              className={`${sizeClass} text-slate-600 leading-normal font-normal`}
              style={{ textAlign: align, color: color || undefined }}
            >
              {content || <span className="text-slate-300 italic">Empty text</span>}
            </p>
          </div>
        );
      },
    },

    // ----------------- DATA VISUALIZATION -----------------
    KpiCard: {
      label: 'KPI Risk Card',
      fields: {
        label: { type: 'text', label: 'Metric Name / Indicator' },
        value: { type: 'number', label: 'Value / Score' },
        scaleMin: { type: 'number', label: 'Scale Minimum' },
        scaleMax: { type: 'number', label: 'Scale Maximum' },
        status: {
          type: 'select',
          label: 'Risk Severity Status',
          options: [
            { label: 'Low', value: 'low' },
            { label: 'Moderate', value: 'moderate' },
            { label: 'High', value: 'high' },
            { label: 'Critical', value: 'critical' },
          ],
        },
        trend: {
          type: 'select',
          label: 'Trend Direction',
          options: [
            { label: 'Flat (Neutral)', value: 'flat' },
            { label: 'Up (Increasing Risk)', value: 'up' },
            { label: 'Down (Decreasing Risk)', value: 'down' },
          ],
        },
        unit: { type: 'text', label: 'Unit (e.g. %, days)' },
      },
      defaultProps: {
        label: 'Risk Metric',
        value: 50,
        scaleMin: 0,
        scaleMax: 100,
        status: 'moderate',
        trend: 'flat',
        unit: '%',
      },
      render: ({ label = 'Indicator', value = 0, scaleMin = 0, scaleMax = 100, status = 'moderate', trend = 'flat', unit = '' }) => {
        const colors = STATUS_COLORS[status] || STATUS_COLORS.moderate;
        const TrendIcon = TREND_ICON[trend] || MinusIcon;
        const lo = Number(scaleMin) || 0;
        const hi = Number(scaleMax) || 100;
        const numVal = Number(value) || 0;
        const pct = hi > lo ? Math.max(0, Math.min(100, ((numVal - lo) / (hi - lo)) * 100)) : 0;

        return (
          <div
            className="scorecard-kpi-card w-full h-full rounded-xl border p-3.5 bg-gradient-to-b from-white to-slate-50/50 text-left shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between"
            style={{ borderColor: colors.border }}
          >
            <div className="flex items-start justify-between gap-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider leading-tight truncate">{label}</span>
              </div>
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide shrink-0"
                style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
              >
                {status}
              </span>
            </div>
            <div className="scorecard-kpi-value flex items-baseline gap-1 mt-1.5">
              <span className="text-2xl font-black text-slate-900 tracking-tight">{numVal}</span>
              {unit && <span className="text-xs font-semibold text-slate-500">{unit}</span>}
              <span className="text-[10px] text-slate-400 font-medium">/ {hi}</span>
              {trend && trend !== 'flat' && <TrendIcon size={13} className="ml-auto text-slate-400" />}
            </div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${pct}%`, background: colors.text }}
              />
            </div>
          </div>
        );
      },
    },

    Chart: {
      label: 'Vega-Lite Chart',
      fields: {
        title: { type: 'text', label: 'Chart Title' },
        chartType: {
          type: 'select',
          label: 'Chart Visualization Type',
          options: [
            { label: 'Bar Chart', value: 'bar' },
            { label: 'Grouped Bar', value: 'grouped_bar' },
            { label: 'Line Chart', value: 'line' },
            { label: 'Radar Chart', value: 'radar' },
          ],
        },
      },
      defaultProps: {
        title: 'Indicator Scores',
        chartType: 'bar',
      },
      render: ({ title = 'Indicator Scores', vegaLiteSpec, data, chartType = 'bar' }) => {
        const fallbackSpec = vegaLiteSpec || {
          $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
          title: title,
          width: 'container',
          height: 170,
          data: {
            values: Array.isArray(data) && data.length
              ? data
              : [
                { name: 'Hazard', score: 45 },
                { name: 'Vulnerability', score: 62 },
                { name: 'Exposure', score: 38 },
              ],
          },
          mark: { type: chartType === 'line' ? 'line' : 'bar', cornerRadiusTopLeft: 4, cornerRadiusTopRight: 4 },
          encoding: {
            x: { field: 'name', type: 'nominal', axis: { labelAngle: -25 } },
            y: { field: 'score', type: 'quantitative' },
            color: { value: '#208661' },
          },
        };

        return (
          <div className="scorecard-chart w-full col-span-full rounded-xl border border-slate-200/80 bg-white p-3.5 text-left shadow-2xs flex flex-col justify-between">
            {title && (
              <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-100">
                <h4 className="text-xs font-bold text-slate-800 tracking-wide uppercase truncate">{title}</h4>
                <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider shrink-0">{chartType}</span>
              </div>
            )}
            <div className="w-full">
              <ChartRenderer spec={fallbackSpec} />
            </div>
          </div>
        );
      },
    },

    Table: {
      label: 'Data Table',
      fields: {
        title: { type: 'text', label: 'Table Title' },
      },
      defaultProps: {
        title: 'Risk Indicators Breakdown',
        columns: ['Indicator', 'Score', 'Scale', 'Unit'],
        rows: [
          ['Flood Zone Status', '24.0', '0 – 30', '%'],
          ['Distance to River', '18.0', '0 – 30', '%'],
          ['Structural Integrity', '12.0', '0 – 35', '%'],
        ],
      },
      render: ({ title, columns = ['Indicator', 'Score'], rows = [] }) => (
        <div className="scorecard-table w-full col-span-full rounded-xl border border-slate-200/80 bg-white overflow-hidden text-left shadow-2xs flex flex-col justify-between">
          {title && (
            <div className="px-3.5 py-2 text-xs font-bold text-slate-800 border-b border-slate-100 bg-slate-50/60 tracking-wide uppercase">
              <span>{title}</span>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50/80 text-slate-500 border-b border-slate-100">
                  {columns.map((c, i) => (
                    <th key={i} className="text-left px-3 py-1.5 font-bold uppercase tracking-wider text-[9px] whitespace-nowrap">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={columns.length || 1} className="px-3 py-4 text-slate-400 text-center italic">
                      No rows available
                    </td>
                  </tr>
                )}
                {rows.map((row, ri) => (
                  <tr key={ri} className="hover:bg-slate-50/70 transition-colors">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-3 py-1.5 text-slate-700 whitespace-nowrap text-[11px] font-medium">
                        {String(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ),
    },

    // ----------------- DATA VISUALIZATION (EXTENDED) -----------------
    AdditionalInfo: {
      label: 'Additional Info / Attributes',
      fields: {
        title: { type: 'text', label: 'Section Title' },
      },
      defaultProps: {
        title: 'Facility & Survey Profile Attributes',
        items: [
          { key: 'Facility Name', value: 'Nilgunj Primary Health Center' },
          { key: 'Facility Type', value: 'Primary Health Clinic' },
          { key: 'Hazard Assessed', value: 'Monsoon Riverine Flood' },
          { key: 'Location / District', value: 'Chitwan District, Ward 4' },
        ],
      },
      render: ({ title = 'Additional Information', items = [] }) => {
        return (
          <div className="scorecard-additional-info w-full col-span-full rounded-xl border border-slate-200/80 bg-white p-3.5 text-left shadow-2xs">
            <div className="flex items-center gap-1.5 mb-2 pb-1.5 border-b border-slate-100">
              <h4 className="text-xs font-bold text-slate-800 tracking-wide uppercase">{title}</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {(!items || items.length === 0) ? (
                <p className="text-xs text-slate-400 italic col-span-full">No attributes defined</p>
              ) : (
                items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 py-1.5 px-2.5 rounded-lg bg-slate-50/80 border border-slate-100/90 hover:bg-slate-100/70 transition-colors"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-medium text-slate-600 text-[11px] truncate">{item.key || item.name}</span>
                    </div>
                    <span className="text-[11px] font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200/70 shadow-2xs shrink-0">
                      {String(item.value ?? '-')}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      },
    },

    Map: {
      label: 'Geospatial Map View',
      fields: {
        title: { type: 'text', label: 'Map Title' },
        baseLayer: {
          type: 'select',
          label: 'Base Map Style',
          options: [
            { label: 'OpenStreetMap Standard', value: 'osm' },
            { label: 'Satellite Hybrid', value: 'satellite' },
            { label: 'Terrain Relief', value: 'terrain' },
          ],
        },
        height: { type: 'number', label: 'Height (px)', min: 140, max: 600 },
      },
      defaultProps: {
        title: 'Hazard & Scope Map',
        bbox: [80.0, 26.0, 88.0, 30.0],
        baseLayer: 'osm',
        height: 190,
      },
      render: ({ title = 'Map View', bbox = [80.0, 26.0, 88.0, 30.0], baseLayer = 'osm', height = 190 }) => {
        const safeBbox = Array.isArray(bbox) && bbox.length >= 4 ? bbox : [80.0, 26.0, 88.0, 30.0];
        const centerLng = ((Number(safeBbox[0]) + Number(safeBbox[2])) / 2).toFixed(4);
        const centerLat = ((Number(safeBbox[1]) + Number(safeBbox[3])) / 2).toFixed(4);
        const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${safeBbox[0]}%2C${safeBbox[1]}%2C${safeBbox[2]}%2C${safeBbox[3]}&layer=mapnik&marker=${centerLat}%2C${centerLng}`;

        return (
          <div className="scorecard-map w-full col-span-full rounded-xl border border-slate-200/80 bg-white overflow-hidden text-left shadow-2xs flex flex-col justify-between">
            <div className="px-3.5 py-2 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-1.5">
                <MapPin size={14} className="text-[#208661]" />
                <h4 className="text-xs font-bold text-slate-800">{title}</h4>
              </div>
              <div className="flex items-center gap-2 text-[9px] text-slate-500 font-mono">
                <span>{centerLat}°N, {centerLng}°E</span>
                <span className="bg-[#e9f3f0] text-[#208661] font-bold px-1.5 py-0.5 rounded-full text-[9px] uppercase border border-[#63ab91]/30">
                  {baseLayer}
                </span>
              </div>
            </div>
            <div className="w-full relative bg-slate-100" style={{ height: `${height}px` }}>
              <iframe
                title={title}
                src={embedUrl}
                className="w-full h-full border-none"
                loading="lazy"
              />
              <div className="absolute bottom-2 left-2 pointer-events-none bg-white/95 backdrop-blur-xs px-2 py-0.5 rounded text-[8px] text-slate-600 border border-slate-200 shadow-2xs font-mono">
                Bounds: [{safeBbox.map((n) => Number(n).toFixed(2)).join(', ')}]
              </div>
            </div>
          </div>
        );
      },
    },

    // ----------------- UI ELEMENTS -----------------
    Card: {
      label: 'Content & Profile Card',
      fields: {
        title: { type: 'text', label: 'Card Title' },
        content: { type: 'textarea', label: 'Card Description / Narrative' },
        label: { type: 'text', label: 'Badge / Metric Label' },
        icon: {
          type: 'select',
          label: 'Card Icon',
        options: [
            { label: 'None', value: 'none' },
            { label: 'Building (Facility / Location)', value: 'building' },
            { label: 'Lightbulb (Recommendations)', value: 'lightbulb' },
            { label: 'Activity (Analytical Insights)', value: 'activity' },
            { label: 'Shield (Risk / Hazard)', value: 'shield' },
            { label: 'File (Documentation / Notes)', value: 'file' },
            { label: 'Alert (Warning / Critical)', value: 'alert' },
            { label: 'Check (Compliance / Passed)', value: 'check' },
          ],
        },
        status: {
          type: 'select',
          label: 'Risk Severity Status',
          options: [
            { label: 'Low', value: 'low' },
            { label: 'Moderate', value: 'moderate' },
            { label: 'High', value: 'high' },
            { label: 'Critical', value: 'critical' },
          ],
        },
        value: { type: 'number', label: 'Optional Metric Value' },
        unit: { type: 'text', label: 'Unit' },
      },
      defaultProps: {
        title: 'Facility Overview',
        content: 'Primary Health Clinic evaluated for hazard exposure and structural vulnerability.',
        label: 'Assessment Target',
        icon: 'none',
        status: 'moderate',
        value: null,
      },
      render: ({ title = 'Card Title', content = '', label = '', icon = 'none', status = 'moderate', value = null, unit = '', scaleMin = 0, scaleMax = 100 }) => {
        const colors = STATUS_COLORS[status] || STATUS_COLORS.moderate;
        const hasMetric = value !== null && value !== undefined && value !== '';
        const numVal = Number(value) || 0;
        const lo = Number(scaleMin) || 0;
        const hi = Number(scaleMax) || 100;
        const pct = hi > lo ? Math.max(0, Math.min(100, ((numVal - lo) / (hi - lo)) * 100)) : 0;

        const CARD_ICONS = {
          building: Building2,
          lightbulb: Lightbulb,
          activity: Activity,
          shield: ShieldAlert,
          file: FileText,
          alert: AlertTriangle,
          check: CheckCircle2,
        };
        const CardIcon = CARD_ICONS[icon] || null;

        return (
          <div
            className="scorecard-content-card w-full h-full rounded-xl border p-3.5 bg-white text-left shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between"
            style={{ borderColor: colors.border }}
          >
            <div>
              <div className="flex items-center justify-between gap-1.5 mb-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  {CardIcon && (
                    <div
                      className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                      style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
                    >
                      <CardIcon size={11} />
                    </div>
                  )}
                  {label ? (
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate">
                      {label}
                    </span>
                  ) : null}
                </div>
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide shrink-0"
                  style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
                >
                  {status}
                </span>
              </div>
              {title && <h3 className="text-sm font-bold text-slate-900 mb-1 leading-snug tracking-tight">{title}</h3>}
              {content && <p className="text-xs text-slate-600 leading-normal font-normal whitespace-pre-line">{content}</p>}
            </div>

            {hasMetric && (
              <div className="mt-2.5 pt-2 border-t border-slate-100">
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-extrabold text-slate-900 tracking-tight">{numVal} {unit}</span>
                  <span className="text-[9px] text-slate-400 font-medium">Scale: {lo} - {hi}</span>
                </div>
                <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${pct}%`, background: colors.text }}
                  />
                </div>
              </div>
            )}
          </div>
        );
      },
    },

    // ----------------- MEDIA & REFERENCES -----------------
    EmbedLink: {
      label: 'Embed Link',
      fields: {
        url: { type: 'text', label: 'Target URL' },
        label: { type: 'text', label: 'Link Title / Anchor' },
        description: { type: 'textarea', label: 'Link Description' },
      },
      defaultProps: {
        url: 'https://dastaa.org',
        label: 'View Field Assessment Guidelines',
        description: 'Reference source and documentation for local flood vulnerability.',
      },
      render: ({ url, label, description }) => (
        <a
          className="scorecard-link flex items-start gap-2.5 rounded-xl border border-slate-200/80 bg-white p-3 hover:border-[#208661] hover:bg-[#e9f3f0]/20 hover:shadow-2xs transition-all text-left group"
          href={url || '#'}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => !url && e.preventDefault()}
        >
          <div className="p-2 rounded-lg bg-[#e9f3f0] text-[#208661] shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
            <LinkIcon size={14} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-900 truncate group-hover:text-[#208661]">{label || 'Untitled link'}</div>
            {description && <div className="text-[11px] text-slate-600 mt-0.5 leading-snug">{description}</div>}
            <div className="text-[9px] text-slate-400 mt-0.5 truncate font-mono">{url || 'No URL specified'}</div>
          </div>
        </a>
      ),
    },

    Image: {
      label: 'Image / Snapshot',
      fields: {
        src: { type: 'text', label: 'Image Source URL' },
        alt: { type: 'text', label: 'Alt Text' },
        caption: { type: 'text', label: 'Caption' },
      },
      defaultProps: {
        src: '',
        alt: 'Scorecard illustration',
        caption: '',
      },
      render: ({ src, alt, caption }) => (
        <div className="scorecard-image rounded-xl border border-slate-200/80 bg-white overflow-hidden text-left shadow-2xs">
          {src ? (
            <img src={src} alt={alt || ''} className="w-full h-auto block object-cover max-h-64" />
          ) : (
            <div className="flex flex-col items-center justify-center gap-1.5 h-28 bg-slate-50 text-slate-400">
              <ImageOff size={20} className="text-slate-300" />
              <span className="text-[11px] font-medium">No image URL configured</span>
            </div>
          )}
          {caption && (
            <div className="px-3 py-1.5 text-[11px] text-slate-600 border-t border-slate-100 bg-slate-50/60">
              {caption}
            </div>
          )}
        </div>
      ),
    },
  },
};
