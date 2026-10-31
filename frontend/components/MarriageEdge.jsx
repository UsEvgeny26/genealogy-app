'use client';

import React from 'react';
import { BaseEdge, EdgeLabelRenderer, getStraightPath } from '@xyflow/react';
import { X } from 'lucide-react';

export const MarriageEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  selected,
  data,
}) => {
  const [edgePath, labelX, labelY] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  const handleDelete = (e) => {
    e.stopPropagation();
    e.preventDefault();
    data?.onRequestDelete?.(id);
  };

  const stroke = selected ? '#e11d48' : '#fb7185';
  const strokeWidth = selected ? 3 : 2;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke,
          strokeWidth,
          strokeDasharray: '6 4',
        }}
      />

      {/* Невидимая широкая полоса для клика */}
      <path
        d={edgePath}
        fill="none"
        strokeWidth={20}
        stroke="transparent"
        style={{ cursor: 'pointer' }}
      />

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
              className="w-6 h-6 flex items-center justify-center rounded-full bg-white border-2 border-rose-500 text-rose-600 hover:bg-rose-500 hover:text-white shadow-md transition-colors"
              title="Удалить брак"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};