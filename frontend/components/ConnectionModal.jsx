'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { X, Search, Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import { fullName } from '@/lib/format';
import { useRelationActions } from '@/hooks/useRelationActions';
import { useDialog } from './DialogProvider';

const RELATION_OPTIONS_PERSONA = [
  { id: 'spouse',          label: 'Супруг(а)',           hint: 'Я — супруг(а) выбранного',        color: '#ec4899' },
  { id: 'parent',          label: 'Родитель',             hint: 'Я — родитель выбранного',          color: '#3b82f6' },
  { id: 'child',           label: 'Ребёнок',              hint: 'Я — ребёнок выбранного',           color: '#3b82f6' },
  { id: 'adoptive_parent', label: 'Приёмный родитель',    hint: 'Я — приёмный родитель выбранного', color: '#a855f7' },
  { id: 'adoptive_child',  label: 'Приёмный ребёнок',     hint: 'Я — приёмный ребёнок выбранного',  color: '#a855f7' },
  { id: 'godparent',       label: 'Крёстный',             hint: 'Я — крёстный выбранного',          color: '#f59e0b' },
  { id: 'godchild',        label: 'Крестник/ца',          hint: 'Я — крестник выбранного',          color: '#f59e0b' },
];

const RELATION_OPTIONS_FAMILY = [
  { id: 'biological', label: 'Родной ребёнок',    color: '#3b82f6' },
  { id: 'adoptive',   label: 'Приёмный ребёнок',  color: '#a855f7' },
  { id: 'foster',     label: 'Опекун',            color: '#14b8a6' },
  { id: 'step',       label: 'Отчим / Мачеха',    color: '#f59e0b' },
];

export const ConnectionModal = ({
  isOpen,
  sourcePerson,
  presetSourceId,
  presetTargetId,
  presetFamilyId,
  treeId,
  allPersons,
  allFamilies,
  allChildEdges,
  onClose,
  onSuccess,
}) => {
  const [relationType, setRelationType] = useState(null);
  const [targetId, setTargetId] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const actions = useRelationActions();
  const dialog = useDialog();

  const isFamilyMode = presetFamilyId != null && presetFamilyId !== undefined;
  const isDragMode = !isFamilyMode && presetSourceId != null && presetTargetId != null;
  const isButtonMode = !isFamilyMode && !isDragMode;

  const sourceId = isFamilyMode ? null : isDragMode ? Number(presetSourceId) : sourcePerson?.id ?? null;
  const targetIdResolved = isDragMode ? Number(presetTargetId) : null;
  const familyId = isFamilyMode ? Number(presetFamilyId) : null;
  const childIdInFamily = isFamilyMode ? Number(presetSourceId ?? presetTargetId) : null;

  const source = useMemo(() => {
    if (isFamilyMode) return null;
    const sid = Number(sourceId);
    return allPersons.find((p) => Number(p.id) === sid) || sourcePerson || null;
  }, [allPersons, sourceId, sourcePerson, isFamilyMode]);

  const target = useMemo(() => {
    if (!isDragMode) return null;
    const tid = Number(targetIdResolved);
    return allPersons.find((p) => Number(p.id) === tid) || null;
  }, [allPersons, targetIdResolved, isDragMode]);

  const family = useMemo(() => {
    if (!isFamilyMode) return null;
    return allFamilies.find((f) => f.id === familyId) || null;
  }, [allFamilies, familyId, isFamilyMode]);

  const childInFamily = useMemo(() => {
    if (!isFamilyMode) return null;
    const cid = Number(childIdInFamily);
    return allPersons.find((p) => Number(p.id) === cid) || null;
  }, [allPersons, childIdInFamily, isFamilyMode]);

  const candidates = useMemo(() => {
    if (!isButtonMode || !source) return [];
    const sid = Number(source.id);
    const list = allPersons.filter((p) => Number(p.id) !== sid);
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter((p) => fullName(p).toLowerCase().includes(q));
  }, [allPersons, source, search, isButtonMode]);

  useEffect(() => {
    if (isOpen) {
      setRelationType(null);
      setTargetId('');
      setSearch('');
      setError(null);
      setBusy(false);
    }
  }, [isOpen, presetSourceId, presetTargetId, presetFamilyId]);

  if (!isOpen) return null;
  if (!isFamilyMode && !source) return null;

  const finalTargetId = isDragMode ? targetIdResolved : targetId;

  const handleSubmit = async () => {
    if (!relationType) return;
    if (!isFamilyMode && !finalTargetId) return;

    setBusy(true);
    setError(null);

    try {
      if (isFamilyMode) {
        await actions.addChildToFamily({
          family_id: familyId,
          child_id: childIdInFamily,
          relationship_type: relationType,
        });
      } else {
        const srcId = Number(sourceId);
        const tgtId = Number(finalTargetId);

        switch (relationType) {
          case 'spouse': await actions.connectSpouses({ treeId, aId: srcId, bId: tgtId, families: allFamilies }); break;
          case 'parent': await actions.connectParentChild({ treeId, parentId: srcId, childId: tgtId, relationshipType: 'biological', families: allFamilies, childEdges: allChildEdges }); break;
          case 'child': await actions.connectParentChild({ treeId, parentId: tgtId, childId: srcId, relationshipType: 'biological', families: allFamilies, childEdges: allChildEdges }); break;
          case 'adoptive_parent': await actions.connectParentChild({ treeId, parentId: srcId, childId: tgtId, relationshipType: 'adoptive', families: allFamilies, childEdges: allChildEdges }); break;
          case 'adoptive_child': await actions.connectParentChild({ treeId, parentId: tgtId, childId: srcId, relationshipType: 'adoptive', families: allFamilies, childEdges: allChildEdges }); break;
          case 'godparent': await actions.createAssociation(treeId, { type: 'godparent', from_id: srcId, to_id: tgtId }); break;
          case 'godchild': await actions.createAssociation(treeId, { type: 'godparent', from_id: tgtId, to_id: srcId }); break;
        }
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Не удалось создать связь');
    } finally {
      setBusy(false);
    }
  };

  const modalTitle = isFamilyMode ? 'Ребёнок для семьи' : 'Новая связь';
  const options = isFamilyMode ? RELATION_OPTIONS_FAMILY : RELATION_OPTIONS_PERSONA;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden transition-colors">
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 dark:border-slate-700">
          <h3 className="font-semibold text-lg text-gray-800 dark:text-slate-100">{modalTitle}</h3>
          <button onClick={onClose} className="p-1 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          {isFamilyMode && childInFamily && (
            <div className="flex items-center gap-2 text-sm bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 min-h-[52px]">
              <span className="font-semibold text-gray-800 dark:text-slate-200 truncate">{fullName(childInFamily)}</span>
              <ArrowRight className="w-4 h-4 text-gray-400 dark:text-slate-500 shrink-0" />
              <span className="text-gray-600 dark:text-slate-400">Семья #{familyId}</span>
            </div>
          )}

          {isDragMode && target && source && (
            <div className="flex items-center gap-2 text-sm bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 min-h-[52px]">
              <span className="font-semibold text-gray-800 dark:text-slate-200 truncate">{fullName(source)}</span>
              <ArrowRight className="w-4 h-4 text-gray-400 dark:text-slate-500 shrink-0" />
              <span className="font-semibold text-gray-800 dark:text-slate-200 truncate">{fullName(target)}</span>
            </div>
          )}

          {isButtonMode && source && (
            <div className="flex items-center gap-2 text-sm bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 min-h-[52px]">
              <span className="font-semibold text-gray-800 dark:text-slate-200 truncate">{fullName(source)}</span>
              <ArrowRight className="w-4 h-4 text-gray-400 dark:text-slate-500 shrink-0" />
              {targetId ? (
                <span className="font-semibold text-gray-800 dark:text-slate-200 truncate">
                  {fullName(allPersons.find((p) => String(p.id) === String(targetId)))}
                </span>
              ) : (
                <span className="text-gray-400 dark:text-slate-500 italic">выберите человека ниже</span>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-2">
              {isFamilyMode ? 'Тип связи' : 'Кем являюсь я по отношению к другому?'}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {options.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setRelationType(opt.id)}
                  className={`flex items-start gap-2 px-3 py-2 rounded-lg border-2 text-xs font-medium transition-colors text-left ${
                    relationType === opt.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 text-gray-900 dark:text-slate-100'
                      : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 text-gray-700 dark:text-slate-300'
                  }`}
                >
                  <span className="w-3 h-3 rounded-full shrink-0 mt-0.5" style={{ background: opt.color }} />
                  <span className="flex-1 min-w-0">
                    <span className="block">{opt.label}</span>
                    {opt.hint && <span className="block text-[10px] text-gray-400 dark:text-slate-500 font-normal mt-0.5">{opt.hint}</span>}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {isButtonMode && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-2">Кто?</label>
              <div className="relative mb-2">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
                <input
                  type="text"
                  placeholder="Поиск..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-100 border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="max-h-56 overflow-y-auto border border-gray-200 dark:border-slate-700 rounded-lg">
                {candidates.length === 0 ? (
                  <div className="p-3 text-xs text-gray-400 dark:text-slate-500 text-center">Никого не найдено</div>
                ) : (
                  candidates.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setTargetId(p.id)}
                      className={`w-full text-left px-3 py-2 text-sm border-b border-gray-100 dark:border-slate-700 last:border-b-0 transition-colors ${
                        String(targetId) === String(p.id)
                          ? 'bg-blue-50 dark:bg-blue-950 text-blue-800 dark:text-blue-300'
                          : 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'
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
            <div className="flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 p-2 text-xs text-red-800 dark:text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50">
          <button type="button" onClick={onClose} disabled={busy} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg disabled:opacity-50">
            Отмена
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!relationType || (!isFamilyMode && !finalTargetId) || busy}
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