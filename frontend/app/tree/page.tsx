'use client';

import { useRouter } from 'next/navigation';
import { GenealogyTree } from '@/components/GenealogyTree';
import { useAuth } from '@/hooks/useAuth';
import { Lock, Unlock, LogOut, LogIn } from 'lucide-react';

export default function TreePage() {
  const router = useRouter();
  const { isLoggedIn, isLoading, user, logout } = useAuth();

  const handleAuthToggle = async () => {
    if (isLoggedIn) {
      await logout();
      router.replace('/login');
    } else {
      router.push('/login');
    }
  };

  return (
    <main className="w-screen h-screen relative">
      <header className="absolute top-4 right-4 z-20">
        <div className="bg-white/90 backdrop-blur-sm p-1.5 rounded-xl shadow-md border border-gray-200 flex items-center gap-3 px-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
            {isLoggedIn ? (
              <Unlock className="w-4 h-4 text-emerald-600" />
            ) : (
              <Lock className="w-4 h-4 text-amber-600" />
            )}
            <span>
              {isLoading ? (
                'Проверка...'
              ) : isLoggedIn ? (
                <>
                  <strong className="text-emerald-700">{user?.display_name || user?.email}</strong>
                </>
              ) : (
                <strong className="text-amber-700">Гость</strong>
              )}
            </span>
          </div>

          <button
            onClick={handleAuthToggle}
            disabled={isLoading}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shadow-sm disabled:opacity-50 ${
              isLoggedIn
                ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isLoggedIn ? <LogOut className="w-3.5 h-3.5" /> : <LogIn className="w-3.5 h-3.5" />}
            {isLoggedIn ? 'Выйти' : 'Войти'}
          </button>
        </div>
      </header>

      <GenealogyTree />
    </main>
  );
}