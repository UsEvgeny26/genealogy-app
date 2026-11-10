'use client';

import { useState, useEffect } from 'react';

export function useGraphTreeId() {
  const [treeId, setTreeId] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('tree_id');
    if (!raw) {
      setTreeId(null);
      return;
    }
    const n = Number(raw);
    setTreeId(Number.isFinite(n) && n > 0 ? n : null);
  }, []);

  return treeId;
}