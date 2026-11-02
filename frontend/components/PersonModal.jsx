'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, User, FileText, AlertCircle, Loader2, Calendar } from 'lucide-react';
import { useRelationActions } from '@/hooks/useRelationActions';
import { apiFetch } from '@/lib/api';

const EMPTY_FORM = {
  first_name: '',
  last_name: '',
  patronymic: '',
  maiden_name: '',
  nicknames: '',
  aliases: '',
  gender: 'U',
  is_alive: true,
  photo_url: '',
  birth_date: '',
  birth_place: '',
  death_date: '',
  death_place: '',
  biography: '',
};

function personToForm(p) {
  return {
    ...EMPTY_FORM,
    first_name: p.first_name || '',
    last_name: p.last_name || '',
    patronymic: p.patronymic || '',
    maiden_name: p.maiden_name || '',
    nicknames: p.nicknames || '',
    aliases: p.aliases || '',
    gender: p.gender || 'U',
    is_alive: p.is_alive !== undefined ? p.is_alive : true,
    photo_url: p.photo_url || '',
    birth_date: p.birth_date || '',
    birth_place: p.birth_place || '',
    death_date: p.death_date || '',
    death_place: p.death_place || '',
    biography: p.biography || '',
  };
}

export const PersonModal = ({
  isOpen,
  mode,
  personData,
  treeId,
  onClose,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState('basic');
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [loadingPerson, setLoadingPerson] = useState(false);
  const [error, setError] = useState(null);

  const actions = useRelationActions();

  useEffect(() => {
    if (!isOpen) return;

    setActiveTab('basic');
    setError(null);
    setSaving(false);

    if (mode === 'add') {
      setFormData(EMPTY_FORM);
      setLoadingPerson(false);
      return;
    }

    if (mode === 'edit' && personData?.id) {
      setLoadingPerson(true);
      setFormData(personToForm(personData));

      apiFetch(`/api/individuals/${personData.id}`)
        .then((res) => {
          if (!res.ok) throw new Error(`Не удалось загрузить данные (${res.status})`);
          return res.json();
        })
        .then((full) => setFormData(personToForm(full)))
        .catch((err) => {
          console.error(err);
          setError(
            'Не удалось загрузить полные данные. Редактирование может привести к потере полей.'
          );
        })
        .finally(() => setLoadingPerson(false));
    }
  }, [personData?.id, mode, isOpen]);

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
      first_name: nullable(formData.first_name),
      last_name: nullable(formData.last_name),
      patronymic: nullable(formData.patronymic),
      maiden_name: nullable(formData.maiden_name),
      nicknames: nullable(formData.nicknames),
      aliases: nullable(formData.aliases),
      gender: formData.gender,
      is_alive: isAlive,
      photo_url: nullable(formData.photo_url),
      birth_date: nullable(formData.birth_date),
      birth_place: nullable(formData.birth_place),
      death_date: isAlive ? null : nullable(formData.death_date),
      death_place: isAlive ? null : nullable(formData.death_place),
      biography: nullable(formData.biography),
    };

    try {
      if (mode === 'edit') {
        await actions.updateIndividual(personData.id, payload);
      } else {
        if (!treeId) throw new Error('Не указано дерево');
        await actions.createIndividual(treeId, payload);
      }
      onRefresh?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const inputClass =
    'w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-50 disabled:text-gray-500';
  const labelClass = 'block text-xs font-semibold text-gray-600 mb-1';

  const busy = saving || loadingPerson;

  const tabs = [
    { id: 'basic', label: 'Основное', Icon: User },
    { id: 'events', label: 'События', Icon: Calendar },
    { id: 'bio', label: 'Биография', Icon: FileText },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Шапка */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-lg text-gray-800">
            {mode === 'edit'
              ? `Редактирование: ${personData?.first_name || ''}`
              : 'Добавление человека'}
          </h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Вкладки */}
        <div className="flex border-b border-gray-200 px-6 bg-slate-50 gap-2">
          {tabs.map(({ id, label, Icon }) => (
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

        {loadingPerson && (
          <div className="mx-6 mt-4 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            Загружаем полные данные карточки...
          </div>
        )}

        {error && (
          <div className="mx-6 mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* --- Основное --- */}
          {activeTab === 'basic' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Имя</label>
                  <input
                    type="text"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleChange}
                    className={inputClass}
                    disabled={loadingPerson}
                  />
                </div>
                <div>
                  <label className={labelClass}>Фамилия</label>
                  <input
                    type="text"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleChange}
                    className={inputClass}
                    disabled={loadingPerson}
                  />
                </div>
                <div>
                  <label className={labelClass}>Отчество</label>
                  <input
                    type="text"
                    name="patronymic"
                    value={formData.patronymic}
                    onChange={handleChange}
                    className={inputClass}
                    disabled={loadingPerson}
                  />
                </div>
                <div>
                  <label className={labelClass}>Девичья фамилия</label>
                  <input
                    type="text"
                    name="maiden_name"
                    value={formData.maiden_name}
                    onChange={handleChange}
                    className={inputClass}
                    disabled={loadingPerson}
                  />
                </div>
                <div>
                  <label className={labelClass}>Пол</label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    className={inputClass}
                    disabled={loadingPerson}
                  >
                    <option value="M">Мужской</option>
                    <option value="F">Женский</option>
                    <option value="U">Неизвестно</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Прозвища</label>
                  <input
                    type="text"
                    name="nicknames"
                    value={formData.nicknames}
                    onChange={handleChange}
                    className={inputClass}
                    disabled={loadingPerson}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Псевдонимы</label>
                <input
                  type="text"
                  name="aliases"
                  value={formData.aliases}
                  onChange={handleChange}
                  className={inputClass}
                  disabled={loadingPerson}
                />
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

          {/* --- События --- */}
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
                      placeholder="12 мая 1945 или около 1945"
                      value={formData.birth_date}
                      onChange={handleChange}
                      className={inputClass}
                      disabled={loadingPerson}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Место рождения</label>
                    <input
                      type="text"
                      name="birth_place"
                      value={formData.birth_place}
                      onChange={handleChange}
                      className={inputClass}
                      disabled={loadingPerson}
                    />
                  </div>
                </div>
              </div>

              {!formData.is_alive && (
                <div className="space-y-3 pt-3 border-t border-gray-200">
                  <h4 className="text-xs font-bold text-gray-500 uppercase">
                    Смерть и погребение
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Дата смерти</label>
                      <input
                        type="text"
                        name="death_date"
                        placeholder="20 января 2018"
                        value={formData.death_date}
                        onChange={handleChange}
                        className={inputClass}
                        disabled={loadingPerson}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Место смерти</label>
                      <input
                        type="text"
                        name="death_place"
                        value={formData.death_place}
                        onChange={handleChange}
                        className={inputClass}
                        disabled={loadingPerson}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3 text-xs text-gray-500">
                Расширенные события (карьера, служба, образование, эмиграция, погребение)
                появятся в следующем обновлении — они хранятся в отдельной таблице событий.
              </div>
            </div>
          )}

          {/* --- Биография --- */}
          {activeTab === 'bio' && (
            <div>
              <label className={labelClass}>Биография</label>
              <textarea
                name="biography"
                rows={10}
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