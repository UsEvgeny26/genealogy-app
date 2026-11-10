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
    ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
    : isFemale
      ? 'bg-pink-50 dark:bg-pink-950 text-pink-700 dark:text-pink-300'
      : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300';
      
  const genderLabel = isMale ? 'Мужской' : isFemale ? 'Женский' : 'Неизвестно';

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden relative transition-colors">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-400 rounded-full transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 space-y-6">
          <div className="flex items-center gap-4 border-b border-gray-100 dark:border-slate-700 pb-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold shrink-0 ${avatarClass}`}>
              {person.photo_url ? (
                <img src={person.photo_url} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                <User className="w-8 h-8" />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 truncate">
                {fullName(person)}
              </h2>
              <span className={`inline-block mt-1 text-xs px-2.5 py-0.5 rounded-full font-medium ${genderBadge}`}>
                {genderLabel}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="flex items-start gap-2.5 text-gray-700 dark:text-slate-300">
              <Calendar className="w-4 h-4 text-gray-400 dark:text-slate-500 mt-0.5 shrink-0" />
              <div>
                <div className="text-xs text-gray-500 dark:text-slate-400">Годы жизни</div>
                <div>
                  {formatDateRu(person.birth_date) || '???'} —{' '}
                  {person.is_alive === false
                    ? formatDateRu(person.death_date) || '???'
                    : 'Наст. время'}
                </div>
              </div>
            </div>

            {person.birth_place && (
              <div className="flex items-start gap-2.5 text-gray-700 dark:text-slate-300">
                <MapPin className="w-4 h-4 text-gray-400 dark:text-slate-500 mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs text-gray-500 dark:text-slate-400">Место рождения</div>
                  <div>{person.birth_place}</div>
                </div>
              </div>
            )}
          </div>

          {person.biography && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">
                <FileText className="w-3.5 h-3.5" /> Биография
              </div>
              <p className="text-sm text-gray-700 dark:text-slate-300 bg-gray-50 dark:bg-slate-900 p-3 rounded-xl leading-relaxed whitespace-pre-line line-clamp-6">
                {person.biography}
              </p>
            </div>
          )}

          <div className="pt-3 border-t border-gray-100 dark:border-slate-700 text-center text-xs text-gray-400 dark:text-slate-500">
            Войдите, чтобы увидеть полную карточку и семейные связи
          </div>
        </div>
      </div>
    </div>
  );
};