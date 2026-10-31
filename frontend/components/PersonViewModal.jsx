'use client';

import React, { useEffect, useState } from 'react';
import { X, User, Calendar, MapPin, FileText, HeartHandshake, Loader2, AlertCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api';

export const PersonViewModal = ({ personId, isOpen, onClose }) => {
  const [person, setPerson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!personId || !isOpen) return;

    setPerson(null);
    setError(null);
    setLoading(true);

    apiFetch(`/api/persons/${personId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Не удалось загрузить карточку (${res.status})`);
        return res.json();
      })
      .then(setPerson)
      .catch((err) => {
        console.error('Ошибка загрузки карточки:', err);
        setError(err.message || 'Ошибка загрузки');
      })
      .finally(() => setLoading(false));
  }, [personId, isOpen]);

  if (!isOpen) return null;

  const isMale = person?.gender === 'male';
  const isFemale = person?.gender === 'female';

  const avatarClass = isMale ? 'bg-blue-500' : isFemale ? 'bg-pink-500' : 'bg-gray-500';
  const badgeClass = isMale
    ? 'bg-blue-50 text-blue-700'
    : isFemale
      ? 'bg-pink-50 text-pink-700'
      : 'bg-gray-100 text-gray-700';
  const genderLabel = isMale ? 'Мужской' : isFemale ? 'Женский' : 'Неизвестно';

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {loading ? (
          <div className="p-8 flex items-center justify-center gap-2 text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Загрузка информации...
          </div>
        ) : error ? (
          <div className="p-8 flex items-start gap-2 text-sm text-red-700 bg-red-50">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            {error}
          </div>
        ) : person ? (
          <div className="p-6 space-y-6">
            {/* Аватар и ФИО */}
            <div className="flex items-center gap-4 border-b border-gray-100 pb-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold shrink-0 ${avatarClass}`}>
                {person.photo_url ? (
                  <img src={person.photo_url} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <User className="w-8 h-8" />
                )}
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-gray-900 truncate">
                  {[person.first_name, person.patronymic, person.last_name].filter(Boolean).join(' ')}
                </h2>
                {person.maiden_name && !isMale && (
                  <p className="text-xs text-gray-500">Девичья фамилия: {person.maiden_name}</p>
                )}
                <span className={`inline-block mt-1 text-xs px-2.5 py-0.5 rounded-full font-medium ${badgeClass}`}>
                  {genderLabel}
                </span>
              </div>
            </div>

            {/* Даты и Место */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="flex items-start gap-2.5 text-gray-700">
                <Calendar className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs text-gray-500">Годы жизни</div>
                  <div>
                    {person.birth_date || '???'} —{' '}
                    {person.is_alive === false ? person.death_date || '???' : 'Наст. время'}
                  </div>
                </div>
              </div>

              {person.birth_place && (
                <div className="flex items-start gap-2.5 text-gray-700">
                  <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs text-gray-500">Место рождения</div>
                    <div>{person.birth_place}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Биография (краткий фрагмент) */}
            {person.biography && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase">
                  <FileText className="w-3.5 h-3.5" /> Биография
                </div>
                <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-xl leading-relaxed whitespace-pre-line line-clamp-4">
                  {person.biography}
                </p>
              </div>
            )}

            {/* Родители и Дети */}
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100 text-sm">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase mb-2">
                  <HeartHandshake className="w-3.5 h-3.5" /> Родители ({person.parents?.length || 0})
                </div>
                <div className="space-y-1">
                  {person.parents?.length > 0 ? (
                    person.parents.map((p) => (
                      <div key={p.id} className="text-xs bg-slate-100 px-2.5 py-1.5 rounded-lg text-gray-700 truncate">
                        {[p.first_name, p.last_name].filter(Boolean).join(' ')}
                      </div>
                    ))
                  ) : (
                    <span className="text-xs text-gray-400">Не указаны</span>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase mb-2">
                  <HeartHandshake className="w-3.5 h-3.5" /> Дети ({person.children?.length || 0})
                </div>
                <div className="space-y-1">
                  {person.children?.length > 0 ? (
                    person.children.map((c) => (
                      <div key={c.id} className="text-xs bg-slate-100 px-2.5 py-1.5 rounded-lg text-gray-700 truncate">
                        {[c.first_name, c.last_name].filter(Boolean).join(' ')}
                      </div>
                    ))
                  ) : (
                    <span className="text-xs text-gray-400">Не указаны</span>
                  )}
                </div>
              </div>
            </div>

            {/* Подсказка гостю */}
            <div className="pt-3 border-t border-gray-100 text-center text-xs text-gray-400">
              Войдите, чтобы увидеть полную карточку
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};