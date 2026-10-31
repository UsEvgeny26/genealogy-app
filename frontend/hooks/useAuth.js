'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch, setAuthToken, clearAuthToken, getAuthToken } from '@/lib/api';

/**
 * Хук авторизации.
 * Сейчас работает с фейковым токеном из localStorage.
 * Когда добавятся сессии — поменяется только реализация login/logout,
 * все компоненты, использующие useAuth, останутся без изменений.
 */
export function useAuth() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = getAuthToken();
      if (!token) {
        setIsLoggedIn(false);
        return;
      }
      const res = await apiFetch('/api/auth/me');
      setIsLoggedIn(res.ok);
    } catch {
      setIsLoggedIn(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = useCallback(() => {
    // TODO (этап 5): заменить на реальный login с email/password
    setAuthToken('dev-token');
    setIsLoggedIn(true);
  }, []);

  const logout = useCallback(() => {
    // TODO (этап 5): DELETE /api/auth/session
    clearAuthToken();
    setIsLoggedIn(false);
  }, []);

  return { isLoggedIn, isLoading, login, logout, refresh: checkAuth };
}