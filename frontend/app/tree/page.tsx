'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { GenealogyTree } from '@/components/GenealogyTree';
import { useAuth } from '@/hooks/useAuth';
import { Lock, Unlock, LogOut, LogIn } from 'lucide-react';

function TreePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const treeIdStr = searchParams.get('tree_id');
  const treeId = treeIdStr ? Number(treeIdStr) : null;
  
  const { isLoggedIn, isLoading, user, logout } = useAuth() as any;

  // Если авторизован, но не передан tree_id — редирект на дашборд
  useEffect(() => {
    if (!isLoading && isLoggedIn && !treeId) {
      router.replace('/trees');
    }
  }, [isLoading, isLoggedIn, treeId, router]);

  const handleAuthToggle = async () => {
    if (isLoggedIn) {
      await logout();
      router.replace('/login');
    } else {
      router.push('/login');
    }
  };

  if (isLoading || (isLoggedIn && !treeId)) {
    return <div className="w-screen h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900" />;
  }

  return (
    <main className="w-screen h-screen relative">
      <header className="absolute top-4 right-4 z-20">
        <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm p-1.5 rounded-xl shadow-md border border-gray-200 dark:border-slate-700 flex items-center gap-3 px-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-slate-300">
            {isLoggedIn ? (
              <Unlock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            )}
            <span>
              {isLoading ? (
                'Проверка...'
              ) : isLoggedIn ? (
                <strong className="text-emerald-700 dark:text-emerald-400">
                  {user?.display_name || user?.email}
                </strong>
              ) : (
                <strong className="text-amber-700 dark:text-amber-400">Гость</strong>
              )}
            </span>
          </div>

          <button
            onClick={handleAuthToggle}
            disabled={isLoading}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shadow-sm disabled:opacity-50 ${
              isLoggedIn
                ? 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900 border border-red-200 dark:border-red-800'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isLoggedIn ? <LogOut className="w-3.5 h-3.5" /> : <LogIn className="w-3.5 h-3.5" />}
            {isLoggedIn ? 'Выйти' : 'Войти'}
          </button>
        </div>
      </header>

      {/* Передаем ID напрямую и коллбэк для возврата */}
      <GenealogyTree treeId={treeId} onBack={() => router.push('/')} />
    </main>
  );
}

export default function TreePage() {
  return (
    <Suspense fallback={<div className="w-screen h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900" />}>
      <TreePageContent />
    </Suspense>
  );
}