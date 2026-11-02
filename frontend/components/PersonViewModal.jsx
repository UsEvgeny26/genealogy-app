'use client';

import React from 'react';
import { X, User, Calendar, MapPin, FileText } from 'lucide-react';
import { fullName, formatDateRu } from '@/lib/format';

export const PersonViewModal = ({ person, isOpen, onClose }) => {
  if (!isOpen || !person) return null;

  const isMale = person.gender === 'M' || person.gender === 'male';
  const isFemale = person.gender === 'F' || person.gender === 'female';

  const avatarClass = isMale ? 'bg-blue-500' : isFemale ? 'bg-pink-500' : 'bg-gray-500';
  const genderBadge = isMale
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

        <div className="p-6 space-y-6">
          {/* Аватар и ФИО */}
          <div className="flex items-center gap-4 border-b border-gray-100 pb-4">
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold shrink-0 ${avatarClass}`}
            >
              {person.photo_url ? (
                <img src={person.photo_url} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                <User className="w-8 h-8" />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-gray-900 truncate">
                {fullName(person)}
              </h2>
              <span
                className={`inline-block mt-1 text-xs px-2.5 py-0.5 rounded-full font-medium ${genderBadge}`}
              >
                {genderLabel}
              </span>
            </div>
          </div>

          {/* Даты и место */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="flex items-start gap-2.5 text-gray-700">
              <Calendar className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <div className="text-xs text-gray-500">Годы жизни</div>
                <div>
                  {formatDateRu(person.birth_date) || '???'} —{' '}
                  {person.is_alive === false
                    ? formatDateRu(person.death_date) || '???'
                    : 'Наст. время'}
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

          {/* Биография (краткая) */}
          {person.biography && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase">
                <FileText className="w-3.5 h-3.5" /> Биография
              </div>
              <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-xl leading-relaxed whitespace-pre-line line-clamp-6">
                {person.biography}
              </p>
            </div>
          )}

          <div className="pt-3 border-t border-gray-100 text-center text-xs text-gray-400">
            Войдите, чтобы увидеть полную карточку и семейные связи
          </div>
        </div>
      </div>
    </div>
  );
};