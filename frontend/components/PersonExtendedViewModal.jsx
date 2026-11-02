'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  X, User, Calendar, MapPin, FileText, Heart, Unlink,
  Loader2, AlertCircle, Plus, Link as LinkIcon,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { fullName, formatDateRu } from '@/lib/format';
import { useDialog } from './DialogProvider';
import { useRelationActions } from '@/hooks/useRelationActions';

const MARRIAGE_STATUS_LABELS = {
  married: 'В браке',
  divorced: 'Разведены',
  widowed: 'Вдовец/Вдова',
  partners: 'Партнёры',
  unknown: 'Не указан',
};

export const PersonExtendedViewModal = ({
  personId,
  isOpen,
  onClose,
  onRefresh,
  onAddConnection,
}) => {
  const [person, setPerson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const [allPersons, setAllPersons] = useState([]);
  const [allAssociations, setAllAssociations] = useState([]);

  const dialog = useDialog();
  const actions = useRelationActions();

  const fetchPerson = useCallback(async () => {
    const res = await apiFetch(`/api/individuals/${personId}`);
    if (!res.ok) throw new Error(`Не удалось загрузить карточку (${res.status})`);
    return res.json();
  }, [personId]);

  const fetchContext = useCallback(async () => {
    const res = await apiFetch('/api/graph');
    if (!res.ok) return;
    const data = await res.json();
    setAllPersons(data.persons || []);
    setAllAssociations(data.association_edges || []);
  }, []);

  useEffect(() => {
    if (!personId || !isOpen) return;

    setPerson(null);
    setError(null);
    setLoading(true);

    Promise.all([fetchPerson(), fetchContext()])
      .then(([p]) => setPerson(p))
      .catch((err) => {
        console.error(err);
        setError(err.message || 'Ошибка загрузки');
      })
      .finally(() => setLoading(false));
  }, [personId, isOpen, fetchPerson, fetchContext]);

  const reload = useCallback(async () => {
    try {
      const p = await fetchPerson();
      setPerson(p);
    } catch (e) {
      console.error(e);
    }
    await fetchContext();
    onRefresh?.();
  }, [fetchPerson, fetchContext, onRefresh]);

  const personById = useMemo(() => {
    const map = new Map();
    for (const p of allPersons) map.set(Number(p.id), p);
    return map;
  }, [allPersons]);

  const myGodparents = useMemo(() => {
    if (!personId) return [];
    const pid = Number(personId);
    return allAssociations
      .filter((a) => a.type === 'godparent' && a.target_id === pid)
      .map((a) => ({ assoc: a, person: personById.get(a.source_id) }))
      .filter((x) => x.person);
  }, [personId, allAssociations, personById]);

  const myGodchildren = useMemo(() => {
    if (!personId) return [];
    const pid = Number(personId);
    return allAssociations
      .filter((a) => a.type === 'godparent' && a.source_id === pid)
      .map((a) => ({ assoc: a, person: personById.get(a.target_id) }))
      .filter((x) => x.person);
  }, [personId, allAssociations, personById]);

  /* ---------- Операции ---------- */

  const handleDivorce = async (familyId, spouseName) => {
    const ok = await dialog.confirm({
      title: `Развести с ${spouseName}?`,
      description: 'Дети останутся в семье. Статус изменится на «Разведены».',
      variant: 'warning',
      confirmLabel: 'Развести',
    });
    if (!ok) return;

    const endDate = await dialog.prompt({
      title: 'Дата развода',
      description: 'Необязательно. Можно оставить пустым.',
      defaultValue: '',
      placeholder: '15 июня 1998',
      confirmLabel: 'Сохранить',
    });
    if (endDate === null) return;

    setBusy(true);
    try {
      await actions.updateFamily(familyId, {
        status: 'divorced',
        divorce_date: endDate || null,
      });
      await reload();
    } catch (err) {
      await dialog.alert({
        title: 'Ошибка',
        description: err.message || 'Не удалось обновить брак',
        variant: 'danger',
        confirmLabel: 'Понятно',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteFamily = async (familyId, spouseName) => {
    const ok = await dialog.confirm({
      title: 'Удалить брак?',
      description: `Брак с ${spouseName} будет удалён полностью. Связи с детьми из этой семьи тоже будут удалены.`,
      variant: 'danger',
      confirmLabel: 'Удалить',
    });
    if (!ok) return;

    setBusy(true);
    try {
      await actions.deleteFamily(familyId);
      await reload();
    } catch (err) {
      await dialog.alert({
        title: 'Ошибка',
        description: err.message || 'Не удалось удалить брак',
        variant: 'danger',
        confirmLabel: 'Понятно',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveChild = async (familyId, childId) => {
    const child = personById.get(Number(childId));
    const ok = await dialog.confirm({
      title: 'Убрать связь?',
      description: `${fullName(child) || 'Ребёнок'} больше не будет числиться ребёнком этой семьи.`,
      variant: 'warning',
      confirmLabel: 'Убрать',
    });
    if (!ok) return;

    setBusy(true);
    try {
      await actions.removeChildFromFamily(familyId, childId);
      await reload();
    } catch (err) {
      await dialog.alert({
        title: 'Ошибка',
        description: err.message || 'Не удалось убрать связь',
        variant: 'danger',
        confirmLabel: 'Понятно',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveAssociation = async (assocId, otherName, kindLabel) => {
    const ok = await dialog.confirm({
      title: 'Убрать связь?',
      description: `Связь «${kindLabel}» с ${otherName} будет удалена.`,
      variant: 'warning',
      confirmLabel: 'Убрать',
    });
    if (!ok) return;

    setBusy(true);
    try {
      await actions.deleteAssociation(assocId);
      await reload();
    } catch (err) {
      await dialog.alert({
        title: 'Ошибка',
        description: err.message || 'Не удалось удалить связь',
        variant: 'danger',
        confirmLabel: 'Понятно',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleAddLink = () => {
    if (onAddConnection && person) {
      onAddConnection(person);
    }
  };

  if (!isOpen) return null;

  const isMale = person?.gender === 'M' || person?.gender === 'male';
  const isFemale = person?.gender === 'F' || person?.gender === 'female';

  const avatarClass = isMale ? 'bg-blue-500' : isFemale ? 'bg-pink-500' : 'bg-gray-500';
  const genderBadge = isMale
    ? 'bg-blue-100 text-blue-700'
    : isFemale
      ? 'bg-pink-100 text-pink-700'
      : 'bg-gray-200 text-gray-700';
  const genderLabel = isMale ? 'Мужчина' : isFemale ? 'Женщина' : 'Не указан';

  // Сводки по семьям
  const parentFamilies = person?.parent_families || [];
  const spouseFamilies = person?.spouse_families || [];

  const visibleSpouseFamilies = spouseFamilies.filter((fam) => {
    const isSpouse1 = Number(fam.spouse1_id) === Number(personId);
    const spouseId = isSpouse1 ? fam.spouse2_id : fam.spouse1_id;
    return spouseId != null && personById.get(Number(spouseId));
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden relative">
        {/* Шапка */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center text-white shrink-0 ${avatarClass}`}
            >
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
          <div className="flex items-center gap-1">
            {onAddConnection && (
              <button
                onClick={handleAddLink}
                className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-full transition-colors"
                title="Добавить связь"
              >
                <LinkIcon className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200/60 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
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
              {/* 1. Персональные данные */}
              <section className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-600" /> 1. Персональные данные
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs md:text-sm">
                  {person.maiden_name && (
                    <div>
                      <span className="text-gray-400 block text-xs">Девичья фамилия:</span>
                      {person.maiden_name}
                    </div>
                  )}
                  {person.nicknames && (
                    <div>
                      <span className="text-gray-400 block text-xs">Прозвища:</span>
                      {person.nicknames}
                    </div>
                  )}
                  {person.aliases && (
                    <div className="col-span-full">
                      <span className="text-gray-400 block text-xs">Псевдонимы:</span>
                      {person.aliases}
                    </div>
                  )}
                  {!person.maiden_name && !person.nicknames && !person.aliases && (
                    <span className="text-xs text-gray-400">Дополнительных сведений нет</span>
                  )}
                </div>
              </section>

              {/* 2. Жизненные события */}
              <section className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-600" /> 2. Жизненные события
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="font-medium text-gray-900 block text-xs">Рождение</span>
                    <div className="flex items-center gap-1.5 text-xs text-gray-600">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      {formatDateRu(person.birth_date) || 'Дата не указана'}
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
                      <span className="font-medium text-gray-900 block text-xs">Смерть</span>
                      <div className="flex items-center gap-1.5 text-xs text-gray-600">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        {formatDateRu(person.death_date) || 'Дата не указана'}
                      </div>
                      {person.death_place && (
                        <div className="flex items-start gap-1.5 text-xs text-gray-600">
                          <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                          {person.death_place}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>

              {/* 3. Семейные связи */}
              <section className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  <Heart className="w-4 h-4 text-rose-500" /> 3. Семейные связи
                </h3>

                {/* Родители */}
                <div>
                  <span className="text-xs font-semibold text-gray-500 block mb-1">
                    Родители ({parentFamilies.length})
                  </span>
                  {parentFamilies.length > 0 ? (
                    <div className="space-y-1">
                      {parentFamilies.map((fam) => {
                        const spouse1 = personById.get(Number(fam.spouse1_id));
                        const spouse2 = personById.get(Number(fam.spouse2_id));
                        const parents = [spouse1, spouse2].filter(Boolean);
                        return (
                          <div
                            key={fam.id}
                            className="text-xs bg-white p-2 rounded-lg border border-gray-200"
                          >
                            {parents.length === 0
                              ? 'Нет данных о родителях'
                              : parents.map((p) => fullName(p)).join(' и ')}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">Нет данных</span>
                  )}
                </div>

                {/* Супруги */}
                <div>
                  <span className="text-xs font-semibold text-gray-500 block mb-1">
                    Супруги ({visibleSpouseFamilies.length})
                  </span>
                  {visibleSpouseFamilies.length > 0 ? (
                    <div className="space-y-1">
                      {visibleSpouseFamilies.map((fam) => {
                        const isSpouse1 = Number(fam.spouse1_id) === Number(personId);
                        const spouseId = isSpouse1 ? fam.spouse2_id : fam.spouse1_id;
                        const spouse = personById.get(Number(spouseId));
                        const isDivorced =
                          fam.status === 'divorced' || fam.status === 'widowed';

                        return (
                          <div
                            key={fam.id}
                            className={`flex items-center justify-between gap-2 text-xs p-2 rounded-lg border ${
                              isDivorced
                                ? 'bg-gray-50 border-gray-300'
                                : 'bg-white border-rose-200'
                            }`}
                          >
                            <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`truncate ${
                                  isDivorced ? 'text-gray-500' : 'text-gray-800'
                                }`}
                              >
                                {isDivorced ? '⚯' : '♥'} {fullName(spouse)}
                              </span>
                              {fam.marriage_date && (
                                <span className="text-gray-400 text-[10px]">
                                  {formatDateRu(fam.marriage_date)}
                                  {fam.divorce_date ? ` – ${formatDateRu(fam.divorce_date)}` : ''}
                                </span>
                              )}
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  isDivorced
                                    ? 'bg-gray-200 text-gray-600'
                                    : 'bg-rose-100 text-rose-700'
                                }`}
                              >
                                {MARRIAGE_STATUS_LABELS[fam.status] || fam.status}
                              </span>
                            </div>
                            <div className="shrink-0 flex gap-0.5">
                              {!isDivorced && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDivorce(fam.id, fullName(spouse))
                                  }
                                  disabled={busy}
                                  title="Развести"
                                  className="p-0.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded disabled:opacity-40"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  handleDeleteFamily(fam.id, fullName(spouse))
                                }
                                disabled={busy}
                                title="Удалить брак"
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
                    <span className="text-xs text-gray-400">Нет данных</span>
                  )}
                </div>

                {/* Дети — из spouse_families */}
                <div>
                  <span className="text-xs font-semibold text-gray-500 block mb-1">
                    Дети
                  </span>
                  {spouseFamilies.some((f) => (f.children || []).length > 0) ? (
                    <div className="space-y-2">
                      {spouseFamilies.map((fam) => {
                        const children = fam.children || [];
                        if (children.length === 0) return null;
                        return (
                          <div key={fam.id} className="space-y-1">
                            <div className="text-[10px] text-gray-400">
                              Семья #{fam.id}{' '}
                              {fam.status !== 'married'
                                ? `(${MARRIAGE_STATUS_LABELS[fam.status] || fam.status})`
                                : ''}
                            </div>
                            {children.map((c) => (
                              <div
                                key={c.id}
                                className="flex items-center justify-between gap-2 text-xs bg-white p-2 rounded-lg border border-gray-200"
                              >
                                <span className="truncate">{fullName(c)}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveChild(fam.id, c.id)}
                                  disabled={busy}
                                  title="Убрать из семьи"
                                  className="shrink-0 p-0.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-40"
                                >
                                  <Unlink className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">Нет данных</span>
                  )}
                </div>

                {/* Крёстные */}
                {(myGodparents.length > 0 || myGodchildren.length > 0) && (
                  <>
                    {myGodparents.length > 0 && (
                      <div>
                        <span className="text-xs font-semibold text-gray-500 block mb-1">
                          Крёстные ({myGodparents.length})
                        </span>
                        <div className="space-y-1">
                          {myGodparents.map(({ assoc, person: gp }) => (
                            <div
                              key={assoc.id}
                              className="flex items-center justify-between gap-2 text-xs bg-white p-2 rounded-lg border border-amber-200"
                            >
                              <span className="truncate">{fullName(gp)}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  handleRemoveAssociation(assoc.id, fullName(gp), 'крёстный')
                                }
                                disabled={busy}
                                className="shrink-0 p-0.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-40"
                              >
                                <Unlink className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {myGodchildren.length > 0 && (
                      <div>
                        <span className="text-xs font-semibold text-gray-500 block mb-1">
                          Крестники ({myGodchildren.length})
                        </span>
                        <div className="space-y-1">
                          {myGodchildren.map(({ assoc, person: gc }) => (
                            <div
                              key={assoc.id}
                              className="flex items-center justify-between gap-2 text-xs bg-white p-2 rounded-lg border border-amber-200"
                            >
                              <span className="truncate">{fullName(gc)}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  handleRemoveAssociation(assoc.id, fullName(gc), 'крестник')
                                }
                                disabled={busy}
                                className="shrink-0 p-0.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-40"
                              >
                                <Unlink className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </section>

              {/* 4. Биография */}
              {person.biography && (
                <section className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-600" /> 4. Биография
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