'use client';

import React from 'react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from '@xyflow/react';
import { X } from 'lucide-react';

export const CustomEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  selected,
  data,
}) => {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const handleDelete = (e) => {
    e.stopPropagation();
    e.preventDefault();
    data?.onRequestDelete?.(id);
  };

  // Выбранное ребро — толще, синее, с тенью
  const stroke = selected ? '#2563eb' : style.stroke || '#94a3b8';
  const strokeWidth = selected ? 3 : 2;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke,
          strokeWidth,
        }}
      />

      {/* Невидимая широкая полоса — увеличивает hitbox для клика по ребру */}
      <path
        d={edgePath}
        fill="none"
        strokeWidth={20}
        stroke="transparent"
        style={{ cursor: 'pointer' }}
      />

      {/* Крестик появляется только при selected — не исчезает при движении мыши */}
      {selected && data?.canDelete && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <button
              type="button"
              onClick={handleDelete}
              onMouseDown={(e) => e.stopPropagation()}
              className="w-6 h-6 flex items-center justify-center rounded-full bg-white border-2 border-blue-500 text-blue-600 hover:bg-blue-500 hover:text-white shadow-md transition-colors"
              title="Удалить связь"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};