'use client';

import React, { useEffect } from 'react';
import {
  X, ArrowDown, ArrowUp, ArrowRight, ArrowLeft, Check,
  Sun, Moon, Palette, Eye, Rows3,
} from 'lucide-react';

/* ---------- примитивы для секций ---------- */

function Section({ title, children, badge }) {
  return (
    <div className="px-4 py-3 border-b border-gray-100 last:border-b-0">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
          {title}
        </span>
        {badge && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
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
          ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
          : disabled
            ? 'text-gray-300 cursor-not-allowed'
            : 'text-gray-700 hover:bg-gray-50'
      }`}
    >
      {Icon && <Icon className="w-4 h-4 shrink-0" />}
      <span className="flex-1 text-left">{label}</span>
      {active && <Check className="w-3.5 h-3.5" />}
    </button>
  );
}

/* ---------- направления ---------- */

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

/* ---------- основной компонент ---------- */

export const SideMenu = ({
  isOpen,
  onClose,
  direction,
  onDirectionChange,
  theme,
  onThemeChange,
}) => {
  // Escape закрывает
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

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
        className={`fixed top-0 left-0 h-full w-80 bg-white shadow-2xl z-40 flex flex-col transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Шапка */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-bold text-gray-800">Настройки дерева</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">Вид и поведение</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Секции */}
        <div className="flex-1 overflow-y-auto">
          <Section title="Направление">
            <div className="space-y-0.5">
              {DIRECTIONS.map((d) => (
                <OptionButton
                  key={d.value}
                  active={direction === d.value}
                  icon={d.Icon}
                  label={d.label}
                  onClick={() => onDirectionChange(d.value)}
                />
              ))}
            </div>
          </Section>

          <Section title="Тема" badge="UI">
            <div className="flex gap-2">
              {THEMES.map((t) => {
                const active = theme === t.value;
                return (
                  <button
                    key={t.value}
                    onClick={() => onThemeChange(t.value)}
                    className={`flex-1 flex flex-col items-center gap-1 px-2 py-3 rounded-lg border-2 transition-all ${
                      active
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <t.Icon className={`w-4 h-4 ${active ? 'text-blue-600' : 'text-gray-500'}`} />
                    <span className={`text-[11px] font-medium ${active ? 'text-blue-700' : 'text-gray-600'}`}>
                      {t.label}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-gray-400 mt-2">
              Применится к карточкам и холсту в следующей итерации
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

        {/* Подвал */}
        <div className="px-4 py-3 border-t border-gray-100 text-[10px] text-gray-400 text-center">
          Настройки сохраняются локально
        </div>
      </aside>
    </>
  );
};