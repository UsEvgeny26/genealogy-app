'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useDialog } from '@/components/DialogProvider';
import { apiFetch } from '@/lib/api';
import { GenealogyTree } from '@/components/GenealogyTree';
import {
  TreePine, Plus, Upload, LogIn, Sun, Moon, ArrowRight,
  Users, Heart, LogOut, Loader2, Sparkles
} from 'lucide-react';

export default function LandingPage() {
  const router = useRouter();
  const { isLoggedIn, isLoading: authLoading, user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const dialog = useDialog();
  
  const [trees, setTrees] = useState<any[]>([]);
  const [loadingTrees, setLoadingTrees] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isLoggedIn) {
      setLoadingTrees(true);
      apiFetch('/api/trees')
        .then(res => res.json())
        .then(data => setTrees(data))
        .catch(console.error)
        .finally(() => setLoadingTrees(false));
    }
  }, [isLoggedIn]);

  const handleCreateTree = async () => {
    if (!isLoggedIn) {
      router.push('/login');
      return;
    }
    
    const name = await dialog.prompt({
      title: 'Новое дерево',
      description: 'Введите название для вашего генеалогического древа.',
      placeholder: 'Моя семья',
      confirmLabel: 'Создать',
    });
    
    if (!name) return;

    try {
      const res = await apiFetch('/api/trees', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error('Ошибка создания дерева');
      const newTree = await res.json();
      router.push(`/tree?tree_id=${newTree.id}`);
    } catch (err: any) {
      await dialog.alert({
        title: 'Ошибка',
        description: err.message,
        variant: 'danger',
        confirmLabel: 'Понятно',
      });
    }
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      
      // Если авторизован — импорт в личное дерево, если гость — во временное
      const url = isLoggedIn ? '/api/trees/import-gedcom' : '/api/guest/import-gedcom';
      const res = await apiFetch(url, { method: 'POST', body: fd });
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Ошибка импорта');
      }
      
      const newTree = await res.json();
      router.push(`/tree?tree_id=${newTree.id}`);
    } catch (err: any) {
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

  const handleLogout = async () => {
    await logout();
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-gray-900 dark:text-slate-100 transition-colors font-sans">
      
      {/* 1. Шапка */}
      <header className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <TreePine className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          <span className="font-bold text-lg tracking-tight">Genealogy Tree</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title="Сменить тему"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          
          <button
            onClick={handleImportClick}
            disabled={importing}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
          >
            {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Загрузить GEDCOM
          </button>
          
          {isLoggedIn ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500 dark:text-slate-400 hidden sm:inline">
                {user?.display_name || user?.email}
              </span>
              <button onClick={handleLogout} className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => router.push('/login')}
              className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
            >
              Войти
            </button>
          )}
        </div>
      </header>

      {/* 2. Hero-секция */}
      <section className="max-w-4xl mx-auto text-center py-16 px-4">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-semibold mb-6">
          <Sparkles className="w-3.5 h-3.5" /> Исследуйте историю семьи
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
          Стройте генеалогическое древо <span className="text-blue-600 dark:text-blue-400">легко с нами</span>
        </h1>
        <p className="mt-4 text-lg text-gray-600 dark:text-slate-400 max-w-2xl mx-auto mb-8">
          Импортируйте GEDCOM, визуализируйте связи и сохраняйте память о предках. Без сложных настроек.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <button
            onClick={handleCreateTree}
            className="flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-200 dark:shadow-none transition-all hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4" />
            {isLoggedIn ? 'Создать новое дерево' : 'Начать бесплатно'}
          </button>
          <button
            onClick={handleImportClick}
            className="flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-gray-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-xl transition-all"
          >
            <Upload className="w-4 h-4" />
            Открыть .ged файл
          </button>
        </div>
      </section>

      {/* 3. Интерактивный пример */}
      <section className="max-w-5xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold">Наглядно и просто</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-2">
            Попробуйте подвигать холст или нажмите на карточку, чтобы посмотреть детали
          </p>
        </div>
        
        {/* Контейнер с фиксированной высотой для холста */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-gray-200 dark:border-slate-700 overflow-hidden h-[500px] relative">
          {/* 
            Передаем treeId={null}, чтобы загрузилось демо-дерево. 
            onBack не передаем, чтобы скрыть кнопку "Назад".
          */}
          <GenealogyTree treeId={null} isEmbedded={true}/>
        </div>
      </section>

      {/* 4. Деревья / Призыв к действию */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold mb-6">
          {isLoggedIn ? 'Ваши деревья' : 'Начните прямо сейчас'}
        </h2>
        
        {isLoggedIn ? (
          loadingTrees ? (
            <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
          ) : trees.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {trees.map(tree => (
                <div key={tree.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-5 shadow-sm hover:shadow-md transition-shadow group flex flex-col">
                  <h3 className="text-lg font-bold truncate">{tree.name}</h3>
                  <p className="text-xs text-gray-400 mt-1">Обновлено {new Date(tree.updated_at).toLocaleDateString('ru-RU')}</p>
                  <div className="flex items-center gap-3 mt-4 text-sm text-gray-600 dark:text-slate-400">
                    <span className="flex items-center gap-1 bg-gray-50 dark:bg-slate-900/50 px-2 py-1 rounded-md"><Users className="w-4 h-4 text-blue-500" />{tree.stats?.individuals_count || 0}</span>
                    <span className="flex items-center gap-1 bg-gray-50 dark:bg-slate-900/50 px-2 py-1 rounded-md"><Heart className="w-4 h-4 text-rose-500" />{tree.stats?.families_count || 0}</span>
                  </div>
                  <button
                    onClick={() => router.push(`/tree?tree_id=${tree.id}`)}
                    className="mt-5 w-full flex items-center justify-center gap-1 px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition-colors"
                  >
                    Открыть <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-gray-300 dark:border-slate-600">
              <TreePine className="w-12 h-12 mx-auto text-gray-300 dark:text-slate-600 mb-4" />
              <p className="text-gray-500 dark:text-slate-400 mb-4">У вас пока нет деревьев</p>
              <button onClick={() => router.push('/trees')} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg shadow-sm">
                Создать первое дерево
              </button>
            </div>
          )
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-gray-200 dark:border-slate-700 text-center hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
              <LogIn className="w-10 h-10 mx-auto text-blue-500 mb-4" />
              <h3 className="font-bold text-lg mb-2">Личный кабинет</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">Войдите, чтобы сохранять деревья и редактировать их.</p>
              <button onClick={() => router.push('/login')} className="w-full py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors">
                Войти или зарегистрироваться
              </button>
            </div>
            <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-gray-200 dark:border-slate-700 text-center hover:border-green-300 dark:hover:border-green-700 transition-colors">
              <Upload className="w-10 h-10 mx-auto text-green-500 mb-4" />
              <h3 className="font-bold text-lg mb-2">Быстрый просмотр</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">Загрузите .ged файл для просмотра. (Временно, без сохранения)</p>
              <button onClick={handleImportClick} className="w-full py-2.5 text-sm font-medium text-gray-700 dark:text-slate-200 bg-gray-100 dark:bg-slate-700 rounded-xl hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors">
                Загрузить GEDCOM
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Скрытый инпут */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".ged,.txt"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}