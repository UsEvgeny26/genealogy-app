'use client';

import React, { useRef, useState } from 'react';
import { Upload, X, Loader2, User } from 'lucide-react';
import { apiFetch } from '@/lib/api';

export function PhotoUpload({ value, onChange, disabled, treeId }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const handleSelect = () => inputRef.current?.click();

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (treeId) fd.append('tree_id', treeId); 
      
      const res = await apiFetch('/api/upload', { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Ошибка загрузки (${res.status})`);
      }
      const data = await res.json();
      onChange(data.url);
    } catch (err) {
      setError(err.message || 'Не удалось загрузить фото');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400">Фото</label>

      <div className="flex items-center gap-3">
        <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 flex items-center justify-center shrink-0">
          {value ? (
            <img src={value} alt="" className="w-full h-full object-cover" />
          ) : (
            <User className="w-6 h-6 text-gray-400 dark:text-slate-500" />
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={handleSelect}
            disabled={disabled || uploading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-lg disabled:opacity-50"
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {uploading ? 'Загрузка...' : value ? 'Заменить' : 'Загрузить'}
          </button>
          {value && !uploading && (
            <button
              type="button"
              onClick={() => onChange('')}
              disabled={disabled}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-gray-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50"
            >
              <X className="w-3 h-3" /> Удалить
            </button>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFile}
        className="hidden"
      />

      {error && (
        <p className="text-[11px] text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}