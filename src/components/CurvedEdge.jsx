'use client';

import React from 'react';

// Curved edge component for smooth Bezier mind map connections
export const CurvedEdge = (props) => {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    style = {},
    data = {},
  } = props;

  // Configurable curvature (0.0 .. 1.0)
  const CURVATURE = typeof data?.curvature === 'number' ? data.curvature : 0.6;

  const MIN_OFFSET = 60;
  const horizontalDistance = Math.abs(targetX - sourceX);
  const controlOffset = Math.max(MIN_OFFSET, horizontalDistance * CURVATURE);

  // Bezier curve control points
  const cp1x = sourceX + controlOffset;
  const cp1y = sourceY;
  const cp2x = targetX - controlOffset;
  const cp2y = targetY;
  const d = `M ${sourceX},${sourceY} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${targetX},${targetY}`;

  const stroke = style?.stroke ?? data?.stroke ?? '#208661';
  const strokeWidth = style?.strokeWidth ?? data?.strokeWidth ?? 1.8;
  const strokeOpacity = style?.strokeOpacity ?? data?.strokeOpacity ?? 0.8;

  return (
    <g className="react-flow__edge-path">
      <path
        id={id}
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeOpacity={strokeOpacity}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
};
