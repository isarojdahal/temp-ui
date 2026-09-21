'use client';

import React, { useEffect, useRef, useState } from 'react';

function isFiniteValue(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function normalizeChartSpec(inputSpec) {
  const spec = JSON.parse(
    JSON.stringify(inputSpec, (_, value) => (typeof value === 'number' ? (isFiniteValue(value) ? value : null) : value))
  );

  if (typeof spec.$schema === 'string') {
    spec.$schema = spec.$schema.replace('/vega-lite/v5.json', '/vega-lite/v6.json');
  }

  const rows = Array.isArray(spec.data?.values) ? spec.data.values : [];
  if (rows.length && spec.encoding) {
    Object.entries(spec.encoding).forEach(([channel, encoding]) => {
      if (!encoding?.field || encoding.type !== 'quantitative') return;
      const hasFiniteValue = rows.some((row) => isFiniteValue(row?.[encoding.field]));
      if (!hasFiniteValue) delete spec.encoding[channel];
    });
  }

  return spec;
}

// Renders a Chart node's server-built vegaLiteSpec. vega-embed touches the
// DOM directly, so it is dynamically imported inside an effect rather than
// imported at module scope, keeping this component safe under Next.js SSR.
export function ChartRenderer({ spec, height = 260 }) {
  const containerRef = useRef(null);
  const viewRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      if (!spec || !containerRef.current) return;
      try {
        const normalizedSpec = normalizeChartSpec(spec);
        const vegaEmbed = (await import('vega-embed')).default;
        if (cancelled || !containerRef.current) return;

        if (viewRef.current) {
          viewRef.current.finalize();
          viewRef.current = null;
        }

        const result = await vegaEmbed(containerRef.current, normalizedSpec, {
          actions: false,
          renderer: 'svg',
        });
        if (cancelled) {
          result.view.finalize();
          return;
        }
        viewRef.current = result.view;
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Failed to render chart');
      }
    }

    render();
    return () => {
      cancelled = true;
      if (viewRef.current) {
        viewRef.current.finalize();
        viewRef.current = null;
      }
    };
  }, [spec]);

  if (!spec) {
    return (
      <div className="flex items-center justify-center h-[200px] text-xs text-slate-400 border border-dashed border-slate-300 rounded-lg">
        No chart data
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="text-[11px] text-rose-600 mb-1">Chart render error: {error}</div>
      )}
      <div ref={containerRef} style={{ minHeight: height, width: '100%' }} />
    </div>
  );
}
