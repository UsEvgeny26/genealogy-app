'use client';

import React, {
  createContext, useContext, useState, useRef, useCallback, useEffect,
} from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Info, X, AlertCircle } from 'lucide-react';

const DialogContext = createContext(null);

export const useDialog = () => {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used inside <DialogProvider>');
  return ctx;
};

const VARIANT_STYLES = {
  default: {
    icon: Info,
    iconBg: 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400',
    btn: 'bg-blue-600 hover:bg-blue-700 text-white',
  },
  warning: {
    icon: AlertTriangle,
    iconBg: 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400',
    btn: 'bg-amber-600 hover:bg-amber-700 text-white',
  },
  danger: {
    icon: AlertCircle,
    iconBg: 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400',
    btn: 'bg-red-600 hover:bg-red-700 text-white',
  },
};

export const DialogProvider = ({ children }) => {
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState(null);
  const resolverRef = useRef(null);

  useEffect(() => setMounted(true), []);

  const open = useCallback((config) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setState({
        type: 'confirm',
        title: 'Подтверждение',
        description: '',
        confirmLabel: 'OK',
        cancelLabel: 'Отмена',
        variant: 'default',
        ...config,
      });
    });
  }, []);

  const close = useCallback((result) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setState(null);
    resolve?.(result);
  }, []);

  const api = {
    confirm: (config) => open({ type: 'confirm', ...config }),
    alert: (config) => open({ type: 'alert', cancelLabel: null, ...config }),
    prompt: (config) => open({ type: 'prompt', ...config }),
    choose: (config) => open({ type: 'choose', ...config }),
  };

  return (
    <DialogContext.Provider value={api}>
      {children}
      {mounted && state && createPortal(
        <DialogView config={state} onClose={close} />,
        document.body
      )}
    </DialogContext.Provider>
  );
};

function DialogView({ config, onClose }) {
  const [value, setValue] = useState(config.defaultValue || '');
  const variant = VARIANT_STYLES[config.variant] || VARIANT_STYLES.default;
  const Icon = variant.icon;

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        onClose(config.type === 'prompt' ? null : false);
      } else if (e.key === 'Enter' && config.type !== 'alert') {
        onClose(config.type === 'prompt' ? value : true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [value, config.type, onClose]);

  const handleSubmit = () => {
    if (config.type === 'prompt') onClose(value);
    else if (config.type === 'choose') return;
    else onClose(true);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transition-colors">
        <div className="flex items-start gap-3 p-6">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${variant.iconBg}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-slate-100">{config.title}</h3>
            {config.description && (
              <p className="text-sm text-gray-600 dark:text-slate-400 mt-1 whitespace-pre-line">{config.description}</p>
            )}
            {config.type === 'prompt' && (
              <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={config.placeholder}
                autoFocus
                className="mt-3 w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-100 border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            )}
          </div>
          <button
            onClick={() => onClose(config.type === 'prompt' ? null : false)}
            className="p-1 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex justify-end gap-2 px-6 py-3 bg-gray-50/50 dark:bg-slate-800/50 border-t border-gray-100 dark:border-slate-700 flex-wrap">
          {config.type === 'choose' ? (
            <>
              {(config.actions || []).map((a) => {
                const v = VARIANT_STYLES[a.variant] || VARIANT_STYLES.default;
                return (
                  <button
                    key={a.value}
                    onClick={() => onClose(a.value)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${v.btn}`}
                  >
                    {a.label}
                  </button>
                );
              })}
              <button
                onClick={() => onClose(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                {config.cancelLabel || 'Отмена'}
              </button>
            </>
          ) : (
            <>
              {config.type !== 'alert' && (
                <button
                  onClick={() => onClose(config.type === 'prompt' ? null : false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  {config.cancelLabel || 'Отмена'}
                </button>
              )}
              <button
                onClick={handleSubmit}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${variant.btn}`}
              >
                {config.confirmLabel || 'OK'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}