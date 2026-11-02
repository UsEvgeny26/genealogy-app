'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { TreePine, LogIn, AlertCircle, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { isLoggedIn, isLoading, login } = useAuth();

  const [email, setEmail] = useState('demo@example.com');
  const [password, setPassword] = useState('demo123');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isLoading && isLoggedIn) {
      router.replace('/tree');
    }
  }, [isLoading, isLoggedIn, router]);

  const handleLogin = async (e) => {
    e?.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      router.replace('/tree');
    } catch (err) {
      setError(err.message || 'Не удалось войти');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-gray-200 p-8 space-y-6"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center">
            <TreePine className="w-7 h-7 text-blue-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Генеалогическое дерево</h1>
          <p className="text-xs text-gray-500 text-center">
            Войдите, чтобы редактировать дерево
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Пароль
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-800">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-2">
          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            {submitting ? 'Вход...' : 'Войти'}
          </button>

          <button
            type="button"
            onClick={() => router.push('/tree')}
            className="w-full px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Продолжить как гость
          </button>
        </div>

        <p className="text-[10px] text-gray-400 text-center">
          Демо-аккаунт: <code className="bg-gray-100 px-1 rounded">demo@example.com</code> / <code className="bg-gray-100 px-1 rounded">secret123</code>
        </p>
      </form>
    </div>
  );
}