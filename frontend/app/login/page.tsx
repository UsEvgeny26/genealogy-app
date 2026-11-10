'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { TreePine, LogIn, UserPlus, AlertCircle, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { isLoggedIn, isLoading, login, register } = useAuth();

  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('demo@example.com');
  const [password, setPassword] = useState('demo123');
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isLoading && isLoggedIn) {
      router.replace('/trees');
    }
  }, [isLoading, isLoggedIn, router]);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email.trim(), password);
      } else {
        await register(email.trim(), password, displayName.trim() || undefined);
      }
      router.replace('/trees');
    } catch (err) {
      setError(err.message || 'Не удалось выполнить действие');
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = (next) => {
    setMode(next);
    setError(null);
    if (next === 'register') {
      setEmail('');
      setPassword('');
      setDisplayName('');
    } else {
      setEmail('demo@example.com');
      setPassword('demo123');
      setDisplayName('');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-900 transition-colors">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-200 dark:border-slate-700 p-8 space-y-6"
      >
        {/* Заголовок */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-950 flex items-center justify-center">
            <TreePine className="w-7 h-7 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">
            Генеалогическое дерево
          </h1>
          <p className="text-xs text-gray-500 dark:text-slate-400 text-center">
            {mode === 'login'
              ? 'Войдите, чтобы редактировать дерево'
              : 'Создайте аккаунт, чтобы начать'}
          </p>
        </div>

        {/* Переключатель */}
        <div className="flex rounded-lg bg-gray-100 dark:bg-slate-900 p-1 text-xs">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`flex-1 py-1.5 rounded-md font-medium transition-colors ${
              mode === 'login'
                ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-700 dark:text-blue-300'
                : 'text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'
            }`}
          >
            Вход
          </button>
          <button
            type="button"
            onClick={() => switchMode('register')}
            className={`flex-1 py-1.5 rounded-md font-medium transition-colors ${
              mode === 'register'
                ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-700 dark:text-blue-300'
                : 'text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'
            }`}
          >
            Регистрация
          </button>
        </div>

        {/* Поля */}
        <div className="space-y-3">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1">
                Имя (необязательно)
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoComplete="name"
                placeholder="Как вас зовут"
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-100 border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              className="w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-100 border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1">
              Пароль
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-100 border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
            />
            {mode === 'register' && (
              <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">
                Минимум 6 символов
              </p>
            )}
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 p-2 text-xs text-red-800 dark:text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Кнопки */}
        <div className="space-y-2">
          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : mode === 'login' ? (
              <LogIn className="w-4 h-4" />
            ) : (
              <UserPlus className="w-4 h-4" />
            )}
            {submitting
              ? 'Подождите...'
              : mode === 'login'
                ? 'Войти'
                : 'Зарегистрироваться'}
          </button>

          <button
            type="button"
            onClick={() => router.push('/tree')}
            className="w-full px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Продолжить как гость
          </button>
        </div>

        {mode === 'login' && (
          <p className="text-[10px] text-gray-400 dark:text-slate-500 text-center">
            Демо:{' '}
            <code className="bg-gray-100 dark:bg-slate-700 px-1 rounded">demo@example.com</code> /{' '}
            <code className="bg-gray-100 dark:bg-slate-700 px-1 rounded">demo123</code>
          </p>
        )}
      </form>
    </div>
  );
}