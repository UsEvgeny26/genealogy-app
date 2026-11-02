'use client';

import { useCallback } from 'react';
import { apiFetch } from '@/lib/api';

export function useRelationActions() {
  /* ---------- Individual ---------- */

  const createIndividual = useCallback(async (treeId, data) => {
    const res = await apiFetch(`/api/trees/${treeId}/individuals`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Ошибка создания персоны (${res.status})`);
    }
    return res.json();
  }, []);

  const updateIndividual = useCallback(async (id, patch) => {
    const res = await apiFetch(`/api/individuals/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Ошибка обновления (${res.status})`);
    }
    return res.json();
  }, []);

  const deleteIndividual = useCallback(async (id) => {
    const res = await apiFetch(`/api/individuals/${id}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Ошибка удаления (${res.status})`);
    }
  }, []);

  /* ---------- Family ---------- */

  const createFamily = useCallback(async (treeId, data) => {
    const res = await apiFetch(`/api/trees/${treeId}/families`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Ошибка создания семьи (${res.status})`);
    }
    return res.json();
  }, []);

  const updateFamily = useCallback(async (id, patch) => {
    const res = await apiFetch(`/api/families/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Ошибка обновления (${res.status})`);
    }
    return res.json();
  }, []);

  const deleteFamily = useCallback(async (id) => {
    const res = await apiFetch(`/api/families/${id}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Ошибка удаления (${res.status})`);
    }
  }, []);

  /* ---------- FamilyChild ---------- */

  const addChildToFamily = useCallback(async ({ family_id, child_id, relationship_type }) => {
    const res = await apiFetch('/api/family-children', {
      method: 'POST',
      body: JSON.stringify({ family_id, child_id, relationship_type }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Ошибка добавления ребёнка (${res.status})`);
    }
    return res.json();
  }, []);

  const removeChildFromFamily = useCallback(async (familyId, childId) => {
    const res = await apiFetch(`/api/family-children/${familyId}/${childId}`, {
      method: 'DELETE',
    });
    if (!res.ok && res.status !== 204) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Ошибка удаления связи (${res.status})`);
    }
  }, []);

  /* ---------- Association ---------- */

  const createAssociation = useCallback(async (treeId, data) => {
    const res = await apiFetch(`/api/trees/${treeId}/associations`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Ошибка создания связи (${res.status})`);
    }
    return res.json();
  }, []);

  const deleteAssociation = useCallback(async (id) => {
    const res = await apiFetch(`/api/associations/${id}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Ошибка удаления связи (${res.status})`);
    }
  }, []);

  /* ---------- Высокоуровневые ---------- */

  /**
   * Создать связь родитель→ребёнок.
   * 1. Ищем семью родителя, где ребёнок ещё не числится.
   * 2. Если нет — создаём новую семью с одним супругом.
   * 3. Добавляем ребёнка.
   */
  const connectParentChild = useCallback(
    async ({
      treeId,
      parentId,
      childId,
      relationshipType = 'biological',
      families = [],
      childEdges = [],
    }) => {
      const parentFamilies = families.filter(
        (f) => f.spouse1_id === parentId || f.spouse2_id === parentId
      );

      let targetFamily = null;
      for (const fam of parentFamilies) {
        const hasChild = childEdges.some(
          (ce) => ce.family_id === fam.id && ce.child_id === childId
        );
        if (!hasChild) {
          targetFamily = fam;
          break;
        }
      }

      if (!targetFamily) {
        targetFamily = await createFamily(treeId, {
          spouse1_id: parentId,
          status: 'unknown',
        });
      }

      return addChildToFamily({
        family_id: targetFamily.id,
        child_id: childId,
        relationship_type: relationshipType,
      });
    },
    [createFamily, addChildToFamily]
  );

  /**
   * Создать связь супругов.
   * Если у кого-то уже есть семья с одним супругом — добавляем второго в неё,
   * иначе создаём новую семью.
   */
  const connectSpouses = useCallback(
    async ({ treeId, aId, bId, families = [] }) => {
      const aSingleFamilies = families.filter(
        (f) =>
          (f.spouse1_id === aId && !f.spouse2_id) ||
          (f.spouse2_id === aId && !f.spouse1_id)
      );
      const bSingleFamilies = families.filter(
        (f) =>
          (f.spouse1_id === bId && !f.spouse2_id) ||
          (f.spouse2_id === bId && !f.spouse1_id)
      );

      const pickSingle = aSingleFamilies[0] || bSingleFamilies[0];
      if (pickSingle) {
        return updateFamily(pickSingle.id, {
          spouse1_id: pickSingle.spouse1_id || bId,
          spouse2_id: pickSingle.spouse2_id || bId,
          status: 'married',
        });
      }

      return createFamily(treeId, {
        spouse1_id: aId,
        spouse2_id: bId,
        status: 'married',
      });
    },
    [createFamily, updateFamily]
  );

  return {
    createIndividual,
    updateIndividual,
    deleteIndividual,
    createFamily,
    updateFamily,
    deleteFamily,
    addChildToFamily,
    removeChildFromFamily,
    createAssociation,
    deleteAssociation,
    connectParentChild,
    connectSpouses,
  };
}