'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { TreePine, LogIn } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { isLoggedIn, isLoading, login } = useAuth();

  useEffect(() => {
    if (!isLoading && isLoggedIn) {
      router.replace('/tree');
    }
  }, [isLoading, isLoggedIn, router]);

  const handleLogin = () => {
    login();
    router.replace('/tree');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-gray-200 p-8 space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center">
            <TreePine className="w-7 h-7 text-blue-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Генеалогическое дерево</h1>
          <p className="text-xs text-gray-500 text-center">
            Войдите, чтобы редактировать дерево.
            <br />
            <span className="text-[10px] text-gray-400">(демо-режим)</span>
          </p>
        </div>

        <div className="space-y-2">
          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
          >
            <LogIn className="w-4 h-4" />
            Войти (демо)
          </button>

          <button
            onClick={() => router.push('/tree')}
            className="w-full px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Продолжить как гость
          </button>
        </div>
      </div>
    </div>
  );
}