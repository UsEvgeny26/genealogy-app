'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useDialog } from '@/components/DialogProvider';
import { apiFetch } from '@/lib/api';
import {
  TreePine, Plus, Upload, LogOut, Users, Heart,
  Calendar, Trash2, ArrowRight, Loader2
} from 'lucide-react';

export default function TreesPage() {
  const router = useRouter();
  const { isLoggedIn, isLoading: authLoading, user, logout } = useAuth();
  const dialog = useDialog();
  
  const [trees, setTrees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  // Защита от неавторизованных
  useEffect(() => {
    if (!authLoading && !isLoggedIn) {
      router.replace('/login');
    }
  }, [authLoading, isLoggedIn, router]);

  const fetchTrees = async () => {
    try {
      const res = await apiFetch('/api/trees');
      if (res.ok) {
        const data = await res.json();
        setTrees(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn) fetchTrees();
  }, [isLoggedIn]);

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  // Создание нового дерева
  const handleCreateTree = async () => {
    const name = await dialog.prompt({
      title: 'Новое дерево',
      description: 'Введите название для вашего генеалогического древа.',
      placeholder: 'Моя семья',
      confirmLabel: 'Создать',
    });
    if (!name) return;

    setCreating(true);
    try {
      const res = await apiFetch('/api/trees', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error('Ошибка создания дерева');
      const newTree = await res.json();
      router.push(`/tree?tree_id=${newTree.id}`);
    } catch (err) {
      await dialog.alert({
        title: 'Ошибка',
        description: err.message,
        variant: 'danger',
        confirmLabel: 'Понятно',
      });
    } finally {
      setCreating(false);
    }
  };

  // Импорт GEDCOM
  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

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
        throw new Error(err.detail || 'Ошибка импорта');
      }
      
      const newTree = await res.json();
      router.push(`/tree?tree_id=${newTree.id}`);
    } catch (err) {
      await dialog.alert({
        title: 'Ошибка импорта',
        description: err.message,
        variant: 'danger',
        confirmLabel: 'Понятно',
      });
    } finally {
      setImporting(false);
    }
  };

  // Удаление дерева
  const handleDelete = async (treeId, treeName) => {
    const ok = await dialog.confirm({
      title: `Удалить дерево «${treeName}»?`,
      description: 'Все персоны, связи и события будут безвозвратно удалены.',
      variant: 'danger',
      confirmLabel: 'Удалить',
    });
    if (!ok) return;

    try {
      const res = await apiFetch(`/api/trees/${treeId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Не удалось удалить');
      await fetchTrees();
    } catch (err) {
      await dialog.alert({
        title: 'Ошибка',
        description: err.message,
        variant: 'danger',
        confirmLabel: 'Понятно',
      });
    }
  };

  if (authLoading || !isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 text-gray-500 dark:text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
      {/* Шапка */}
      <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <TreePine className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <span className="font-bold text-lg text-gray-900 dark:text-slate-100">
              Мои деревья
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-500 dark:text-slate-400 hidden sm:inline">
              {user?.display_name || user?.email}
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-lg transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Выйти
            </button>
          </div>
        </div>
      </header>

      {/* Контент */}
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        
        {/* Кнопки действий */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleCreateTree}
            disabled={creating}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-colors disabled:opacity-50"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Создать дерево
          </button>
          
          <button
            onClick={handleImportClick}
            disabled={importing}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-xl shadow-sm transition-colors disabled:opacity-50"
          >
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Импорт GEDCOM (.ged)
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".ged,.txt"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* Сетка деревьев */}
        {loading ? (
          <div className="flex justify-center py-20 text-gray-400 dark:text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : trees.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 border-dashed">
            <TreePine className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-800 dark:text-slate-200">У вас пока нет деревьев</h3>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              Создайте новое дерево с нуля или загрузите существующий GEDCOM-файл.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trees.map((tree) => (
              <div
                key={tree.id}
                className="group relative bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden hover:shadow-md transition-all flex flex-col"
              >
                <div className="p-5 flex-1">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 truncate pr-8">
                    {tree.name}
                  </h3>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Обновлено {new Date(tree.updated_at).toLocaleDateString('ru-RU')}
                  </p>

                  <div className="flex items-center gap-4 mt-6 text-sm text-gray-600 dark:text-slate-400">
                    <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-slate-900/50 px-2.5 py-1 rounded-md">
                      <Users className="w-4 h-4 text-blue-500" />
                      <span>{tree.stats?.individuals_count || 0} персон</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-slate-900/50 px-2.5 py-1 rounded-md">
                      <Heart className="w-4 h-4 text-rose-500" />
                      <span>{tree.stats?.families_count || 0} семей</span>
                    </div>
                  </div>
                </div>

                <div className="px-5 py-3 border-t border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50 flex justify-between items-center">
                  <button
                    onClick={() => router.push(`/tree?tree_id=${tree.id}`)}
                    className="flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                  >
                    Открыть <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(tree.id, tree.name)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                    title="Удалить дерево"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}