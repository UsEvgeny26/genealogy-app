'use client';

import React from 'react';
import { Handle, Position } from '@xyflow/react';

export const FAMILY_SIZE = 10;

const SOURCE_POS = {
  TB: Position.Bottom,
  BT: Position.Top,
  LR: Position.Right,
  RL: Position.Left,
};

export const FamilyNode = ({ data }) => {
  const direction = data?.layoutDirection || 'TB';
  const sourcePos = SOURCE_POS[direction] || SOURCE_POS.TB;
  const status = data?.status || 'married';

  const hasBothSpouses = Boolean(data?.spouse1_id) && Boolean(data?.spouse2_id);
  const isDivorced = status === 'divorced' || status === 'widowed';
  const isPartners = status === 'partners';

  const bgClass =
    isDivorced || !hasBothSpouses
      ? 'bg-gray-400/40'
      : isPartners
        ? 'bg-indigo-400/50'
        : 'bg-rose-400/50';

  return (
    <div
      className="relative"
      style={{ width: FAMILY_SIZE, height: FAMILY_SIZE }}
    >
      <div
        className={`w-full h-full rounded-full shadow-sm ${bgClass}`}
        title={`Семья (${status})`}
      />
      <Handle
        id="flow-source"
        type="source"
        position={sourcePos}
        className="!w-1 !h-1 !border-0 !bg-transparent !opacity-0 !pointer-events-none"
      />
    </div>
  );
};