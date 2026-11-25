'use client';

import React from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  useNodes,
  getStraightPath,
  getSmoothStepPath,
} from '@xyflow/react';
import {
  getSmartEdge,
  svgDrawStraightLinePath,
} from '@tisoap/react-flow-smart-edge';
import { X } from 'lucide-react';
import { RELATION_CONFIG, RELATION_TYPES, DIVORCED_COLOR } from '@/lib/relation-config';

export const RelationEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  selected,
  data,
}) => {
  const kind = data?.kind || RELATION_TYPES.BIOLOGICAL_PARENT;
  const cfg = RELATION_CONFIG[kind] || RELATION_CONFIG[RELATION_TYPES.BIOLOGICAL_PARENT];

  const isDivorced = kind === RELATION_TYPES.MARRIAGE && data?.divorced;
  const baseColor = isDivorced ? DIVORCED_COLOR : cfg.color;

  const isDimmed = data?.isDimmed;
  const opacity = isDimmed ? 0.1 : 1;

  const nodes = useNodes();

  // Разделяем логику: для брака — прямая линия, для остальных — умный обход
  let edgePath;
  let labelX;
  let labelY;

  if (kind === RELATION_TYPES.MARRIAGE) {
    // Прямая линия для брака, чтобы FamilyNode всегда был на ней
    [edgePath, labelX, labelY] = getStraightPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
    });
  } else {
    // Умный обход для родитель-ребёнок и ассоциаций
    const smartEdge = getSmartEdge({
      sourcePosition,
      targetPosition,
      sourceX,
      sourceY,
      targetX,
      targetY,
      nodes,
      options: {
        nodePadding: 20,
        gridRatio: 10,
        drawEdge: svgDrawStraightLinePath, // 🔹 Прямые (ортогональные) линии
      },
    });

    if (smartEdge) {
      edgePath = smartEdge.svgPathString;
      labelX = smartEdge.edgeCenterX;
      labelY = smartEdge.edgeCenterY;
    } else {
      // Фолбэк, если путь не найден
      [edgePath, labelX, labelY] = getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
      });
    }
  }

  const stroke = selected ? '#1d4ed8' : baseColor;
  const strokeWidth = selected ? 3 : 2;

  const handleDelete = (e) => {
    e.stopPropagation();
    e.preventDefault();
    data?.onRequestDelete?.(id);
  };

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={cfg.arrow ? markerEnd : undefined}
        style={{
          stroke,
          strokeWidth,
          strokeDasharray: cfg.dashed ? '6 4' : undefined,
          opacity: opacity,
          transition: 'opacity 0.3s ease',
        }}
      />

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
              className="w-6 h-6 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 border-2 border-blue-500 text-blue-600 dark:text-blue-400 hover:bg-blue-500 dark:hover:bg-blue-600 hover:text-white shadow-md transition-colors"
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