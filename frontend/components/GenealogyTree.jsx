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

const DIRECTION_KEY = 'tree-direction';

export const GenealogyTree = ({ treeId, onBack, isEmbedded = false}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [graphMeta, setGraphMeta] = useState({ tree_id: null, can_edit: false });

  const [layoutDirection, setLayoutDirection] = useState('TB');
  const [menuOpen, setMenuOpen] = useState(false);

  const { theme, setTheme: handleThemeChange } = useTheme();

  const dialog = useDialog();
  const dialogRef = useRef(dialog);
  useEffect(() => { dialogRef.current = dialog; }, [dialog]);

  // Восстановление направления из localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedDir = localStorage.getItem(DIRECTION_KEY);
    if (savedDir && ['TB', 'BT', 'LR', 'RL'].includes(savedDir)) {
      setLayoutDirection(savedDir);
    }
  }, []);

  const handleDirectionChange = useCallback((dir) => {
    setLayoutDirection(dir);
    if (typeof window !== 'undefined') localStorage.setItem(DIRECTION_KEY, dir);
  }, []);

  const [viewPersonId, setViewPersonId] = useState(null);
  const [viewPerson, setViewPerson] = useState(null);
  const [editModalState, setEditModalState] = useState({
    isOpen: false, mode: 'edit', personData: null,
  });
  const [connectionSource, setConnectionSource] = useState(null);
  const [pendingConnection, setPendingConnection] = useState(null);

  const nodeTypes = useMemo(
    () => ({ personNode: PersonNode, familyNode: FamilyNode }),
    []
  );
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

  /*  Загрузка  */

  const fetchTree = useCallback(async () => {
    setLoadError(null);
    try {
      const url = treeId
        ? `/api/graph?tree_id=${treeId}`
        : '/api/graph';
      const res = await apiFetch(url);
      if (!res.ok) {
        // Читаем ошибку от FastAPI (например, "Дерево не найдено" или "Нет доступа")
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
        layoutDirection,
        onEdit: (person) =>
          setEditModalState({ isOpen: true, mode: 'edit', personData: person }),
        onDelete: (id) => deletePersonRef.current?.(id),
        onAddConnection: (person) => setConnectionSource(person),
      });

      const { nodes: layoutedNodes } = getLayoutedElements(
        rawNodes,
        layoutEdges,
        layoutDirection,
        []
      );

      positionFamilyNodes(layoutedNodes, families);
      familiesRef.current = families;

      const { marriageEdges, childEdges, orphanedEdges, associationEdges } = buildRenderEdges(
        data,
        layoutedNodes,
        {
          canEdit,
          layoutDirection,
          onRequestDeleteEdge: (edgeId) => {
            const target = edgesRef.current.find((e) => e.id === edgeId);
            if (target) deleteEdgeRef.current?.([target]);
          },
        }
      );

      setNodes(layoutedNodes);
      setEdges([...childEdges, ...orphanedEdges, ...associationEdges, ...marriageEdges]);
    } catch (err) {
      console.error('Ошибка загрузки дерева:', err);
      setLoadError(err.message || 'Ошибка загрузки дерева');
    } finally {
      setLoading(false);
    }
  }, [treeId, layoutDirection, setNodes, setEdges]);

  /*  Удаление персоны  */

  const handleDeletePerson = useCallback(async (id) => {
    const ok = await dialogRef.current.confirm({
      title: 'Удалить человека?',
      description: 'Все его связи также будут скрыты. Действие можно отменить только через базу.',
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

  /*  Удаление рёбер  */

  const handleEdgesDelete = useCallback(async (deleted) => {
    if (!graphMeta.can_edit || !deleted?.length) return;

    const summary = deleted
      .map((e) => {
        if (e.data?.orphaned) {
          const s = nodesRef.current.find((n) => n.id === String(e.source))?.data?.first_name || '?';
          const t = nodesRef.current.find((n) => n.id === String(e.target))?.data?.first_name || '?';
          return `${s} → ${t}`;
        }
        const kind = e.data?.kind;
        if (kind === 'marriage') {
          const s = nodesRef.current.find((n) => n.id === String(e.source))?.data?.first_name || '?';
          const t = nodesRef.current.find((n) => n.id === String(e.target))?.data?.first_name || '?';
          return `Брак: ${s} — ${t}`;
        }
        if (kind === 'godparent') {
          const s = nodesRef.current.find((n) => n.id === String(e.source))?.data?.first_name || '?';
          const t = nodesRef.current.find((n) => n.id === String(e.target))?.data?.first_name || '?';
          return `Крёстный: ${s} → ${t}`;
        }
        const childName = nodesRef.current.find((n) => n.id === String(e.target))?.data?.first_name || '?';
        return `Семья → ${childName}`;
      })
      .join('\n');

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
          await apiFetch(
            `/api/family-children/${e.data.familyDbId}/${e.data.childId}`,
            { method: 'DELETE' }
          );
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

  /*  Connect через drag  */

  const handleConnect = useCallback(
    (connection) => {
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

        setPendingConnection({
          sourceId: personId,
          targetId: null,
          familyId: familyDbId,
        });
        return;
      }

      const sourceNumId = Number(sourceId);
      const targetNumId = Number(targetId);
      if (sourceNumId === targetNumId) return;
      setPendingConnection({
        sourceId: sourceNumId,
        targetId: targetNumId,
        familyId: null,
      });
    },
    [graphMeta.can_edit]
  );

  /*  Drag узлов  */

  const handleNodesChange = useCallback(
    (changes) => {
      const hasPersonMove = changes.some(
        (c) => c.type === 'position' && !String(c.id).startsWith('family-')
      );

      if (!hasPersonMove || familiesRef.current.length === 0) {
        onNodesChange(changes);
        return;
      }

      setNodes((prev) => {
        const updated = applyNodeChanges(changes, prev);
        return repositionFamilyNodesLive(updated, familiesRef.current);
      });
    },
    [onNodesChange, setNodes]
  );

  /*  Прочее  */

  const handleAddRootPerson = () => {
    setEditModalState({ isOpen: true, mode: 'add', personData: null });
  };

  const handleAfterImport = (newTree) => {
    setMenuOpen(false);
    // Полный reload на новое дерево через URL
    window.location.href = `/tree?tree_id=${newTree.id}`;
  };

  const isEmpty = !loading && nodes.length === 0;
  const canEdit = graphMeta.can_edit;
  const showTopLeftAddButton = canEdit && !isEmpty;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-900 text-gray-500 dark:text-slate-400">
        Загрузка дерева...
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-slate-50 dark:bg-slate-900 relative transition-colors">
      {/* Верхняя панель (скрываем, если встроено в страницу) */}
      {!isEmbedded && (
        <div className="absolute top-4 left-4 z-20 flex items-center gap-3">
          {/* Кнопка возврата к списку деревьев */}
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-2 rounded-xl shadow-md border border-gray-200 dark:border-slate-700 text-xs font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              title="К списку деревьев"
            >
              <ArrowLeft className="w-4 h-4 text-gray-600 dark:text-slate-400" />
              Назад
            </button>
          )}

          <button
            onClick={() => setMenuOpen(true)}
            className="flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-2 rounded-xl shadow-md border border-gray-200 dark:border-slate-700 text-xs font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
            title="Настройки дерева"
          >
            <Menu className="w-4 h-4 text-gray-600 dark:text-slate-300" />
            Меню
          </button>

          {showTopLeftAddButton && (
            <button
              onClick={handleAddRootPerson}
              className="flex items-center gap-2 bg-white dark:bg-slate-800 px-4 py-2 rounded-xl shadow-md border border-gray-200 dark:border-slate-700 text-xs font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
            >
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
        key={`rf-${layoutDirection}`}
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_, node) => {
          if (node.type === 'familyNode') return;
          if (canEdit) {
            setViewPersonId(node.data.id);
          } else {
            setViewPerson(node.data);
          }
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
        <Background color="#cbd5e1" gap={16} />
        <Controls />
      </ReactFlow>

      {isEmpty && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-200 dark:border-slate-700 p-8 max-w-sm text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-blue-50 dark:bg-blue-950 flex items-center justify-center">
              {canEdit
                ? <UserPlus className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                : <Lock className="w-8 h-8 text-amber-500 dark:text-amber-400" />}
            </div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-slate-100">
              {loadError ? 'Не удалось загрузить дерево' : 'Дерево пока пустое'}
            </h2>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              {canEdit
                ? 'Создайте первую персону, чтобы начать строить дерево.'
                : 'Войдите, чтобы добавить первых людей.'}
            </p>
            {canEdit ? (
              <button
                onClick={handleAddRootPerson}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
              >
                <UserPlus className="w-4 h-4" /> Добавить человека
              </button>
            ) : (
              <p className="text-xs text-gray-400 dark:text-slate-500">
                Авторизуйтесь через кнопку в правом верхнем углу
              </p>
            )}
          </div>
        </div>
      )}

      {!canEdit && (
        <PersonViewModal
          person={viewPerson}
          isOpen={Boolean(viewPerson)}
          onClose={() => setViewPerson(null)}
        />
      )}

      {canEdit && (
        <PersonExtendedViewModal
          personId={viewPersonId}
          isOpen={Boolean(viewPersonId)}
          onClose={() => setViewPersonId(null)}
          onRefresh={fetchTree}
          treeId={graphMeta.tree_id}
          onAddConnection={(person) => {
            setViewPersonId(null);
            setConnectionSource(person);
          }}
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
          onClose={() => {
            setConnectionSource(null);
            setPendingConnection(null);
          }}
          onSuccess={fetchTree}
        />
      )}

      {!isEmbedded && (
        <SideMenu
          isOpen={menuOpen}
          onClose={() => setMenuOpen(false)}
          direction={layoutDirection}
          onDirectionChange={handleDirectionChange}
          theme={theme}
          onThemeChange={handleThemeChange}
          treeId={graphMeta.tree_id}
          onAfterImport={handleAfterImport}
        />
      )}
    </div>
  );
};