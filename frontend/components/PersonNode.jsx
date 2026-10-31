'use client';

import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { User, Pencil, Link as LinkIcon, Trash2 } from 'lucide-react';

// Позиции handles в зависимости от направления
const HANDLE_POSITIONS = {
  TB: { flowSource: Position.Bottom, flowTarget: Position.Top,    perpSource: Position.Right,  perpTarget: Position.Left },
  BT: { flowSource: Position.Top,    flowTarget: Position.Bottom, perpSource: Position.Right,  perpTarget: Position.Left },
  LR: { flowSource: Position.Right,  flowTarget: Position.Left,   perpSource: Position.Bottom, perpTarget: Position.Top },
  RL: { flowSource: Position.Left,   flowTarget: Position.Right,  perpSource: Position.Bottom, perpTarget: Position.Top },
};

export const PersonNode = ({ data }) => {
  const isMale = data.gender === 'male';
  const isFemale = data.gender === 'female';
  const isLoggedIn = data.isLoggedIn ?? false;
  const direction = data.layoutDirection || 'TB';
  const positions = HANDLE_POSITIONS[direction] || HANDLE_POSITIONS.TB;

  const borderClass = isMale ? 'border-blue-400' : isFemale ? 'border-pink-400' : 'border-gray-400';
  const avatarClass = isMale ? 'bg-blue-500' : isFemale ? 'bg-pink-500' : 'bg-gray-500';
  const showDeathRow = data.is_alive === false;

  // Видимая ручка — только для авторизованных
  const visibleHandle = isLoggedIn
    ? '!w-3 !h-3 !bg-gray-400 !border-2 !border-white !opacity-40 hover:!opacity-100 hover:!bg-blue-500 hover:!w-4 hover:!h-4 transition-all duration-150'
    : '!w-1 !h-1 !border-0 !bg-transparent !opacity-0 !pointer-events-none';

  // Скрытая ручка — только для рендера рёбер (брак)
  const hiddenHandle = '!w-1 !h-1 !border-0 !bg-transparent !opacity-0 !pointer-events-none';

  return (
    <div
      className={`group relative px-4 py-3 shadow-md rounded-xl bg-white border-2 min-w-[190px] max-w-[220px] cursor-pointer transition-all hover:shadow-lg ${borderClass}`}
    >
      {/* Flow-ось: по ней тянется создание связи (родитель-ребёнок) */}
      <Handle id="flow-source" type="source" position={positions.flowSource} className={visibleHandle} />
      <Handle id="flow-target" type="target" position={positions.flowTarget} className={visibleHandle} />

      {/* Перпендикулярная ось: для брака и крёстных */}
      <Handle id="perp-source" type="source" position={positions.perpSource} className={hiddenHandle} />
      <Handle id="perp-target" type="target" position={positions.perpTarget} className={hiddenHandle} />

      {isLoggedIn && (
        <div className="absolute -top-3 right-2 flex gap-1 bg-white shadow-sm border border-gray-200 rounded-lg p-1 opacity-90 group-hover:opacity-100 transition-opacity z-10">
          <button
            onClick={(e) => { e.stopPropagation(); data.onEdit(); }}
            title="Редактировать"
            className="p-1 text-gray-600 hover:text-blue-600 hover:bg-gray-100 rounded"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); data.onAddConnection(); }}
            title="Добавить связь"
            className="p-1 text-gray-600 hover:text-green-600 hover:bg-gray-100 rounded"
          >
            <LinkIcon className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); data.onDelete(); }}
            title="Удалить"
            className="p-1 text-gray-600 hover:text-red-600 hover:bg-gray-100 rounded"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0 ${avatarClass}`}>
          {data.photo_url ? (
            <img src={data.photo_url} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            <User className="w-5 h-5" />
          )}
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-gray-800 text-sm leading-tight truncate">
            {data.first_name} {data.last_name || ''}
          </div>
          {(data.birth_date || showDeathRow) && (
            <div className="text-[11px] text-gray-500 mt-0.5 truncate">
              {data.birth_date || '—'}{showDeathRow ? ' †' : ''}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};