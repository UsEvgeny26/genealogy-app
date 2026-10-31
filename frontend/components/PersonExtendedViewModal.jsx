'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { apiFetch } from '@/lib/api';
import { useDialog } from './DialogProvider';
import {
  X,
  User,
  Calendar,
  MapPin,
  FileText,
  Heart,
  Briefcase,
  GraduationCap,
  ShieldAlert,
  Home,
  Cross,
  Plus,
  Unlink,
  Check,
  Loader2,
  AlertCircle,
} from 'lucide-react';

/* ---------- константы и хелперы ---------- */

const fullName = (p) =>
  [p?.first_name, p?.patronymic, p?.last_name].filter(Boolean).join(' ');

const RELATION_TYPES = {
  ADOPTIVE: 'adoptive_parent',
  GODPARENT: 'godparent',
};

const MARRIAGE_STATUS_LABELS = {
  married: 'В браке',
  divorced: 'Разведены',
  widowed: 'Вдовец/Вдова',
  partners: 'Партнёры',
};

/* ---------- переиспользуемый блок списка связей ---------- */

function RelationList({ title, items, onUnlink, emptyText = 'Нет данных', candidates, onAdd, busy = false }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState('');

  const handleAdd = () => {
    if (!selected) return;
    onAdd(Number(selected));
    setSelected('');
    setOpen(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-gray-500">
          {title} ({items.length})
        </span>
        {onAdd && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            title="Добавить"
            className="p-0.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {items.length > 0 ? (
        <div className="space-y-1">
          {items.map(({ id, person }) => (
            <div
              key={id}
              className="flex items-center justify-between gap-2 text-xs bg-white p-2 rounded-lg border border-gray-200"
            >
              <span className="truncate">{fullName(person)}</span>
              <button
                type="button"
                onClick={() => onUnlink(id)}
                disabled={busy}
                title="Убрать связь (человек останется в дереве)"
                className="shrink-0 p-0.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Unlink className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <span className="text-xs text-gray-400">{emptyText}</span>
      )}

      {open && onAdd && (
        <div className="mt-2">
          {candidates.length === 0 ? (
            <span className="text-xs text-gray-400 px-2">Нет доступных людей</span>
          ) : (
            <div className="flex gap-1.5">
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                disabled={busy}
                className="flex-1 min-w-0 text-xs px-2 py-1.5 border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">— выберите человека —</option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {fullName(c)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAdd}
                disabled={!selected || busy}
                className="shrink-0 inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                Добавить
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- основной компонент ---------- */

export const PersonExtendedViewModal = ({ personId, isOpen, onClose, onRefresh }) => {
  const [person, setPerson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [allPersons, setAllPersons] = useState([]);
  const [allMarriages, setAllMarriages] = useState([]);
  const [allRelations, setAllRelations] = useState([]);

  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  const dialog = useDialog();
  const dialogRef = useRef(dialog);
  useEffect(() => { dialogRef.current = dialog; }, [dialog]);

  /* ---------- загрузчики ---------- */

  const fetchPerson = useCallback(async () => {
    const res = await apiFetch(`/api/persons/${personId}/extended`);
    if (!res.ok) throw new Error(`Не удалось загрузить карточку (${res.status})`);
    return res.json();
  }, [personId]);

  const fetchTreeData = useCallback(async () => {
    const res = await apiFetch('/api/tree');
    if (!res.ok) return;
    const data = await res.json();
    setAllPersons(data.nodes || []);
    setAllMarriages(data.marriages || []);
    setAllRelations(data.relations || []);
  }, []);

  useEffect(() => {
    if (!personId || !isOpen) return;

    setPerson(null);
    setError(null);
    setActionError(null);
    setLoading(true);

    Promise.all([fetchPerson(), fetchTreeData()])
      .then(([p]) => setPerson(p))
      .catch((err) => {
        console.error('Ошибка загрузки карточки:', err);
        setError(err.message || 'Ошибка загрузки');
      })
      .finally(() => setLoading(false));
  }, [personId, isOpen, fetchPerson, fetchTreeData]);

  const reloadAfterMutation = useCallback(async () => {
    try {
      const p = await fetchPerson();
      setPerson(p);
    } catch (e) {
      console.error('Не удалось обновить карточку:', e);
    }
    await fetchTreeData();
    onRefresh?.();
  }, [fetchPerson, fetchTreeData, onRefresh]);

  /* ---------- вычисления ---------- */

  const personById = useMemo(() => {
    const map = new Map();
    for (const p of allPersons) map.set(Number(p.id), p);
    return map;
  }, [allPersons]);

  const myMarriages = useMemo(() => {
    if (!personId) return [];
    const pid = Number(personId);
    return allMarriages
      .filter((m) => m.spouse1_id === pid || m.spouse2_id === pid)
      .map((m) => {
        const spouseId = m.spouse1_id === pid ? m.spouse2_id : m.spouse1_id;
        const spouse = personById.get(spouseId);
        return spouse ? { marriage: m, spouse } : null;
      })
      .filter(Boolean);
  }, [personId, allMarriages, personById]);

  // Приёмные / крёстные: разделяем по направлению
  // const myAdoptiveParents = useMemo(() => {
  //   if (!personId) return [];
  //   const pid = Number(personId);
  //   return allRelations
  //     .filter((r) => r.type === RELATION_TYPES.ADOPTIVE && r.to_id === pid)
  //     .map((r) => {
  //       const person = personById.get(r.from_id);
  //       return person ? { id: r.id, person } : null;
  //     })
  //     .filter(Boolean);
  // }, [personId, allRelations, personById]);

  // const myAdoptiveChildren = useMemo(() => {
  //   if (!personId) return [];
  //   const pid = Number(personId);
  //   return allRelations
  //     .filter((r) => r.type === RELATION_TYPES.ADOPTIVE && r.from_id === pid)
  //     .map((r) => {
  //       const person = personById.get(r.to_id);
  //       return person ? { id: r.id, person } : null;
  //     })
  //     .filter(Boolean);
  // }, [personId, allRelations, personById]);

  // const myGodparents = useMemo(() => {
  //   if (!personId) return [];
  //   const pid = Number(personId);
  //   return allRelations
  //     .filter((r) => r.type === RELATION_TYPES.GODPARENT && r.to_id === pid)
  //     .map((r) => {
  //       const person = personById.get(r.from_id);
  //       return person ? { id: r.id, person } : null;
  //     })
  //     .filter(Boolean);
  // }, [personId, allRelations, personById]);

  // const myGodchildren = useMemo(() => {
  //   if (!personId) return [];
  //   const pid = Number(personId);
  //   return allRelations
  //     .filter((r) => r.type === RELATION_TYPES.GODPARENT && r.from_id === pid)
  //     .map((r) => {
  //       const person = personById.get(r.to_id);
  //       return person ? { id: r.id, person } : null;
  //     })
  //     .filter(Boolean);
  // }, [personId, allRelations, personById]);

  // Кандидаты для добавления — исключаем себя и уже связанных
  const candidates = useMemo(() => {
    if (!personId) return { adoptiveParents: [], adoptiveChildren: [], godparents: [], godchildren: [] };
    const pid = Number(personId);
    const base = allPersons.filter((p) => Number(p.id) !== pid);

    const notIn = (list) => {
      const ids = new Set(list.map((x) => Number(x.person.id)));
      return base.filter((p) => !ids.has(Number(p.id)));
    };

    // return {
    //   adoptiveParents: notIn(myAdoptiveParents),
    //   adoptiveChildren: notIn(myAdoptiveChildren),
    //   godparents: notIn(myGodparents),
    //   godchildren: notIn(myGodchildren),
    // };
  }, [personId, allPersons]);

  /* ---------- операции со связями ---------- */

  const addRelation = async (type, fromId, toId, label) => {
    if (!confirm(`Создать связь: ${label}?`)) return;
    setBusy(true);
    setActionError(null);
    try {
      const res = await apiFetch('/api/relations', {
        method: 'POST',
        body: JSON.stringify({ type, from_id: fromId, to_id: toId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Ошибка создания связи (${res.status})`);
      }
      await reloadAfterMutation();
    } catch (err) {
      console.error(err);
      setActionError(err.message || 'Не удалось создать связь');
    } finally {
      setBusy(false);
    }
  };

  const removeRelation = async (relationId, label) => {
    if (!confirm(`Убрать связь «${label}»? Сам человек останется в дереве.`)) return;
    setBusy(true);
    setActionError(null);
    try {
      const res = await apiFetch(`/api/relations/${relationId}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Ошибка удаления связи (${res.status})`);
      }
      await reloadAfterMutation();
    } catch (err) {
      console.error(err);
      setActionError(err.message || 'Не удалось удалить связь');
    } finally {
      setBusy(false);
    }
  };

  /* ---------- операции с браком ---------- */

  const handleDivorce = async (marriageId, spouseName) => {
    const ok = await dialogRef.current.confirm({
      title: `Развести с ${spouseName}?`,
      description: 'Брак останется в истории, но получит статус «Разведены».',
      variant: 'warning',
      confirmLabel: 'Развести',
    });
    if (!ok) return;

    const endDate = await dialogRef.current.prompt({
      title: 'Дата развода',
      description: 'Необязательно. Можно оставить пустым.',
      defaultValue: '',
      placeholder: '15.06.1998',
      confirmLabel: 'Сохранить',
      cancelLabel: 'Отмена',
    });
    if (endDate === null) return; // Отмена в prompt

    setBusy(true);
    setActionError(null);
    try {
      const res = await apiFetch(`/api/marriages/${marriageId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'divorced', end_date: endDate || null }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Ошибка обновления (${res.status})`);
      }
      await reloadAfterMutation();
    } catch (err) {
      console.error(err);
      setActionError(err.message || 'Не удалось обновить брак');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteMarriage = async (marriageId, spouseName) => {
    const ok = await dialogRef.current.confirm({
      title: 'Удалить брак?',
      description: `Брак с ${spouseName} будет удалён полностью. Люди останутся в дереве.`,
      variant: 'danger',
      confirmLabel: 'Удалить',
    });
    if (!ok) return;

    setBusy(true);
    setActionError(null);
    try {
      const res = await apiFetch(`/api/marriages/${marriageId}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Ошибка удаления (${res.status})`);
      }
      await reloadAfterMutation();
    } catch (err) {
      console.error(err);
      setActionError(err.message || 'Не удалось удалить брак');
    } finally {
      setBusy(false);
    }
  };

  /* ---------- рендер ---------- */

  if (!isOpen) return null;

  const isMale = person?.gender === 'male';
  const isFemale = person?.gender === 'female';

  const avatarClass = isMale ? 'bg-blue-500' : isFemale ? 'bg-pink-500' : 'bg-gray-500';
  const genderBadge = isMale
    ? 'bg-blue-100 text-blue-700'
    : isFemale
      ? 'bg-pink-100 text-pink-700'
      : 'bg-gray-200 text-gray-700';
  const genderLabel = isMale ? 'Мужчина' : isFemale ? 'Женщина' : 'Не указан';

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden relative">
        {/* Шапка */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white shrink-0 ${avatarClass}`}>
              {person?.photo_url ? (
                <img src={person.photo_url} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                <User className="w-6 h-6" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 leading-tight">
                {person ? fullName(person) : 'Загрузка...'}
              </h2>
              {person && (
                <div className="flex gap-2 items-center text-xs mt-0.5">
                  <span className={`px-2 py-0.5 rounded-full font-medium ${genderBadge}`}>
                    {genderLabel}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full font-medium ${
                      person.is_alive !== false
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {person.is_alive !== false ? 'Жив(а)' : 'Умер(ла)'}
                  </span>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200/60 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Тело */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm text-gray-700">
          {loading ? (
            <div className="py-12 flex items-center justify-center gap-2 text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Загрузка информации...
            </div>
          ) : error ? (
            <div className="py-8 flex items-start gap-2 text-sm text-red-700 bg-red-50 rounded-xl p-4">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          ) : person ? (
            <>
              {/* Блок 1: Персональные данные */}
              <section className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-600" /> 1. Персональные данные
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs md:text-sm">
                  {person.given_name && (
                    <div>
                      <span className="text-gray-400 block text-xs">Имя при рождении:</span>
                      {person.given_name}
                    </div>
                  )}
                  {person.maiden_name && !isMale && (
                    <div>
                      <span className="text-gray-400 block text-xs">Девичья фамилия:</span>
                      {person.maiden_name}
                    </div>
                  )}
                  {person.aliases && (
                    <div className="col-span-full">
                      <span className="text-gray-400 block text-xs">Псевдонимы / прозвища:</span>
                      {person.aliases}
                    </div>
                  )}
                </div>
              </section>

              {/* Блок 2: Жизненные события */}
              <section className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-600" /> 2. Ключевые жизненные события
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="font-medium text-gray-900 block text-xs">Рождение</span>
                    <div className="flex items-center gap-1.5 text-xs text-gray-600">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      {person.birth_date || 'Дата не указана'}
                    </div>
                    {person.birth_place && (
                      <div className="flex items-start gap-1.5 text-xs text-gray-600">
                        <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                        {person.birth_place}
                      </div>
                    )}
                  </div>

                  {person.is_alive === false && (
                    <div className="space-y-1 border-t md:border-t-0 md:border-l border-gray-200 pt-3 md:pt-0 md:pl-4">
                      <span className="font-medium text-gray-900 block text-xs">Смерть и погребение</span>
                      <div className="flex items-center gap-1.5 text-xs text-gray-600">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        {person.death_date || 'Дата не указана'}
                      </div>
                      {person.death_place && (
                        <div className="flex items-start gap-1.5 text-xs text-gray-600">
                          <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                          {person.death_place}
                        </div>
                      )}
                      {person.death_cause && (
                        <div className="text-xs text-gray-500">
                          <span className="font-medium">Причина:</span> {person.death_cause}
                        </div>
                      )}
                      {(person.cemetery_name || person.cemetery_plot) && (
                        <div className="text-xs text-gray-500 pt-1">
                          <span className="font-medium">Место захоронения:</span>{' '}
                          {[person.cemetery_name, person.cemetery_plot].filter(Boolean).join(', ')}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>

              {/* Блок 3: Семейные связи */}
              <section className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  <Heart className="w-4 h-4 text-rose-500" /> 3. Семейные связи
                </h3>

                {actionError && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-800">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>{actionError}</span>
                  </div>
                )}

                {/* Родители / Дети (кровные) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs font-semibold text-gray-500 block mb-1">
                      Родители ({person.parents?.length || 0})
                    </span>
                    {person.parents?.length > 0 ? (
                      <div className="space-y-1">
                        {person.parents.map((p) => (
                          <div key={p.id} className="text-xs bg-white p-2 rounded-lg border border-gray-200">
                            {fullName(p)}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">Нет данных</span>
                    )}
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-gray-500 block mb-1">
                      Дети ({person.children?.length || 0})
                    </span>
                    {person.children?.length > 0 ? (
                      <div className="space-y-1">
                        {person.children.map((c) => (
                          <div key={c.id} className="text-xs bg-white p-2 rounded-lg border border-gray-200">
                            {fullName(c)}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">Нет данных</span>
                    )}
                  </div>
                </div>

                {/* Приёмные родители / дети
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-gray-200">
                  <RelationList
                    title="Приёмные родители"
                    items={myAdoptiveParents}
                    busy={busy}
                    candidates={candidates.adoptiveParents}
                    onAdd={(candidateId) => {
                      const cand = personById.get(candidateId);
                      addRelation(
                        RELATION_TYPES.ADOPTIVE,
                        candidateId,
                        Number(personId),
                        `${fullName(cand)} — приёмный родитель для ${fullName(person)}`
                      );
                    }}
                    onUnlink={(rid) => {
                      const item = myAdoptiveParents.find((x) => x.id === rid);
                      removeRelation(rid, `${fullName(item?.person)} — приёмный родитель`);
                    }}
                  />
                  <RelationList
                    title="Приёмные дети"
                    items={myAdoptiveChildren}
                    busy={busy}
                    candidates={candidates.adoptiveChildren}
                    onAdd={(candidateId) => {
                      const cand = personById.get(candidateId);
                      addRelation(
                        RELATION_TYPES.ADOPTIVE,
                        Number(personId),
                        candidateId,
                        `${fullName(person)} — приёмный родитель для ${fullName(cand)}`
                      );
                    }}
                    onUnlink={(rid) => {
                      const item = myAdoptiveChildren.find((x) => x.id === rid);
                      removeRelation(rid, `${fullName(person)} — приёмный родитель для ${fullName(item?.person)}`);
                    }}
                  />
                </div> */}

                {/* Крёстные / крестники
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-gray-200">
                  <RelationList
                    title="Крёстные"
                    items={myGodparents}
                    busy={busy}
                    candidates={candidates.godparents}
                    onAdd={(candidateId) => {
                      const cand = personById.get(candidateId);
                      addRelation(
                        RELATION_TYPES.GODPARENT,
                        candidateId,
                        Number(personId),
                        `${fullName(cand)} — крёстный для ${fullName(person)}`
                      );
                    }}
                    onUnlink={(rid) => {
                      const item = myGodparents.find((x) => x.id === rid);
                      removeRelation(rid, `${fullName(item?.person)} — крёстный`);
                    }}
                  />
                  <RelationList
                    title="Крестники"
                    items={myGodchildren}
                    busy={busy}
                    candidates={candidates.godchildren}
                    onAdd={(candidateId) => {
                      const cand = personById.get(candidateId);
                      addRelation(
                        RELATION_TYPES.GODPARENT,
                        Number(personId),
                        candidateId,
                        `${fullName(person)} — крёстный для ${fullName(cand)}`
                      );
                    }}
                    onUnlink={(rid) => {
                      const item = myGodchildren.find((x) => x.id === rid);
                      removeRelation(rid, `${fullName(person)} — крёстный для ${fullName(item?.person)}`);
                    }}
                  />
                </div> */}

                {/* Супруги (с разводом) */}
                <div className="pt-3 border-t border-gray-200">
                  <span className="text-xs font-semibold text-gray-500 block mb-1">
                    Супруги ({myMarriages.length})
                  </span>
                  {myMarriages.length > 0 ? (
                    <div className="space-y-1">
                      {myMarriages.map(({ marriage, spouse }) => {
                        const isDivorced = marriage.status === 'divorced';
                        const statusLabel = marriage.status
                          ? MARRIAGE_STATUS_LABELS[marriage.status] || marriage.status
                          : 'В браке';

                        return (
                          <div
                            key={marriage.id}
                            className={`flex items-center justify-between gap-2 text-xs p-2 rounded-lg border ${
                              isDivorced ? 'bg-gray-50 border-gray-300' : 'bg-white border-rose-200'
                            }`}
                          >
                            <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
                              <span className={`truncate ${isDivorced ? 'text-gray-500' : 'text-gray-800'}`}>
                                {isDivorced ? '⚯' : '♥'} {fullName(spouse)}
                              </span>
                              {marriage.start_date && (
                                <span className="text-gray-400 text-[10px]">
                                  {marriage.start_date}
                                  {marriage.end_date ? ` – ${marriage.end_date}` : ''}
                                </span>
                              )}
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  isDivorced
                                    ? 'bg-gray-200 text-gray-600'
                                    : 'bg-rose-100 text-rose-700'
                                }`}
                              >
                                {statusLabel}
                              </span>
                            </div>
                            <div className="shrink-0 flex gap-0.5">
                              {!isDivorced && (
                                <button
                                  type="button"
                                  onClick={() => handleDivorce(marriage.id, fullName(spouse))}
                                  disabled={busy}
                                  title="Развести"
                                  className="p-0.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded disabled:opacity-40"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeleteMarriage(marriage.id, fullName(spouse))}
                                disabled={busy}
                                title="Удалить брак (люди останутся в дереве)"
                                className="p-0.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-40"
                              >
                                <Unlink className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">
                      Нет данных. Брак создаётся перетаскиванием за розовые кружки на холсте.
                    </span>
                  )}
                </div>
              </section>

              {/* Блок 4: Социум, карьера и служба */}
              <section className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-indigo-600" /> 4. Социум, Карьера и Служба
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs md:text-sm">
                  {person.occupations && (
                    <div className="flex items-start gap-2">
                      <Briefcase className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                      <div>
                        <span className="text-gray-400 block text-xs">Профессия / Занятия:</span>
                        {person.occupations}
                      </div>
                    </div>
                  )}
                  {person.education && (
                    <div className="flex items-start gap-2">
                      <GraduationCap className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                      <div>
                        <span className="text-gray-400 block text-xs">Образование:</span>
                        {person.education}
                      </div>
                    </div>
                  )}
                  {person.social_status && (
                    <div>
                      <span className="text-gray-400 block text-xs">Социальный статус:</span>
                      {person.social_status}
                    </div>
                  )}
                  {person.religion && (
                    <div className="flex items-start gap-2">
                      <Cross className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                      <div>
                        <span className="text-gray-400 block text-xs">Вероисповедание:</span>
                        {person.religion}
                      </div>
                    </div>
                  )}
                  {person.residences && (
                    <div className="col-span-full flex items-start gap-2">
                      <Home className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                      <div>
                        <span className="text-gray-400 block text-xs">Места проживания:</span>
                        {person.residences}
                      </div>
                    </div>
                  )}
                </div>

                {person.military_is_served && (
                  <div className="mt-3 pt-3 border-t border-gray-200 bg-amber-50/60 p-3 rounded-lg space-y-1.5">
                    <div className="font-semibold text-xs text-amber-900 flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-amber-600" /> Военная служба
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                      {person.military_rank && (
                        <div>
                          <span className="text-amber-800/70">Звание:</span> {person.military_rank}
                        </div>
                      )}
                      {person.military_regiment && (
                        <div>
                          <span className="text-amber-800/70">Полк / Часть:</span> {person.military_regiment}
                        </div>
                      )}
                      {person.military_awards && (
                        <div className="col-span-full">
                          <span className="text-amber-800/70">Награды:</span> {person.military_awards}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </section>

              {/* Блок 5: Биография */}
              {person.biography && (
                <section className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-600" /> 5. Биография
                  </h3>
                  <p className="text-xs md:text-sm text-gray-700 leading-relaxed whitespace-pre-line bg-white p-3 rounded-lg border border-gray-200">
                    {person.biography}
                  </p>
                </section>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};