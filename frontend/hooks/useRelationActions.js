'use client';

import { useCallback } from 'react';
import { apiFetch } from '@/lib/api';

/**
 * Централизованные действия над связями.
 * Все функции возвращают true при успехе и кидают Error при неудаче —
 * вызывающий код сам решает, как показать ошибку.
 */
export function useRelationActions() {
  const createParentChild = useCallback(async (parentId, childId, kind = 'biological') => {
    const res = await apiFetch('/api/parent-child', {
      method: 'POST',
      body: JSON.stringify({ parent_id: parentId, child_id: childId, kind }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Ошибка создания связи (${res.status})`);
    }
    return res.json();
  }, []);

  const deleteParentChild = useCallback(async (parentId, childId) => {
    const res = await apiFetch(`/api/parent-child/${parentId}/${childId}`, {
      method: 'DELETE',
    });
    if (!res.ok && res.status !== 204) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Ошибка удаления (${res.status})`);
    }
  }, []);

  const createMarriage = useCallback(async (spouse1_id, spouse2_id, extra = {}) => {
    const res = await apiFetch('/api/marriages', {
      method: 'POST',
      body: JSON.stringify({ spouse1_id, spouse2_id, ...extra }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Ошибка создания брака (${res.status})`);
    }
    return res.json();
  }, []);

  const updateMarriage = useCallback(async (id, patch) => {
    const res = await apiFetch(`/api/marriages/${id}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Ошибка обновления (${res.status})`);
    }
    return res.json();
  }, []);

  const deleteMarriage = useCallback(async (id) => {
    const res = await apiFetch(`/api/marriages/${id}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Ошибка удаления брака (${res.status})`);
    }
  }, []);

  const createRelation = useCallback(async (type, fromId, toId) => {
    const res = await apiFetch('/api/relations', {
      method: 'POST',
      body: JSON.stringify({ type, from_id: fromId, to_id: toId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Ошибка создания связи (${res.status})`);
    }
    return res.json();
  }, []);

  const deleteRelation = useCallback(async (id) => {
    const res = await apiFetch(`/api/relations/${id}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Ошибка удаления связи (${res.status})`);
    }
  }, []);

  return {
    createParentChild,
    deleteParentChild,
    createMarriage,
    updateMarriage,
    deleteMarriage,
    createRelation,
    deleteRelation,
  };
}