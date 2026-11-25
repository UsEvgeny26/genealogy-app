'use client';

import React from 'react';
import { Handle, Position } from '@xyflow/react';

export const FAMILY_SIZE = 10;

export const FamilyNode = ({ data }) => {
  const status = data?.status || 'married';
  const hasBothSpouses = Boolean(data?.spouse1_id) && Boolean(data?.spouse2_id);
  const isDivorced = status === 'divorced' || status === 'widowed';
  const isPartners = status === 'partners';

  const bgClass = isDivorced || !hasBothSpouses ? 'bg-gray-400/40'
    : isPartners ? 'bg-indigo-400/50' : 'bg-rose-400/50';

  const hiddenHandle = '!w-1 !h-1 !border-0 !bg-transparent !opacity-0 !pointer-events-none';

  return (
    <div className={`relative transition-opacity duration-300 ${data.isDimmed ? 'opacity-20' : 'opacity-100'}`} style={{ width: FAMILY_SIZE, height: FAMILY_SIZE }}>
      <div className={`w-full h-full rounded-full shadow-sm ${bgClass}`} title={`Семья (${status})`} />
      
      <Handle id="top" type="source" position={Position.Top} className={hiddenHandle} />
      <Handle id="bottom" type="source" position={Position.Bottom} className={hiddenHandle} />
      <Handle id="left" type="source" position={Position.Left} className={hiddenHandle} />
      <Handle id="right" type="source" position={Position.Right} className={hiddenHandle} />
    </div>
  );
};