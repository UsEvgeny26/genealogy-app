'use client';

import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { User, Pencil, Link as LinkIcon, Trash2 } from 'lucide-react';

export const PersonNode = ({ data }) => {
  const isMale = data.gender === 'male' || data.gender === 'M';
  const isFemale = data.gender === 'female' || data.gender === 'F';
  const canEdit = data.canEdit ?? false;

  const borderClass = isMale ? 'border-blue-400 dark:border-blue-500'
    : isFemale ? 'border-pink-400 dark:border-pink-500'
    : 'border-gray-400 dark:border-slate-500';

  const avatarClass = isMale ? 'bg-blue-500' : isFemale ? 'bg-pink-500' : 'bg-gray-500';

  const visibleHandle = canEdit
    ? '!w-3 !h-3 !bg-gray-400 !border-2 !border-white dark:!border-slate-800 !opacity-40 hover:!opacity-100 hover:!bg-blue-500 hover:!w-4 hover:!h-4 transition-all duration-150'
    : '!w-1 !h-1 !border-0 !bg-transparent !opacity-0 !pointer-events-none';

  const hiddenHandle = '!w-1 !h-1 !border-0 !bg-transparent !opacity-0 !pointer-events-none';

  return (
    <div className={`group relative px-4 py-3 shadow-md rounded-xl bg-white dark:bg-slate-800 border-2 min-w-[190px] max-w-[220px] cursor-pointer transition-all hover:shadow-lg 
     ${borderClass} ${data.isDimmed ? 'opacity-20 grayscale' : 'opacity-100'}`}>
      
      {/* ВИДИМЫЙ handle снизу для создания новых связей */}
      <Handle id="bottom" type="source" position={Position.Bottom} className={visibleHandle} />
      
      {/* НЕВИДИМЫЕ handles для умной перерисовки связей */}
      <Handle id="top" type="source" position={Position.Top} className={hiddenHandle} />
      <Handle id="left" type="source" position={Position.Left} className={hiddenHandle} />
      <Handle id="right" type="source" position={Position.Right} className={hiddenHandle} />

      {canEdit && (
        <div className="absolute -top-3 right-2 flex gap-1 bg-white dark:bg-slate-800 shadow-sm border border-gray-200 dark:border-slate-700 rounded-lg p-1 opacity-90 group-hover:opacity-100 transition-opacity z-10">
          <button onClick={(e) => { e.stopPropagation(); data.onEdit(); }} className="p-1 text-gray-600 dark:text-slate-300 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-slate-700 rounded">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); data.onAddConnection(); }} className="p-1 text-gray-600 dark:text-slate-300 hover:text-green-600 hover:bg-gray-100 dark:hover:bg-slate-700 rounded">
            <LinkIcon className="w-3.5 h-3.5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); data.onDelete(); }} className="p-1 text-gray-600 dark:text-slate-300 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-slate-700 rounded">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0 ${avatarClass}`}>
          {data.photo_url ? <img src={data.photo_url} alt="" className="w-full h-full rounded-full object-cover" /> : <User className="w-5 h-5" />}
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-gray-800 dark:text-slate-100 text-sm leading-tight truncate" title={`${data.first_name || ''} ${data.last_name || ''}`.trim()}>
            {data.first_name} {data.last_name || ''}
          </div>
          {/* Блок с датами */}
          {data.is_alive === false ? (
            <div className="flex flex-col mt-0.5">
              <span className="text-[11px] text-gray-500 dark:text-slate-400 truncate leading-tight">
                {data.birth_date || '—'}
              </span>
              <span className="text-[11px] text-gray-500 dark:text-slate-400 truncate leading-tight">
                {data.death_date || '—'}
              </span>
            </div>
          ) : (
            data.birth_date && (
              <div className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5 truncate">
                {data.birth_date}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};