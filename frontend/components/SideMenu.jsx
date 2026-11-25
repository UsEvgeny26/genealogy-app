'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
  X, ArrowDown, ArrowUp, ArrowRight, ArrowLeft, Check,
  Sun, Moon, Palette, Eye, Rows3, Download, Upload, Loader2, Sparkles 
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

function Section({ title, children, badge }) {
  return (
    <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800 last:border-b-0">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
          {title}
        </span>
        {badge && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400">
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function OptionButton({ active, icon: Icon, label, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
        active
          ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 ring-1 ring-blue-200 dark:ring-blue-800'
          : disabled
            ? 'text-gray-300 dark:text-slate-600 cursor-not-allowed'
            : 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800'
      }`}
    >
      {Icon && <Icon className="w-4 h-4 shrink-0" />}
      <span className="flex-1 text-left">{label}</span>
      {active && <Check className="w-3.5 h-3.5" />}
    </button>
  );
}

const DIRECTIONS = [
  { value: 'TB', label: 'Сверху вниз',   Icon: ArrowDown },
  { value: 'BT', label: 'Снизу вверх',   Icon: ArrowUp },
  { value: 'LR', label: 'Слева направо', Icon: ArrowRight },
  { value: 'RL', label: 'Справа налево', Icon: ArrowLeft },
];

const THEMES = [
  { value: 'light', label: 'Светлая', Icon: Sun },
  { value: 'dark',  label: 'Тёмная',  Icon: Moon },
];

export const SideMenu = ({
  isOpen,
  onClose,
  onAutoLayout,
  direction,
  onDirectionChange,
  theme,
  onThemeChange,
  treeId,
  onAfterImport,
  egoState,         // { active, centerId, depth }
  onEgoStateChange, // (newState) => void
  allPersons,       // массив всех людей для выпадающего списка
}) => {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const handleExport = async () => {
    if (!treeId) return;
    setExporting(true);
    try {
      const res = await apiFetch(`/api/trees/${treeId}/export-gedcom`);
      if (!res.ok) throw new Error(`Ошибка экспорта (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      const cd = res.headers.get('Content-Disposition') || '';
      const utf8Match = cd.match(/filename\*=UTF-8''([^;]+)/i);
      const asciiMatch = cd.match(/filename="([^"]+)"/);
      if (utf8Match) {
        a.download = decodeURIComponent(utf8Match[1]);
      } else if (asciiMatch) {
        a.download = asciiMatch[1];
      } else {
        a.download = 'tree.ged';
      }

      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || 'Не удалось экспортировать');
    } finally {
      setExporting(false);
    }
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!confirm(
      `Импортировать «${file.name}» в новое дерево?\n\n` +
      `Текущее дерево не изменится — создастся новое.`
    )) return;

    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await apiFetch('/api/trees/import-gedcom', {
        method: 'POST',
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Ошибка импорта (${res.status})`);
      }
      const newTree = await res.json();
      onAfterImport?.(newTree);
    } catch (err) {
      alert(err.message || 'Не удалось импортировать');
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-30 bg-black/30 backdrop-blur-[1px] transition-opacity duration-200 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Drawer */}
      <aside
        className={`fixed top-0 left-0 h-full w-80 bg-white dark:bg-slate-900 shadow-2xl z-40 flex flex-col transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-bold text-gray-800 dark:text-slate-100">Настройки дерева</h2>
            <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">Вид и поведение</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
           <Section title="Раскладка">
            <button
              onClick={() => {
                onAutoLayout();
                onClose(); // Закрываем меню после нажатия
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800"
            >
              <Sparkles className="w-4 h-4 text-purple-500" />
              <span className="flex-1 text-left">Автоматическая раскладка</span>
            </button>
            <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">
              Расположит карточки по выбранному направлению
            </p>
          </Section>

          <Section title="Тема">
            <div className="flex gap-2">
              {THEMES.map((t) => {
                const active = theme === t.value;
                return (
                  <button
                    key={t.value}
                    onClick={() => onThemeChange(t.value)}
                    className={`flex-1 flex flex-col items-center gap-1 px-2 py-3 rounded-lg border-2 transition-all ${
                      active
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                        : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <t.Icon className={`w-4 h-4 ${active ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-slate-400'}`} />
                    <span className={`text-[11px] font-medium ${active ? 'text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-slate-400'}`}>
                      {t.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </Section>

          <Section title="Фокус на персоне">
            <label className="flex items-center gap-2 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={egoState.active}
                onChange={(e) => onEgoStateChange({ ...egoState, active: e.target.checked })}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-slate-300">
                Включить эгоцентричный режим
              </span>
            </label>

            {egoState.active && (
              <div className="space-y-3 pl-6 border-l-2 border-blue-200 dark:border-blue-800">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1">
                    Центральная персона
                  </label>
                  <select
                    value={egoState.centerId || ''}
                    onChange={(e) => onEgoStateChange({ ...egoState, centerId: Number(e.target.value) })}
                    className="w-full text-xs px-2 py-1.5 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
                  >
                    <option value="">— Выберите —</option>
                    {allPersons.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.first_name} {p.last_name || ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1">
                    Кого подсветить?
                  </label>
                  <div className="space-y-1 text-xs text-gray-700 dark:text-slate-300">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={egoState.depth >= 1} onChange={() => onEgoStateChange({ ...egoState, depth: 1 })} />
                      1-й круг (Супруги, родители, дети)
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={egoState.depth >= 2} onChange={() => onEgoStateChange({ ...egoState, depth: 2 })} />
                      2-й круг (Бабушки/дедушки, внуки, братья/сёстры)
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={egoState.depth >= 3} onChange={() => onEgoStateChange({ ...egoState, depth: 3 })} />
                      3-й круг (Дяди/тёти, племянники, двоюродные)
                    </label>
                  </div>
                </div>
              </div>
            )}
          </Section>

          <Section title="Экспорт">
            <button
              onClick={handleExport}
              disabled={!treeId || exporting}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span className="flex-1 text-left">
                {exporting ? 'Скачивание...' : 'Скачать GEDCOM (.ged)'}
              </span>
            </button>
            <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">
              Совместим с MyHeritage, Gramps, Ancestry
            </p>
          </Section>

          <Section title="Импорт">
            <button
              onClick={handleImportClick}
              disabled={importing}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              <span className="flex-1 text-left">
                {importing ? 'Импорт...' : 'Загрузить GEDCOM (.ged)'}
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".ged,.txt"
              onChange={handleFileChange}
              className="hidden"
            />
            <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">
              Создастся новое дерево. Текущее останется без изменений.
            </p>
          </Section>

          <Section title="Стиль узлов" badge="Скоро">
            <div className="space-y-0.5">
              <OptionButton icon={Palette} label="Карточки" disabled />
              <OptionButton icon={Rows3} label="Компактный список" disabled />
            </div>
          </Section>

          <Section title="Отображение" badge="Скоро">
            <div className="space-y-0.5">
              <OptionButton icon={Eye} label="Показывать даты" disabled />
              <OptionButton icon={Eye} label="Показывать фото" disabled />
            </div>
          </Section>
        </div>

        <div className="px-4 py-3 border-t border-gray-100 dark:border-slate-800 text-[10px] text-gray-400 dark:text-slate-500 text-center">
          Настройки сохраняются локально
        </div>
      </aside>
    </>
  );
};