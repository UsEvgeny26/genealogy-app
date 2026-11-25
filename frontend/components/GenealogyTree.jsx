'use client';

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  ReactFlow, Controls, Background,
  useNodesState, useEdgesState,
  applyNodeChanges, ConnectionMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { PersonNode } from './PersonNode';
import { FamilyNode } from './FamilyNode';
import { RelationEdge } from './RelationEdge';
import { PersonModal } from './PersonModal';
import { PersonViewModal } from './PersonViewModal';
import { PersonExtendedViewModal } from './PersonExtendedViewModal';
import { ConnectionModal } from './ConnectionModal';
import { SideMenu } from './SideMenu';
import {
  getLayoutedElements,
  positionFamilyNodes,
  repositionFamilyNodesLive,
} from '@/lib/layout';
import { buildRawGraph, buildRenderEdges } from '@/lib/tree-adapter';
import { useDialog } from './DialogProvider';
import { useTheme } from '@/hooks/useTheme';
import { UserPlus, AlertCircle, Lock, Menu, ArrowLeft } from 'lucide-react';
import { apiFetch } from '@/lib/api';

// Функция: выбирает стороны (Top/Bottom/Left/Right) на основе взаимного расположения
function getHandlePositions(sourceNode, targetNode) {
  const sX = sourceNode.position.x + (sourceNode.measured?.width || 200) / 2;
  const sY = sourceNode.position.y + (sourceNode.measured?.height || 90) / 2;
  const tX = targetNode.position.x + (targetNode.measured?.width || 200) / 2;
  const tY = targetNode.position.y + (targetNode.measured?.height || 90) / 2;

  const dx = tX - sX;
  const dy = tY - sY;

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? { sourceHandle: 'right', targetHandle: 'left' } : { sourceHandle: 'left', targetHandle: 'right' };
  } else {
    return dy > 0 ? { sourceHandle: 'bottom', targetHandle: 'top' } : { sourceHandle: 'top', targetHandle: 'bottom' };
  }
}

// Функция: обновляет стороны у всех связей
function recalculateEdges(edges, nodes) {
  const nodeById = new Map(nodes.map(n => [n.id, n]));
  
  return edges.map(edge => {
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    if (!source || !target) return edge;
    
    const handles = getHandlePositions(source, target);
    return {
      ...edge,
      sourceHandle: handles.sourceHandle,
      targetHandle: handles.targetHandle,
    };
  });
}

// Функция BFS для поиска всех родственников до N-го колена
function getHighlightedIds(centerId, maxDepth, persons, families, childEdges) {
  if (!centerId) return new Set();
  
  const adj = new Map();
  persons.forEach(p => adj.set(p.id, []));
  
  families.forEach(fam => {
    if (fam.spouse1_id && fam.spouse2_id) {
      adj.get(fam.spouse1_id)?.push(fam.spouse2_id);
      adj.get(fam.spouse2_id)?.push(fam.spouse1_id);
    }
    const childrenInFam = childEdges.filter(ce => ce.family_id === fam.id).map(ce => ce.child_id);
    [fam.spouse1_id, fam.spouse2_id].filter(Boolean).forEach(parentId => {
      childrenInFam.forEach(childId => {
        adj.get(parentId)?.push(childId);
        adj.get(childId)?.push(parentId);
      });
    });
  });

  const highlighted = new Set([centerId]);
  let queue = [{ id: centerId, depth: 0 }];
  const visited = new Set([centerId]);

  while (queue.length > 0) {
    const { id, depth } = queue.shift();
    if (depth >= maxDepth) continue;

    const neighbors = adj.get(id) || [];
    for (const neighborId of neighbors) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        highlighted.add(neighborId);
        queue.push({ id: neighborId, depth: depth + 1 });
      }
    }
  }
  return highlighted;
}

export const GenealogyTree = ({ treeId, onBack, isEmbedded = false }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [graphMeta, setGraphMeta] = useState({ tree_id: null, can_edit: false });
  const [menuOpen, setMenuOpen] = useState(false);
  const [egoState, setEgoState] = useState({ active: false, centerId: null, depth: 1 });

  const { theme, setTheme: handleThemeChange } = useTheme();
  const bgImage = theme === 'dark' ? '/bg-dark.jpg' : '/bg-light.jpg';

  const dialog = useDialog();
  const dialogRef = useRef(dialog);
  useEffect(() => { dialogRef.current = dialog; }, [dialog]);

  const [viewPersonId, setViewPersonId] = useState(null);
  const [viewPerson, setViewPerson] = useState(null);
  const [editModalState, setEditModalState] = useState({ isOpen: false, mode: 'edit', personData: null });
  const [connectionSource, setConnectionSource] = useState(null);
  const [pendingConnection, setPendingConnection] = useState(null);

  const nodeTypes = useMemo(() => ({ personNode: PersonNode, familyNode: FamilyNode }), []);
  const edgeTypes = useMemo(() => ({ relationEdge: RelationEdge }), []);

  const deletePersonRef = useRef(null);
  const deleteEdgeRef = useRef(null);
  const edgesRef = useRef([]);
  const nodesRef = useRef([]);
  const personsRef = useRef([]);
  const familiesRef = useRef([]);
  const allChildEdgesRef = useRef([]);
  const allFamiliesRef = useRef([]);

  useEffect(() => { edgesRef.current = edges; }, [edges]);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);

  const fetchTree = useCallback(async () => {
    setLoadError(null);
    try {
      const url = treeId ? `/api/graph?tree_id=${treeId}` : '/api/graph';
      const res = await apiFetch(url);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Ошибка загрузки дерева (${res.status})`);
      }
      const data = await res.json();

      const canEdit = Boolean(data.can_edit);
      setGraphMeta({ tree_id: data.tree_id, can_edit: canEdit });
      personsRef.current = data.persons || [];
      allFamiliesRef.current = data.families || [];
      allChildEdgesRef.current = data.child_edges || [];

      const { rawNodes, families, layoutEdges } = buildRawGraph(data, {
        canEdit,
        onEdit: (person) => setEditModalState({ isOpen: true, mode: 'edit', personData: person }),
        onDelete: (id) => deletePersonRef.current?.(id),
        onAddConnection: (person) => setConnectionSource(person),
      });

      const hasPositions = rawNodes.some(n => n.position.x !== 0 || n.position.y !== 0);
      
      // Раскладываем только если координат нет
      let layoutedNodes = hasPositions 
        ? rawNodes 
        : getLayoutedElements(rawNodes, layoutEdges, 'TB').nodes;

      positionFamilyNodes(layoutedNodes, families);
      familiesRef.current = families;

      const { marriageEdges, childEdges, orphanedEdges, associationEdges } = buildRenderEdges(
        data,
        layoutedNodes,
        {
          canEdit,
          onRequestDeleteEdge: (edgeId) => {
            const target = edgesRef.current.find((e) => e.id === edgeId);
            if (target) deleteEdgeRef.current?.([target]);
          },
        }
      );

      const newEdges = [...childEdges, ...orphanedEdges, ...associationEdges, ...marriageEdges];
      const finalEdges = recalculateEdges(newEdges, layoutedNodes);

      setNodes(layoutedNodes);
      setEdges(finalEdges);
    } catch (err) {
      console.error('Ошибка загрузки дерева:', err);
      setLoadError(err.message || 'Ошибка загрузки дерева');
    } finally {
      setLoading(false);
    }
  }, [treeId, setNodes, setEdges]);

  const handleDeletePerson = useCallback(async (id) => {
    const ok = await dialogRef.current.confirm({
      title: 'Удалить человека?',
      description: 'Все его связи также будут скрыты.',
      variant: 'danger',
      confirmLabel: 'Удалить',
    });
    if (!ok) return;

    try {
      const res = await apiFetch(`/api/individuals/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Не удалось удалить (${res.status})`);
      await fetchTree();
    } catch (err) {
      await dialogRef.current.alert({
        title: 'Ошибка удаления',
        description: err.message || 'Не удалось удалить',
        variant: 'danger',
        confirmLabel: 'Понятно',
      });
    }
  }, [fetchTree]);

  useEffect(() => { deletePersonRef.current = handleDeletePerson; }, [handleDeletePerson]);

  const handleEdgesDelete = useCallback(async (deleted) => {
    if (!graphMeta.can_edit || !deleted?.length) return;

    const summary = deleted.map((e) => {
        if (e.data?.orphaned) return `Прямая связь`;
        if (e.data?.kind === 'marriage') return `Брак`;
        if (e.data?.kind === 'godparent') return `Крёстный`;
        return `Семья -> Ребенок`;
    }).join('\n');

    const ok = await dialogRef.current.confirm({
      title: 'Удалить связи?',
      description: `${summary}\n\nЛюди останутся в дереве.`,
      variant: 'warning',
      confirmLabel: 'Удалить',
    });
    if (!ok) {
      await fetchTree();
      return;
    }

    try {
      for (const e of deleted) {
        const kind = e.data?.kind;
        if (kind === 'marriage') {
          await apiFetch(`/api/families/${e.data.familyId}`, { method: 'DELETE' });
        } else if (kind === 'godparent') {
          await apiFetch(`/api/associations/${e.data.associationId}`, { method: 'DELETE' });
        } else {
          await apiFetch(`/api/family-children/${e.data.familyDbId}/${e.data.childId}`, { method: 'DELETE' });
        }
      }
    } catch (err) {
      await dialogRef.current.alert({
        title: 'Ошибка',
        description: err.message || 'Не удалось удалить связи',
        variant: 'danger',
        confirmLabel: 'Понятно',
      });
    } finally {
      await fetchTree();
    }
  }, [graphMeta.can_edit, fetchTree]);

  useEffect(() => { deleteEdgeRef.current = handleEdgesDelete; }, [handleEdgesDelete]);

  useEffect(() => { fetchTree(); }, [fetchTree]);

  const handleConnect = useCallback((connection) => {
      if (!graphMeta.can_edit) return;
      const sourceId = String(connection.source);
      const targetId = String(connection.target);
      const sourceIsFamily = sourceId.startsWith('family-');
      const targetIsFamily = targetId.startsWith('family-');

      if (sourceIsFamily && targetIsFamily) return;

      if (sourceIsFamily || targetIsFamily) {
        const familyNodeId = sourceIsFamily ? sourceId : targetId;
        const personNodeId = sourceIsFamily ? targetId : sourceId;
        const familyDbId = Number(familyNodeId.replace('family-', ''));
        const personId = Number(personNodeId);

        const family = familiesRef.current.find((f) => f.id === familyNodeId);
        if (family && family.parentIds.includes(personId)) return;

        setPendingConnection({ sourceId: personId, targetId: null, familyId: familyDbId });
        return;
      }

      const sourceNumId = Number(sourceId);
      const targetNumId = Number(targetId);
      if (sourceNumId === targetNumId) return;
      setPendingConnection({ sourceId: sourceNumId, targetId: targetNumId, familyId: null });
  }, [graphMeta.can_edit]);

  const handleNodesChange = useCallback((changes) => {
      const hasPersonMove = changes.some(c => c.type === 'position' && !String(c.id).startsWith('family-'));
      if (!hasPersonMove || familiesRef.current.length === 0) {
        onNodesChange(changes);
        return;
      }
      setNodes((prev) => {
        const updated = applyNodeChanges(changes, prev);
        return repositionFamilyNodesLive(updated, familiesRef.current);
      });
  }, [onNodesChange, setNodes]);

  const handleNodeDragStop = useCallback(async (event, node) => {
    if (node.type !== 'personNode') return;

    // Пересчитываем стороны связей ТОЛЬКО после того как отпустили карточку
    setEdges((eds) => recalculateEdges(eds, nodesRef.current));

    try {
      await apiFetch(`/api/individuals/${node.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ pos_x: node.position.x, pos_y: node.position.y }),
      });
    } catch (err) {
      console.error('Не удалось сохранить позицию', err);
    }
  }, [setEdges]);

  const handleAddRootPerson = () => {
    setEditModalState({ isOpen: true, mode: 'add', personData: null });
  };

  const handleAfterImport = (newTree) => {
    setMenuOpen(false);
    window.location.href = `/tree?tree_id=${newTree.id}`;
  };

  const handleAutoLayout = useCallback(async () => {
    const direction = await dialogRef.current.choose({
      title: 'Автоматическая раскладка',
      description: 'Выберите направление.',
      actions: [
        { value: 'TB', label: 'Сверху вниз', variant: 'default' },
        { value: 'BT', label: 'Снизу вверх', variant: 'default' },
        { value: 'LR', label: 'Слева направо', variant: 'default' },
        { value: 'RL', label: 'Справа налево', variant: 'default' },
      ],
      cancelLabel: 'Отмена'
    });

    if (!direction) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/graph?tree_id=${treeId}`);
      const data = await res.json();
      
      const { rawNodes, families, layoutEdges } = buildRawGraph(data, {
        canEdit: graphMeta.can_edit,
        onEdit: () => {}, onDelete: () => {}, onAddConnection: () => {},
      });

      const { nodes: layoutedNodes } = getLayoutedElements(rawNodes, layoutEdges, direction);
      positionFamilyNodes(layoutedNodes, families);

      const newEdges = recalculateEdges(edgesRef.current, layoutedNodes);
      setNodes(layoutedNodes);
      setEdges(newEdges);
      
      const positionsToSave = layoutedNodes
        .filter(n => n.type === 'personNode')
        .map(n => ({ id: Number(n.id), pos_x: n.position.x, pos_y: n.position.y }));

      if (positionsToSave.length > 0) {
        await apiFetch(`/api/trees/${treeId}/positions`, {
          method: 'PATCH',
          body: JSON.stringify({ positions: positionsToSave }),
        });
      }
    } catch (err) {
      console.error(err);
      await dialogRef.current.alert({
        title: 'Ошибка раскладки',
        description: 'Не удалось автоматически расположить элементы.',
        variant: 'danger',
        confirmLabel: 'Понятно',
      });
    } finally {
      setLoading(false);
    }
  }, [treeId, graphMeta.can_edit, setNodes, setEdges]);

  const isEmpty = !loading && nodes.length === 0;
  const canEdit = graphMeta.can_edit;
  const showTopLeftAddButton = canEdit && !isEmpty;

  const highlightedIds = useMemo(() => {
    if (!egoState.active || !egoState.centerId) return null;
    return getHighlightedIds(egoState.centerId, egoState.depth, personsRef.current, allFamiliesRef.current, allChildEdgesRef.current);
  }, [egoState, nodes.length]);

  const displayNodes = useMemo(() => {
    if (!highlightedIds) return nodes.map(n => ({ ...n, data: { ...n.data, isDimmed: false } }));
    return nodes.map(n => {
      let isDimmed = true;
      if (n.type === 'personNode') {
        isDimmed = !highlightedIds.has(Number(n.id));
      } else if (n.type === 'familyNode') {
        const fam = allFamiliesRef.current.find(f => `family-${f.id}` === n.id);
        isDimmed = !fam || (!highlightedIds.has(fam.spouse1_id) && !highlightedIds.has(fam.spouse2_id));
      }
      return { ...n, data: { ...n.data, isDimmed } };
    });
  }, [nodes, highlightedIds]);

  const displayEdges = useMemo(() => {
    if (!highlightedIds) return edges.map(e => ({ ...e, data: { ...e.data, isDimmed: false } }));
    return edges.map(e => {
      const sourceNode = nodes.find(n => n.id === e.source);
      const targetNode = nodes.find(n => n.id === e.target);
      
      const isSourceHighlighted = e.source.startsWith('family-') 
        ? !sourceNode?.data?.isDimmed 
        : highlightedIds.has(Number(e.source));
      const isTargetHighlighted = e.target.startsWith('family-')
        ? !targetNode?.data?.isDimmed
        : highlightedIds.has(Number(e.target));

      return { ...e, data: { ...e.data, isDimmed: !(isSourceHighlighted || isTargetHighlighted) } };
    });
  }, [edges, nodes, highlightedIds]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-900 text-gray-500 dark:text-slate-400">
        Загрузка дерева...
      </div>
    );
  }

  return (
    <div 
      className="w-full h-full relative transition-colors bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      {!isEmbedded && (
        <div className="absolute top-4 left-4 z-20 flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-2 rounded-xl shadow-md border border-gray-200 dark:border-slate-700 text-xs font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
              <ArrowLeft className="w-4 h-4 text-gray-600 dark:text-slate-400" />
              Назад
            </button>
          )}
          <button onClick={() => setMenuOpen(true)} className="flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-2 rounded-xl shadow-md border border-gray-200 dark:border-slate-700 text-xs font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
            <Menu className="w-4 h-4 text-gray-600 dark:text-slate-300" />
            Меню
          </button>
          {showTopLeftAddButton && (
            <button onClick={handleAddRootPerson} className="flex items-center gap-2 bg-white dark:bg-slate-800 px-4 py-2 rounded-xl shadow-md border border-gray-200 dark:border-slate-700 text-xs font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
              <UserPlus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Добавить человека
            </button>
          )}
        </div>
      )}

      {loadError && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 px-4 py-2 text-xs text-red-800 dark:text-red-300 shadow">
          <AlertCircle className="w-4 h-4" />
          {loadError}
          <button onClick={fetchTree} className="ml-2 underline">Повторить</button>
        </div>
      )}

      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={handleNodeDragStop}
        onNodeClick={(_, node) => {
          if (node.type === 'familyNode') return;
          if (canEdit) setViewPersonId(node.data.id);
          else setViewPerson(node.data);
        }}
        onConnect={handleConnect}
        onEdgesDelete={handleEdgesDelete}
        connectionMode={ConnectionMode.Loose}
        nodesConnectable={canEdit}
        nodesFocusable={canEdit}
        edgesFocusable={canEdit}
        elementsSelectable={canEdit}
        deleteKeyCode={canEdit ? ['Backspace', 'Delete'] : null}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background color={theme === 'dark' ? '#475569' : '#cbd5e1'} gap={16} variant="dots" style={{ opacity: 0.3 }} />
      </ReactFlow>

      {/* Пустое состояние */}
      {isEmpty && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-200 dark:border-slate-700 p-8 max-w-sm text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-blue-50 dark:bg-blue-950 flex items-center justify-center">
              {canEdit ? <UserPlus className="w-8 h-8 text-blue-600 dark:text-blue-400" /> : <Lock className="w-8 h-8 text-amber-500 dark:text-amber-400" />}
            </div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-slate-100">
              {loadError ? 'Не удалось загрузить дерево' : 'Дерево пока пустое'}
            </h2>
            {canEdit && (
              <button onClick={handleAddRootPerson} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm">
                <UserPlus className="w-4 h-4" /> Добавить человека
              </button>
            )}
          </div>
        </div>
      )}

      {!canEdit && <PersonViewModal person={viewPerson} isOpen={Boolean(viewPerson)} onClose={() => setViewPerson(null)} />}
      {canEdit && (
        <PersonExtendedViewModal
          personId={viewPersonId}
          isOpen={Boolean(viewPersonId)}
          onClose={() => setViewPersonId(null)}
          onRefresh={fetchTree}
          treeId={graphMeta.tree_id}
          onAddConnection={(person) => { setViewPersonId(null); setConnectionSource(person); }}
        />
      )}

      <PersonModal
        isOpen={editModalState.isOpen}
        mode={editModalState.mode}
        personData={editModalState.personData}
        treeId={graphMeta.tree_id}
        onClose={() => setEditModalState((s) => ({ ...s, isOpen: false }))}
        onRefresh={fetchTree}
      />

      {canEdit && (
        <ConnectionModal
          isOpen={Boolean(connectionSource) || Boolean(pendingConnection)}
          sourcePerson={connectionSource}
          presetSourceId={pendingConnection?.sourceId ?? null}
          presetTargetId={pendingConnection?.targetId ?? null}
          presetFamilyId={pendingConnection?.familyId ?? null}
          treeId={graphMeta.tree_id}
          allPersons={personsRef.current}
          allFamilies={allFamiliesRef.current}
          allChildEdges={allChildEdgesRef.current}
          onClose={() => { setConnectionSource(null); setPendingConnection(null); }}
          onSuccess={fetchTree}
        />
      )}

      {!isEmbedded && (
        <SideMenu
          isOpen={menuOpen}
          onClose={() => setMenuOpen(false)}
          onAutoLayout={handleAutoLayout}
          theme={theme}
          onThemeChange={handleThemeChange}
          treeId={graphMeta.tree_id}
          onAfterImport={handleAfterImport}
          egoState={egoState}
          onEgoStateChange={setEgoState}
          allPersons={personsRef.current}
        />
      )}
    </div>
  );
};