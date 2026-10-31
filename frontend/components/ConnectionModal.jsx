'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { X, Search, Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import { fullName } from '@/lib/format';
import { RELATION_CONFIG, RELATION_TYPES } from '@/lib/relation-config';
import { useRelationActions } from '@/hooks/useRelationActions';

export const ConnectionModal = ({
  isOpen,
  sourcePerson,
  presetSourceId,
  presetTargetId,
  allPersons,
  onClose,
  onSuccess,
}) => {
  const [relationType, setRelationType] = useState(null);
  const [targetId, setTargetId] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const actions = useRelationActions();

  // true: соединение уже сделано drag'ом, направление известно
  // false: открыта кнопкой Link — пользователь выбирает второго человека
  const isDragMode = presetSourceId != null && presetTargetId != null;

  const sourceId = isDragMode ? presetSourceId : sourcePerson?.id;

  const source = useMemo(() => {
    const sid = Number(sourceId);
    return allPersons.find((p) => Number(p.id) === sid) || sourcePerson || null;
  }, [allPersons, sourceId, sourcePerson]);

  const target = useMemo(() => {
    if (!isDragMode) return null;
    const tid = Number(presetTargetId);
    return allPersons.find((p) => Number(p.id) === tid) || null;
  }, [allPersons, isDragMode, presetTargetId]);

  useEffect(() => {
    if (isOpen) {
      setRelationType(null);
      setTargetId('');
      setSearch('');
      setError(null);
      setBusy(false);
    }
  }, [isOpen, presetSourceId, presetTargetId]);

  const candidates = useMemo(() => {
    if (!source) return [];
    const sid = Number(source.id);
    const list = allPersons.filter((p) => Number(p.id) !== sid);
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter((p) => fullName(p).toLowerCase().includes(q));
  }, [allPersons, source, search]);

  if (!isOpen || !source) return null;

  // === Опции в drag-режиме ===
  // Направление уже известно: source (bottom) = родитель, target (top) = ребёнок.
  const dragOptions = [
    {
      id: 'parent_child',
      label: 'Родитель-ребёнок',
      cfg: RELATION_CONFIG[RELATION_TYPES.BIOLOGICAL_PARENT],
    },
    {
      id: 'adoptive_parent_child',
      label: 'Приёмный родитель-ребёнок',
      cfg: RELATION_CONFIG[RELATION_TYPES.ADOPTIVE_PARENT],
    },
    {
      id: 'spouse',
      label: 'Супруг(а)',
      cfg: RELATION_CONFIG[RELATION_TYPES.MARRIAGE],
    },
    {
      id: 'godparent',
      label: 'Крёстный-крестник',
      cfg: RELATION_CONFIG[RELATION_TYPES.GODPARENT],
    },
  ];

  // === Опции в режиме кнопки Link ===
  // Здесь направление неизвестно — показываем явно, кем будет выбранный человек.
  const buttonOptions = [
    { id: 'parent',          label: 'Родитель',          cfg: RELATION_CONFIG[RELATION_TYPES.BIOLOGICAL_PARENT] },
    { id: 'child',           label: 'Ребёнок',           cfg: RELATION_CONFIG[RELATION_TYPES.BIOLOGICAL_PARENT] },
    { id: 'adoptive_parent', label: 'Приёмный родитель', cfg: RELATION_CONFIG[RELATION_TYPES.ADOPTIVE_PARENT] },
    { id: 'adoptive_child',  label: 'Приёмный ребёнок',  cfg: RELATION_CONFIG[RELATION_TYPES.ADOPTIVE_PARENT] },
    { id: 'spouse',          label: 'Супруг(а)',         cfg: RELATION_CONFIG[RELATION_TYPES.MARRIAGE] },
    { id: 'godparent',       label: 'Крёстный',          cfg: RELATION_CONFIG[RELATION_TYPES.GODPARENT] },
    { id: 'godchild',        label: 'Крестник/ца',       cfg: RELATION_CONFIG[RELATION_TYPES.GODPARENT] },
  ];

  const options = isDragMode ? dragOptions : buttonOptions;
  const finalTargetId = isDragMode ? presetTargetId : targetId;

  const handleSubmit = async () => {
    if (!relationType || !finalTargetId) return;
    const sid = Number(sourceId);
    const tid = Number(finalTargetId);
    setBusy(true);
    setError(null);

    try {
      switch (relationType) {
        // --- drag-режим: sid — родитель, tid — ребёнок ---
        case 'parent_child':
          await actions.createParentChild(sid, tid, 'biological');
          break;
        case 'adoptive_parent_child':
          await actions.createParentChild(sid, tid, 'adoptive');
          break;
        case 'spouse':
          await actions.createMarriage(sid, tid);
          break;
        case 'godparent':
          // sid — крёстный, tid — крестник
          await actions.createRelation('godparent', sid, tid);
          break;

        // --- режим кнопки: направление по выбранной опции ---
        case 'parent':
          // выбранный человек — родитель для source
          await actions.createParentChild(tid, sid, 'biological');
          break;
        case 'child':
          // выбранный человек — ребёнок для source
          await actions.createParentChild(sid, tid, 'biological');
          break;
        case 'adoptive_parent':
          await actions.createParentChild(tid, sid, 'adoptive');
          break;
        case 'adoptive_child':
          await actions.createParentChild(sid, tid, 'adoptive');
          break;
        case 'godparent':
          // выбранный человек — крёстный для source
          await actions.createRelation('godparent', tid, sid);
          break;
        case 'godchild':
          // выбранный человек — крестник для source
          await actions.createRelation('godparent', sid, tid);
          break;
      }
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Не удалось создать связь');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-lg text-gray-800">Новая связь</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Кто с кем */}
          <div className="flex items-center gap-2 text-sm bg-slate-50 rounded-xl p-3 min-h-[52px]">
            <span className="font-semibold text-gray-800 truncate">{fullName(source)}</span>
            <ArrowRight className="w-4 h-4 text-gray-400 shrink-0" />
            {isDragMode && target ? (
              <span className="font-semibold text-gray-800 truncate">{fullName(target)}</span>
            ) : (
              <span className="text-gray-400 italic">выберите человека ниже</span>
            )}
          </div>

          {/* Подсказка для drag-режима */}
          {isDragMode && target && (
            <p className="text-xs text-gray-500 -mt-2">
              «{fullName(source)}» — верхний якорь связи, «{fullName(target)}» — нижний.
              Для «родитель-ребёнок» первый будет родителем, второй — ребёнком.
            </p>
          )}

          {/* Тип связи */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">
              {isDragMode
                ? 'Тип связи'
                : 'Кем будет выбранный человек по отношению к ' + fullName(source) + '?'}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {options.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setRelationType(opt.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-xs font-medium transition-colors text-left ${
                    relationType === opt.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ background: opt.cfg.color }}
                  />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Выбор человека — только в режиме кнопки Link */}
          {!isDragMode && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">Кто?</label>
              <div className="relative mb-2">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Поиск..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="max-h-56 overflow-y-auto border border-gray-200 rounded-lg">
                {candidates.length === 0 ? (
                  <div className="p-3 text-xs text-gray-400 text-center">Никого не найдено</div>
                ) : (
                  candidates.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setTargetId(p.id)}
                      className={`w-full text-left px-3 py-2 text-sm border-b border-gray-100 last:border-b-0 transition-colors ${
                        String(targetId) === String(p.id)
                          ? 'bg-blue-50 text-blue-800'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      {fullName(p)}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-800">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!relationType || !finalTargetId || busy}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            Создать
          </button>
        </div>
      </div>
    </div>
  );
};