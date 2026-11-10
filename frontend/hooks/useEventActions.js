'use client';

import { useCallback } from 'react';
import { apiFetch } from '@/lib/api';

export function useEventActions() {
  const createIndividualEvent = useCallback(async (individualId, data) => {
    const res = await apiFetch(`/api/individuals/${individualId}/events`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Ошибка создания события (${res.status})`);
    }
    return res.json();
  }, []);

  const createFamilyEvent = useCallback(async (familyId, data) => {
    const res = await apiFetch(`/api/families/${familyId}/events`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Ошибка создания события (${res.status})`);
    }
    return res.json();
  }, []);

  const updateEvent = useCallback(async (eventId, patch) => {
    const res = await apiFetch(`/api/events/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Ошибка обновления (${res.status})`);
    }
    return res.json();
  }, []);

  const deleteEvent = useCallback(async (eventId) => {
    const res = await apiFetch(`/api/events/${eventId}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Ошибка удаления (${res.status})`);
    }
  }, []);

  return {
    createIndividualEvent,
    createFamilyEvent,
    updateEvent,
    deleteEvent,
  };
}