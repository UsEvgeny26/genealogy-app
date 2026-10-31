'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export default function RootPage() {
  const router = useRouter();
  const { isLoggedIn, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    router.replace(isLoggedIn ? '/tree' : '/login');
  }, [isLoading, isLoggedIn, router]);

  return (
    <div className="w-screen h-screen flex items-center justify-center text-gray-500">
      Загрузка...
    </div>
  );
}