'use client';

import React from 'react';
import {
  Baby, Cross, Flame, Droplet, Heart, HeartOff, Gem,
  Home, Briefcase, GraduationCap, Shield, Plane, BookOpen, Activity,
} from 'lucide-react';
import { formatDateRu } from '@/lib/format';

const EVENT_META = {
  BIRT: { Icon: Baby,            label: 'Рождение',          color: 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300' },
  DEAT: { Icon: Cross,           label: 'Смерть',            color: 'bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-slate-300' },
  BURI: { Icon: Cross,           label: 'Погребение',        color: 'bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-slate-300' },
  CREM: { Icon: Flame,           label: 'Кремация',          color: 'bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300' },
  BAPM: { Icon: Droplet,         label: 'Крещение',          color: 'bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300' },
  MARR: { Icon: Heart,           label: 'Брак',              color: 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300' },
  DIV:  { Icon: HeartOff,        label: 'Развод',            color: 'bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-slate-300' },
  ENGA: { Icon: Gem,             label: 'Помолвка',          color: 'bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-300' },
  RESI: { Icon: Home,            label: 'Проживание',        color: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' },
  OCCU: { Icon: Briefcase,       label: 'Профессия',         color: 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300' },
  EDUC: { Icon: GraduationCap,   label: 'Образование',       color: 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300' },
  MILI: { Icon: Shield,          label: 'Военная служба',    color: 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300' },
  IMMI: { Icon: Plane,           label: 'Иммиграция',        color: 'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300' },
  EMIG: { Icon: Plane,           label: 'Эмиграция',         color: 'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300' },
  RELI: { Icon: BookOpen,        label: 'Вероисповедание',   color: 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300' },
  OTHER:{ Icon: Activity,        label: 'Событие',           color: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300' },
};

function extractYear(dateStr) {
  if (!dateStr) return 9999;
  const m = String(dateStr).match(/\b(\d{4})\b/);
  return m ? parseInt(m[1], 10) : 9999;
}

function sortEvents(events) {
  if (!events || events.length === 0) return [];
  return [...events].sort((a, b) => {
    if (a.event_type === 'BIRT') return -1;
    if (b.event_type === 'BIRT') return 1;
    if (a.event_type === 'DEAT') return 1;
    if (b.event_type === 'DEAT') return -1;
    return extractYear(a.date_str) - extractYear(b.date_str);
  });
}

export function EventTimeline({ events, onEdit, onDelete, busy = false }) {
  if (!events || events.length === 0) {
    return (
      <span className="text-xs text-gray-400 dark:text-slate-500">Событий пока нет</span>
    );
  }

  const sorted = sortEvents(events);

  return (
    <ol className="relative space-y-2 border-l-2 border-slate-200 dark:border-slate-700 ml-2 pl-4">
      {sorted.map((ev) => {
        const meta = EVENT_META[ev.event_type] || EVENT_META.OTHER;
        const { Icon } = meta;
        return (
          <li key={ev.id} className="relative">
            <div className="absolute -left-[26px] top-2 w-4 h-4 rounded-full bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 flex items-center justify-center">
              <span className={`w-1.5 h-1.5 rounded-full ${meta.color.split(' ')[0].replace('bg-', 'bg-').replace('-100', '-400')}`} />
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-2 text-xs transition-colors">
              <div className="flex items-start gap-2">
                <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${meta.color}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-800 dark:text-slate-100">{meta.label}</span>
                    {ev.date_str && (
                      <span className="text-gray-500 dark:text-slate-400">{formatDateRu(ev.date_str)}</span>
                    )}
                  </div>
                  {ev.place?.name && (
                    <div className="text-gray-500 dark:text-slate-400 text-[11px] mt-0.5">
                      {ev.place.name}
                    </div>
                  )}
                  {ev.description && (
                    <div className="text-gray-700 dark:text-slate-300 mt-1">{ev.description}</div>
                  )}
                </div>
                {(onEdit || onDelete) && (
                  <div className="shrink-0 flex gap-0.5">
                    {onEdit && (
                      <button
                        type="button"
                        onClick={() => onEdit(ev)}
                        disabled={busy}
                        className="p-1 text-gray-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 rounded disabled:opacity-40"
                        title="Редактировать"
                      >
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                      </button>
                    )}
                    {onDelete && (
                      <button
                        type="button"
                        onClick={() => onDelete(ev)}
                        disabled={busy}
                        className="p-1 text-gray-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 rounded disabled:opacity-40"
                        title="Удалить"
                      >
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}