'use client';

import React, { useState, useEffect } from 'react';
import { X, User, Calendar, Briefcase, FileText, AlertCircle, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';

const EMPTY_FORM = {
  first_name: '',
  given_name: '',
  last_name: '',
  patronymic: '',
  maiden_name: '',
  aliases: '',
  gender: 'male',
  is_alive: true,
  photo_url: '',
  birth_date: '',
  birth_place: '',
  death_date: '',
  death_place: '',
  death_cause: '',
  cemetery_name: '',
  cemetery_plot: '',
  cemetery_gps: '',
  immigration_date: '',
  immigration_port: '',
  immigration_doc: '',
  occupations: '',
  education: '',
  social_status: '',
  military_is_served: false,
  military_regiment: '',
  military_rank: '',
  military_battles: '',
  military_awards: '',
  religion: '',
  residences: '',
  biography: '',
  relation_type: 'child',
};

// Приводит ответ /extended к плоскому виду формы (все значения — строки/bool)
function personToForm(person) {
  return {
    ...EMPTY_FORM,
    ...Object.fromEntries(
      Object.keys(EMPTY_FORM).map((key) => {
        if (key === 'biography') return [key, person.biography || person.bio || ''];
        if (key === 'military_is_served') return [key, Boolean(person.military_is_served)];
        if (key === 'is_alive') return [key, person.is_alive !== undefined ? person.is_alive : true];
        // null/undefined → '' для текстовых полей, чтобы инпут был пустым, а не "null"
        const value = person[key];
        return [key, value === null || value === undefined ? EMPTY_FORM[key] : value];
      })
    ),
    relation_type: 'child',
  };
}

export const PersonModal = ({ isOpen, mode, personData, presetParentIds = null, onClose, onRefresh }) => {
  const [activeTab, setActiveTab] = useState('basic');
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [loadingPerson, setLoadingPerson] = useState(false);
  const [error, setError] = useState(null);

  const isFamilyAdd = mode === 'add' && Array.isArray(presetParentIds) && presetParentIds.length > 0;
  const isRootAdd = mode === 'add' && !personData && !isFamilyAdd;

  useEffect(() => {
    if (!isOpen) return;

    setActiveTab('basic');
    setError(null);
    setSaving(false);

    // ADD: стартуем с пустой формы, ничего грузить не надо.
    if (mode === 'add') {
      setFormData(EMPTY_FORM);
      setLoadingPerson(false);
      return;
    }

    // EDIT: у personData может быть только часть полей (из /api/tree).
    // Грузим полную карточку, чтобы не потерять данные при сохранении.
    if (mode === 'edit' && personData?.id) {
      setLoadingPerson(true);
      // Пока грузится — показываем частичные данные, чтобы в шапке было имя.
      setFormData(personToForm(personData));

      apiFetch(`/api/persons/${personData.id}/extended`)
        .then((res) => {
          if (!res.ok) throw new Error(`Не удалось загрузить данные (${res.status})`);
          return res.json();
        })
        .then((full) => setFormData(personToForm(full)))
        .catch((err) => {
          console.error('Ошибка загрузки карточки для редактирования:', err);
          setError(
            'Не удалось загрузить полные данные. Редактирование может привести к потере полей. Попробуйте переоткрыть окно.'
          );
        })
        .finally(() => setLoadingPerson(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personData?.id, mode, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving || loadingPerson) return;

    setSaving(true);
    setError(null);

    const nullable = (v) => (v === '' || v === undefined ? null : v);
    const isAlive = formData.is_alive;

    const payload = {
      first_name: formData.first_name,
      given_name: nullable(formData.given_name),
      last_name: nullable(formData.last_name),
      patronymic: nullable(formData.patronymic),
      maiden_name: nullable(formData.maiden_name),
      aliases: nullable(formData.aliases),
      gender: formData.gender,
      is_alive: isAlive,
      photo_url: nullable(formData.photo_url),
      birth_date: nullable(formData.birth_date),
      birth_place: nullable(formData.birth_place),
      death_date: isAlive ? null : nullable(formData.death_date),
      death_place: isAlive ? null : nullable(formData.death_place),
      death_cause: isAlive ? null : nullable(formData.death_cause),
      cemetery_name: isAlive ? null : nullable(formData.cemetery_name),
      cemetery_plot: isAlive ? null : nullable(formData.cemetery_plot),
      cemetery_gps: isAlive ? null : nullable(formData.cemetery_gps),
      immigration_date: nullable(formData.immigration_date),
      immigration_port: nullable(formData.immigration_port),
      immigration_doc: nullable(formData.immigration_doc),
      occupations: nullable(formData.occupations),
      education: nullable(formData.education),
      social_status: nullable(formData.social_status),
      military_is_served: formData.military_is_served,
      military_regiment: nullable(formData.military_regiment),
      military_rank: nullable(formData.military_rank),
      military_battles: nullable(formData.military_battles),
      military_awards: nullable(formData.military_awards),
      religion: nullable(formData.religion),
      residences: nullable(formData.residences),
      biography: nullable(formData.biography),
    };

    try {
      if (mode === 'edit') {
        const res = await apiFetch(`/api/persons/${personData.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || `Ошибка сохранения (${res.status})`);
        }
      } else if (mode === 'add') {
        const res = await apiFetch('/api/persons', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || `Ошибка создания (${res.status})`);
        }
        const newPerson = await res.json();

        if (isFamilyAdd) {
          // Создаём ребёнка сразу у двух родителей
          for (const parentId of presetParentIds) {
            const relRes = await apiFetch('/api/parent-child', {
              method: 'POST',
              body: JSON.stringify({
                parent_id: parentId,
                child_id: newPerson.id,
                kind: 'biological',
              }),
            });
            if (!relRes.ok) {
              const err = await relRes.json().catch(() => ({}));
              throw new Error(
                err.detail || 'Человек создан, но не все связи установлены. Обновите дерево.'
              );
            }
          }
        } else if (!isRootAdd) {
          const parentId = formData.relation_type === 'parent' ? newPerson.id : personData.id;
          const childId = formData.relation_type === 'parent' ? personData.id : newPerson.id;

          const relRes = await apiFetch(`/api/parent-child`, {
            method: 'POST',
            body: JSON.stringify({
              parent_id: parentId,
              child_id: childId,
              kind: 'biological',
            }),
          });
          if (!relRes.ok) {
            throw new Error('Человек создан, но связь не установлена. Обновите дерево.');
          }
        }
      }
      onRefresh();
      onClose();
    } catch (err) {
      console.error('Save error:', err);
      setError(err.message || 'Не удалось сохранить изменения');
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-50 disabled:text-gray-500';
  const labelClass = 'block text-xs font-semibold text-gray-600 mb-1';

  const busy = saving || loadingPerson;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Шапка */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-lg text-gray-800">
            {mode === 'edit'
              ? `Редактирование: ${personData?.first_name || ''}`
              : isFamilyAdd
                ? 'Добавление ребёнка в семью'
                : isRootAdd
                  ? 'Добавление человека'
                  : `Добавление родственника для ${personData?.first_name || ''}`}
          </h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Навигация по вкладкам */}
        <div className="flex border-b border-gray-200 px-6 bg-slate-50 gap-2">
          {[
            { id: 'basic', label: 'Основное', Icon: User },
            { id: 'events', label: 'События', Icon: Calendar },
            { id: 'social', label: 'Карьера и служба', Icon: Briefcase },
            { id: 'bio', label: 'Биография', Icon: FileText },
          ].map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              disabled={loadingPerson}
              className={`py-2.5 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors disabled:opacity-50 ${
                activeTab === id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>

        {/* Плашка загрузки */}
        {loadingPerson && (
          <div className="mx-6 mt-4 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            Загружаем полные данные карточки...
          </div>
        )}

        {/* Ошибка */}
        {error && (
          <div className="mx-6 mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
         {mode === 'add' && !isRootAdd && !isFamilyAdd && activeTab === 'basic' && (
            <div className="bg-blue-50 p-3 rounded-xl mb-4 border border-blue-100">
              <label className="block text-xs font-semibold text-blue-900 uppercase mb-2">
                Кем приходится?
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="relation_type"
                    value="child"
                    checked={formData.relation_type === 'child'}
                    onChange={handleChange}
                  />
                  Ребёнок
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="relation_type"
                    value="parent"
                    checked={formData.relation_type === 'parent'}
                    onChange={handleChange}
                  />
                  Родитель
                </label>
              </div>
            </div>
          )}

          {/* Таб 1: Основное */}
          {activeTab === 'basic' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Имя</label>
                  <input type="text" name="first_name" required value={formData.first_name} onChange={handleChange} className={inputClass} disabled={loadingPerson} />
                </div>
                <div>
                  <label className={labelClass}>Фамилия</label>
                  <input type="text" name="last_name" value={formData.last_name} onChange={handleChange} className={inputClass} disabled={loadingPerson} />
                </div>
                <div>
                  <label className={labelClass}>Отчество</label>
                  <input type="text" name="patronymic" value={formData.patronymic} onChange={handleChange} className={inputClass} disabled={loadingPerson} />
                </div>
                <div>
                  <label className={labelClass}>Имя при рождении</label>
                  <input type="text" name="given_name" value={formData.given_name} onChange={handleChange} className={inputClass} disabled={loadingPerson} />
                </div>
                {formData.gender === 'female' && (
                  <div>
                    <label className={labelClass}>Девичья фамилия</label>
                    <input type="text" name="maiden_name" value={formData.maiden_name} onChange={handleChange} className={inputClass} disabled={loadingPerson} />
                  </div>
                )}
                <div>
                  <label className={labelClass}>Пол</label>
                  <select name="gender" value={formData.gender} onChange={handleChange} className={inputClass} disabled={loadingPerson}>
                    <option value="male">Мужской</option>
                    <option value="female">Женский</option>
                    <option value="unknown">Неизвестно</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass}>Псевдонимы / Прозвища</label>
                <input type="text" name="aliases" value={formData.aliases} onChange={handleChange} className={inputClass} disabled={loadingPerson} />
              </div>

              <div>
                <label className={labelClass}>Фото (URL)</label>
                <input
                  type="url"
                  name="photo_url"
                  placeholder="https://..."
                  value={formData.photo_url}
                  onChange={handleChange}
                  className={inputClass}
                  disabled={loadingPerson}
                />
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input
                    type="checkbox"
                    name="is_alive"
                    checked={formData.is_alive}
                    onChange={handleChange}
                    className="rounded text-blue-600 focus:ring-blue-500"
                    disabled={loadingPerson}
                  />
                  Человек жив
                </label>
              </div>
            </div>
          )}

          {/* Таб 2: События */}
          {activeTab === 'events' && (
            <div className="space-y-4">
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-gray-500 uppercase">Рождение</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Дата рождения</label>
                    <input
                      type="text"
                      name="birth_date"
                      placeholder="12.05.1945 или около 1945"
                      value={formData.birth_date}
                      onChange={handleChange}
                      className={inputClass}
                      disabled={loadingPerson}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Место рождения</label>
                    <input type="text" name="birth_place" value={formData.birth_place} onChange={handleChange} className={inputClass} disabled={loadingPerson} />
                  </div>
                </div>
              </div>

              {!formData.is_alive && (
                <div className="space-y-3 pt-3 border-t border-gray-200">
                  <h4 className="text-xs font-bold text-gray-500 uppercase">Смерть и Погребение</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Дата смерти</label>
                      <input type="text" name="death_date" placeholder="20.01.2018" value={formData.death_date} onChange={handleChange} className={inputClass} disabled={loadingPerson} />
                    </div>
                    <div>
                      <label className={labelClass}>Место смерти</label>
                      <input type="text" name="death_place" value={formData.death_place} onChange={handleChange} className={inputClass} disabled={loadingPerson} />
                    </div>
                    <div className="col-span-full">
                      <label className={labelClass}>Причина смерти</label>
                      <input type="text" name="death_cause" value={formData.death_cause} onChange={handleChange} className={inputClass} disabled={loadingPerson} />
                    </div>
                    <div>
                      <label className={labelClass}>Кладбище</label>
                      <input type="text" name="cemetery_name" value={formData.cemetery_name} onChange={handleChange} className={inputClass} disabled={loadingPerson} />
                    </div>
                    <div>
                      <label className={labelClass}>Участок / Могила</label>
                      <input type="text" name="cemetery_plot" value={formData.cemetery_plot} onChange={handleChange} className={inputClass} disabled={loadingPerson} />
                    </div>
                    <div className="col-span-full">
                      <label className={labelClass}>GPS-координаты</label>
                      <input
                        type="text"
                        name="cemetery_gps"
                        placeholder="55.7558, 37.6173"
                        value={formData.cemetery_gps}
                        onChange={handleChange}
                        className={inputClass}
                        disabled={loadingPerson}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3 pt-3 border-t border-gray-200">
                <h4 className="text-xs font-bold text-gray-500 uppercase">Эмиграция / Переезд</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Дата</label>
                    <input type="text" name="immigration_date" value={formData.immigration_date} onChange={handleChange} className={inputClass} disabled={loadingPerson} />
                  </div>
                  <div>
                    <label className={labelClass}>Порт / Направление</label>
                    <input type="text" name="immigration_port" value={formData.immigration_port} onChange={handleChange} className={inputClass} disabled={loadingPerson} />
                  </div>
                  <div className="col-span-full">
                    <label className={labelClass}>Документ</label>
                    <input type="text" name="immigration_doc" value={formData.immigration_doc} onChange={handleChange} className={inputClass} disabled={loadingPerson} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Таб 3: Социум и Служба */}
          {activeTab === 'social' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Профессия / Занятия</label>
                  <input type="text" name="occupations" value={formData.occupations} onChange={handleChange} className={inputClass} disabled={loadingPerson} />
                </div>
                <div>
                  <label className={labelClass}>Образование</label>
                  <input type="text" name="education" value={formData.education} onChange={handleChange} className={inputClass} disabled={loadingPerson} />
                </div>
                <div>
                  <label className={labelClass}>Социальный статус</label>
                  <input type="text" name="social_status" value={formData.social_status} onChange={handleChange} className={inputClass} disabled={loadingPerson} />
                </div>
                <div>
                  <label className={labelClass}>Вероисповедание</label>
                  <input type="text" name="religion" value={formData.religion} onChange={handleChange} className={inputClass} disabled={loadingPerson} />
                </div>
              </div>

              <div>
                <label className={labelClass}>Места проживания</label>
                <input type="text" name="residences" value={formData.residences} onChange={handleChange} className={inputClass} disabled={loadingPerson} />
              </div>

              <div className="pt-3 border-t border-gray-200 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-800">
                  <input
                    type="checkbox"
                    name="military_is_served"
                    checked={formData.military_is_served}
                    onChange={handleChange}
                    className="rounded text-blue-600 focus:ring-blue-500"
                    disabled={loadingPerson}
                  />
                  Проходил(а) военную службу
                </label>

                {formData.military_is_served && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-amber-50/50 p-3 rounded-lg border border-amber-100">
                    <div>
                      <label className={labelClass}>Звание / Чин</label>
                      <input type="text" name="military_rank" value={formData.military_rank} onChange={handleChange} className={`${inputClass} bg-white`} disabled={loadingPerson} />
                    </div>
                    <div>
                      <label className={labelClass}>Полк / Подразделение</label>
                      <input type="text" name="military_regiment" value={formData.military_regiment} onChange={handleChange} className={`${inputClass} bg-white`} disabled={loadingPerson} />
                    </div>
                    <div className="col-span-full">
                      <label className={labelClass}>Войны / Сражения</label>
                      <input type="text" name="military_battles" value={formData.military_battles} onChange={handleChange} className={`${inputClass} bg-white`} disabled={loadingPerson} />
                    </div>
                    <div className="col-span-full">
                      <label className={labelClass}>Награды</label>
                      <input type="text" name="military_awards" value={formData.military_awards} onChange={handleChange} className={`${inputClass} bg-white`} disabled={loadingPerson} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Таб 4: Биография */}
          {activeTab === 'bio' && (
            <div>
              <label className={labelClass}>Развернутая биография</label>
              <textarea
                name="biography"
                rows={8}
                value={formData.biography}
                onChange={handleChange}
                placeholder="Расскажите историю жизни..."
                className={`${inputClass} resize-none`}
                disabled={loadingPerson}
              />
            </div>
          )}

          {/* Подвал */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Сохранение...' : loadingPerson ? 'Загрузка...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};