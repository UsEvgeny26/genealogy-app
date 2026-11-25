'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, User, FileText, AlertCircle, Loader2, Calendar, Info } from 'lucide-react';
import { useRelationActions } from '@/hooks/useRelationActions';
import { apiFetch } from '@/lib/api';
import { EventTimeline } from './EventTimeline';
import { useEventActions } from '@/hooks/useEventActions';
import { useDialog } from './DialogProvider';
import { PhotoUpload } from './PhotoUpload';

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
  const [events, setEvents] = useState([]);
  const [pendingEvents, setPendingEvents] = useState([]);
  const pendingIdRef = useRef(0);
  const [eventForm, setEventForm] = useState(null);
  const [busyEvent, setBusyEvent] = useState(false);

  const eventActions = useEventActions();
  const dialog = useDialog();
  const actions = useRelationActions();

  useEffect(() => {
    if (!isOpen) return;

    setActiveTab('basic');
    setError(null);
    setSaving(false);

    if (mode === 'add') {
      setFormData(EMPTY_FORM);
      setEvents([]);
      setPendingEvents([]);   
      setEventForm(null);
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
        .then((full) => {
          setFormData(personToForm(full));
          setEvents(full.events || []);
        })
        .catch((err) => {
          console.error(err);
          setError('Не удалось загрузить полные данные. Редактирование может привести к потере полей.');
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
        const created = await actions.createIndividual(treeId, payload);

        if (pendingEvents.length > 0) {
          const failed = [];
          for (const pe of pendingEvents) {
            try {
              await eventActions.createIndividualEvent(created.id, {
                event_type: pe.event_type,
                date_str: pe.date_str || null,
                place_name: pe.place?.name || null,
                description: pe.description || null,
              });
            } catch (e) {
              console.error('Event create error', e);
              failed.push(pe);
            }
          }
          if (failed.length > 0) {
            await dialog.alert({
              title: 'Персона создана, но не все события',
              description: `${failed.length} из ${pendingEvents.length} событий не удалось сохранить. Добавьте их вручную в редактировании.`,
              variant: 'warning',
              confirmLabel: 'Понятно',
            });
          }
        }
      }
      onRefresh?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const reloadEvents = useCallback(async () => {
    if (mode !== 'edit' || !personData?.id) return;
    try {
      const res = await apiFetch(`/api/individuals/${personData.id}`);
      if (!res.ok) return;
      const full = await res.json();
      setEvents(full.events || []);
      setFormData(personToForm(full));
    } catch (e) {
      console.error(e);
    }
  }, [mode, personData?.id]);

  const startNewEvent = () => {
    setEventForm({ event_type: 'OCCU', date_str: '', place_name: '', description: '' });
  };

  const startEditEvent = (ev) => {
    setEventForm({
      id: ev.id,
      event_type: ev.event_type,
      date_str: ev.date_str || '',
      place_name: ev.place?.name || '',
      description: ev.description || '',
    });
  };

  const cancelEventForm = () => setEventForm(null);

  const saveEvent = async () => {
    if (!eventForm) return;
    if (mode === 'add') {
      if (eventForm.id) {
        setPendingEvents((prev) =>
          prev.map((e) => (e.id === eventForm.id ? { ...e, ...eventForm, place_name: eventForm.place_name } : e))
        );
      } else {
        pendingIdRef.current += 1;
        const tmpId = `tmp-${pendingIdRef.current}`;
        setPendingEvents((prev) => [
          ...prev,
          {
            id: tmpId,
            event_type: eventForm.event_type,
            date_str: eventForm.date_str,
            description: eventForm.description,
            place: eventForm.place_name ? { name: eventForm.place_name } : null,
          },
        ]);
      }
      setEventForm(null);
      return;
    }

    if (!personData?.id) return;
    setBusyEvent(true);
    try {
      const payload = {
        event_type: eventForm.event_type,
        date_str: eventForm.date_str || null,
        place_name: eventForm.place_name || null,
        description: eventForm.description || null,
      };
      if (eventForm.id) {
        await eventActions.updateEvent(eventForm.id, payload);
      } else {
        await eventActions.createIndividualEvent(personData.id, payload);
      }
      setEventForm(null);
      await reloadEvents();
      onRefresh?.();
    } catch (err) {
      await dialog.alert({
        title: 'Ошибка сохранения события',
        description: err.message || 'Не удалось сохранить событие',
        variant: 'danger',
        confirmLabel: 'Понятно',
      });
    } finally {
      setBusyEvent(false);
    }
  };

  const handleDeleteEvent = async (ev) => {
    const ok = await dialog.confirm({
      title: 'Удалить событие?',
      description: 'Это действие нельзя отменить.',
      variant: 'danger',
      confirmLabel: 'Удалить',
    });
    if (!ok) return;

    if (mode === 'add') {
      setPendingEvents((prev) => prev.filter((e) => e.id !== ev.id));
      return;
    }

    setBusyEvent(true);
    try {
      await eventActions.deleteEvent(ev.id);
      await reloadEvents();
      onRefresh?.();
    } catch (err) {
      await dialog.alert({
        title: 'Ошибка',
        description: err.message || 'Не удалось удалить',
        variant: 'danger',
        confirmLabel: 'Понятно',
      });
    } finally {
      setBusyEvent(false);
    }
  };

  if (!isOpen) return null;

  const inputClass =
    'w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-100 border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-50 dark:disabled:bg-slate-800 disabled:text-gray-500 dark:disabled:text-slate-500';
  const labelClass = 'block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1';

  const busy = saving || loadingPerson;

  const tabs = [
    { id: 'basic', label: 'Основное', Icon: User },
    { id: 'events', label: 'События', Icon: Calendar },
    { id: 'bio', label: 'Биография', Icon: FileText },
  ];

  const EVENT_TYPE_OPTIONS = [
    { value: 'BIRT', label: 'Рождение' },
    { value: 'DEAT', label: 'Смерть' },
    { value: 'BURI', label: 'Погребение' },
    { value: 'CREM', label: 'Кремация' },
    { value: 'BAPM', label: 'Крещение' },
    { value: 'MARR', label: 'Брак' },
    { value: 'DIV',  label: 'Развод' },
    { value: 'ENGA', label: 'Помолвка' },
    { value: 'RESI', label: 'Проживание' },
    { value: 'OCCU', label: 'Профессия / Занятие' },
    { value: 'EDUC', label: 'Образование' },
    { value: 'MILI', label: 'Военная служба' },
    { value: 'IMMI', label: 'Иммиграция' },
    { value: 'EMIG', label: 'Эмиграция' },
    { value: 'RELI', label: 'Вероисповедание' },
    { value: 'OTHER', label: 'Другое' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden transition-colors">
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 dark:border-slate-700">
          <h3 className="font-semibold text-lg text-gray-800 dark:text-slate-100">
            {mode === 'edit' ? `Редактирование: ${personData?.first_name || ''}` : 'Добавление человека'}
          </h3>
          <button onClick={onClose} className="p-1 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-gray-200 dark:border-slate-700 px-6 bg-slate-50 dark:bg-slate-800/50 gap-2">
          {tabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              disabled={loadingPerson}
              className={`py-2.5 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors disabled:opacity-50 ${
                activeTab === id
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>

        {loadingPerson && (
          <div className="mx-6 mt-4 flex items-center gap-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 p-3 text-xs text-blue-800 dark:text-blue-300">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            Загружаем полные данные карточки...
          </div>
        )}

        {error && (
          <div className="mx-6 mt-4 flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 p-3 text-xs text-red-800 dark:text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === 'basic' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Имя</label>
                  <input type="text" name="first_name" value={formData.first_name} onChange={handleChange} className={inputClass} disabled={loadingPerson} />
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
                  <label className={labelClass}>Девичья фамилия</label>
                  <input type="text" name="maiden_name" value={formData.maiden_name} onChange={handleChange} className={inputClass} disabled={loadingPerson} />
                </div>
                <div>
                  <label className={labelClass}>Пол</label>
                  <select name="gender" value={formData.gender} onChange={handleChange} className={inputClass} disabled={loadingPerson}>
                    <option value="M">Мужской</option>
                    <option value="F">Женский</option>
                    <option value="U">Неизвестно</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Прозвища</label>
                  <input type="text" name="nicknames" value={formData.nicknames} onChange={handleChange} className={inputClass} disabled={loadingPerson} />
                </div>
              </div>

              <div>
                <label className={labelClass}>Псевдонимы</label>
                <input type="text" name="aliases" value={formData.aliases} onChange={handleChange} className={inputClass} disabled={loadingPerson} />
              </div>

              <PhotoUpload
                value={formData.photo_url}
                onChange={(url) => setFormData((f) => ({ ...f, photo_url: url }))}
                disabled={loadingPerson}
                treeId={treeId}
              />

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-slate-300">
                  <input type="checkbox" name="is_alive" checked={formData.is_alive} onChange={handleChange} className="rounded text-blue-600 focus:ring-blue-500" disabled={loadingPerson} />
                  Человек жив
                </label>
              </div>
            </div>
          )}

          {activeTab === 'events' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">
                  События ({mode === 'add' ? pendingEvents.length : events.length})
                </span>
                {!eventForm && (
                  <button type="button" onClick={startNewEvent} disabled={loadingPerson || busyEvent} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 rounded disabled:opacity-50">
                    + Добавить
                  </button>
                )}
              </div>

              {eventForm && (
                <div className="flex items-start gap-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 px-3 py-2 text-xs text-blue-800 dark:text-blue-300">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>Сохраните или отмените текущее событие, чтобы редактировать другие.</span>
                </div>
              )}

              <EventTimeline
                events={mode === 'add' ? pendingEvents : events}
                onEdit={(ev) => startEditEvent(ev)}
                onDelete={(ev) => handleDeleteEvent(ev)}
                busy={busyEvent || Boolean(eventForm)}
              />

              {eventForm && (
                <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30 p-3 space-y-2">
                  <div className="text-xs font-semibold text-blue-900 dark:text-blue-300">
                    {eventForm.id ? 'Редактирование события' : 'Новое событие'}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <label className={labelClass}>Тип</label>
                      <select value={eventForm.event_type} onChange={(e) => setEventForm((f) => ({ ...f, event_type: e.target.value }))} className={inputClass} disabled={busyEvent}>
                        {EVENT_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Дата</label>
                      <input type="text" placeholder="11 мая 2023" value={eventForm.date_str} onChange={(e) => setEventForm((f) => ({ ...f, date_str: e.target.value }))} className={inputClass} disabled={busyEvent} />
                    </div>
                    <div>
                      <label className={labelClass}>Место</label>
                      <input type="text" placeholder="Москва" value={eventForm.place_name} onChange={(e) => setEventForm((f) => ({ ...f, place_name: e.target.value }))} className={inputClass} disabled={busyEvent} />
                    </div>
                    <div>
                      <label className={labelClass}>Описание</label>
                      <input type="text" placeholder="Инженер-конструктор" value={eventForm.description} onChange={(e) => setEventForm((f) => ({ ...f, description: e.target.value }))} className={inputClass} disabled={busyEvent} />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={cancelEventForm} disabled={busyEvent} className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg disabled:opacity-50">
                      Отмена
                    </button>
                    <button type="button" onClick={saveEvent} disabled={busyEvent} className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">
                      {busyEvent ? 'Сохранение...' : 'Сохранить'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'bio' && (
            <div>
              <label className={labelClass}>Биография</label>
              <textarea name="biography" rows={10} value={formData.biography} onChange={handleChange} placeholder="Расскажите историю жизни..." className={`${inputClass} resize-none`} disabled={loadingPerson} />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-700">
            <button type="button" onClick={onClose} disabled={busy} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg disabled:opacity-50">
              Отмена
            </button>
            <button type="submit" disabled={busy} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-60 disabled:cursor-not-allowed">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Сохранение...' : loadingPerson ? 'Загрузка...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};