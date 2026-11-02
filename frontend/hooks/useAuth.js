'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch, setAuthToken, clearAuthToken, getAuthToken } from '@/lib/api';

export function useAuth() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);

  const checkAuth = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = getAuthToken();
      if (!token) {
        setIsLoggedIn(false);
        setUser(null);
        return;
      }
      const res = await apiFetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        setIsLoggedIn(true);
      } else {
        setIsLoggedIn(false);
        setUser(null);
      }
    } catch {
      setIsLoggedIn(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = useCallback(async (email, password) => {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Неверный email или пароль');
    }
    const data = await res.json();
    // token = email (текущая заглушка бэка)
    setAuthToken(data.token);
    setUser(data.user);
    setIsLoggedIn(true);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      /* игнорируем */
    }
    clearAuthToken();
    setIsLoggedIn(false);
    setUser(null);
  }, []);

  return { isLoggedIn, isLoading, user, login, logout, refresh: checkAuth };
}