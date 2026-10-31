'use client';

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  ReactFlow, Controls, Background, useNodesState, useEdgesState, applyNodeChanges, ConnectionMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { PersonNode } from './PersonNode';
import { RelationEdge } from './RelationEdge';
import { PersonModal } from './PersonModal';
import { PersonViewModal } from './PersonViewModal';
import { PersonExtendedViewModal } from './PersonExtendedViewModal';
import { ConnectionModal } from './ConnectionModal';
import { SideMenu } from './SideMenu';
import { FamilyNode } from './FamilyNode';
import { getLayoutedElements, positionFamilyNodes, repositionFamilyNodesLive } from '@/lib/layout';
import { buildRawGraph, buildMarriageEdges } from '@/lib/tree-adapter';
import { useRelationActions } from '@/hooks/useRelationActions';
import { UserPlus, AlertCircle, Lock, Menu } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useDialog } from './DialogProvider';

const THEME_KEY = 'tree-theme';
const DIRECTION_KEY = 'tree-direction';

export const GenealogyTree = ({ isLoggedIn = false }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [layoutDirection, setLayoutDirection] = useState('TB');
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState('light');

  // Восстановление настроек из localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedDirection = localStorage.getItem(DIRECTION_KEY);
    if (savedDirection && ['TB', 'BT', 'LR', 'RL'].includes(savedDirection)) {
      setLayoutDirection(savedDirection);
    }

    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme === 'light' || savedTheme === 'dark') {
      setTheme(savedTheme);
    }
  }, []);

  const handleNodesChange = useCallback(
    (changes) => {
      // Пересчитываем только при движении НЕ-family узлов
      const hasPersonMove = changes.some(
        (c) => c.type === 'position' && !String(c.id).startsWith('family-')
      );

      if (!hasPersonMove || familiesRef.current.length === 0) {
        onNodesChange(changes);
        return;
      }

      setNodes((prev) => {
        const updated = applyNodeChanges(changes, prev);
        return repositionFamilyNodesLive(updated, familiesRef.current, layoutDirection);
      });
    },
    [onNodesChange, setNodes, layoutDirection]
  );

  const handleThemeChange = useCallback((t) => {
    setTheme(t);
    if (typeof window !== 'undefined') localStorage.setItem(THEME_KEY, t);
  }, []);

  const handleDirectionChange = useCallback((dir) => {
    setLayoutDirection(dir);
    if (typeof window !== 'undefined') localStorage.setItem(DIRECTION_KEY, dir);
  }, []);

  const [viewPersonId, setViewPersonId] = useState(null);
  const [editModalState, setEditModalState] = useState({
    isOpen: false, mode: 'edit', personData: null,  presetParentIds: null,
  });
  const [connectionSource, setConnectionSource] = useState(null);
  const [pendingConnection, setPendingConnection] = useState(null);

  const nodeTypes = useMemo(() => ({ personNode: PersonNode, familyNode: FamilyNode }),  []);
  const edgeTypes = useMemo(() => ({ relationEdge: RelationEdge }), []);
  

  const deletePersonRef = useRef(null);
  const deleteEdgeRef = useRef(null);
  const edgesRef = useRef([]);
  const nodesRef = useRef([]);
  const personsRef = useRef([]);
  const familiesRef = useRef([]);

  useEffect(() => { edgesRef.current = edges; }, [edges]);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);

  const actions = useRelationActions();

  const fetchTree = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await apiFetch('/api/tree');
      if (!res.ok) throw new Error(`Не удалось загрузить дерево (${res.status})`);
      const data = await res.json();
      personsRef.current = data.nodes || [];

      const {
        rawNodes,
        families,
        layoutEdges,
        parentEdges,
        familyChildEdges,
        godparentEdges,
     } = buildRawGraph(data, {
        isLoggedIn,
        layoutDirection,
        onEdit: (person) => setEditModalState({ isOpen: true, mode: 'edit', personData: person }),
        onDelete: (id) => deletePersonRef.current?.(id),
        onAddConnection: (person) => setConnectionSource(person),
        onAddChild: (family) => {
          setEditModalState({
            isOpen: true,
            mode: 'add',
            personData: null,
            presetParentIds: family.parentIds,
          });
        },
        onRequestDeleteEdge: (edgeId) => {
          const target = edgesRef.current.find((e) => e.id === edgeId);
          if (target) deleteEdgeRef.current?.([target]);
        },
      });

      // Layout по реальным родитель-ребёнок связям
      const { nodes: layoutedNodes } = getLayoutedElements(
        rawNodes,
        layoutEdges,
        layoutDirection,
        data.marriages || []
      );

      // Позиционируем FamilyNode по центру линии брака
      positionFamilyNodes(layoutedNodes, families, layoutDirection);
      familiesRef.current = families;

      const marriageEdges = buildMarriageEdges(data.marriages || [], layoutedNodes, {
        isLoggedIn,
        layoutDirection,
        onRequestDeleteEdge: (edgeId) => {
          const target = edgesRef.current.find((e) => e.id === edgeId);
          if (target) deleteEdgeRef.current?.([target]);
        },
      });

      setNodes(layoutedNodes);
      setEdges([
        ...parentEdges,
        ...familyChildEdges,
        ...godparentEdges,
        ...marriageEdges,
      ]);
    } catch (err) {
      console.error('Ошибка загрузки дерева:', err);
      setLoadError(err.message || 'Ошибка загрузки дерева');
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn, layoutDirection, setNodes, setEdges]);


  const dialog = useDialog();
  const dialogRef = useRef(dialog);
  useEffect(() => { dialogRef.current = dialog; }, [dialog]);

  const handleDeletePerson = useCallback(async (id) => {
    const ok = await dialogRef.current.confirm({
      title: 'Удалить человека?',
      description: 'Все его связи также будут удалены. Действие нельзя отменить.',
      variant: 'danger',
      confirmLabel: 'Удалить',
      cancelLabel: 'Отмена',
    });
    if (!ok) return;

    try {
      const res = await apiFetch(`/api/persons/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Не удалось удалить (${res.status})`);
      await fetchTree();
    } catch (err) {
      await dialogRef.current.alert({
        title: 'Ошибка удаления',
        description: err.message || 'Не удалось удалить человека',
        variant: 'danger',
        confirmLabel: 'Понятно',
      });
    }
  }, [fetchTree]);
  useEffect(() => { deletePersonRef.current = handleDeletePerson; }, [handleDeletePerson]);

  const handleEdgesDelete = useCallback(async (deleted) => {
    if (!isLoggedIn || !deleted?.length) return;

    const summary = deleted
      .map((e) => {
        if (e.data?.familyId) {
          const childName =
            nodesRef.current.find((n) => n.id === String(e.data.childId))?.data?.first_name || '?';
          return `Семья → ${childName}`;
        }
        const s = nodesRef.current.find((n) => n.id === String(e.source))?.data?.first_name || '?';
        const t = nodesRef.current.find((n) => n.id === String(e.target))?.data?.first_name || '?';
        return `${s} → ${t}`;
      })
      .join('\n');

    const ok = await dialogRef.current.confirm({
      title: 'Удалить связи?',
      description: `${summary}\n\nСами люди останутся в дереве.`,
      variant: 'warning',
      confirmLabel: 'Удалить',
      cancelLabel: 'Отмена',
    });
    if (!ok) {
      await fetchTree();
      return;
    }

    try {
      for (const e of deleted) {
        if (e.data?.familyId) {
          const parentIds = e.data.parentIds || [];
          const childId = e.data.childId;
          for (const pid of parentIds) {
            await actions.deleteParentChild(Number(pid), Number(childId));
          }
          continue;
        }

        const kind = e.data?.kind;
        if (kind === 'marriage') {
          await actions.deleteMarriage(e.data.marriageId);
        } else if (kind === 'godparent') {
          await actions.deleteRelation(e.data.relationId);
        } else {
          await actions.deleteParentChild(Number(e.source), Number(e.target));
        }
      }
    } catch (err) {
      await dialogRef.current.alert({
        title: 'Ошибка удаления',
        description: err.message || 'Не удалось удалить связь',
        variant: 'danger',
        confirmLabel: 'Понятно',
      });
    } finally {
      await fetchTree();
    }
  }, [isLoggedIn, fetchTree, actions]);

  useEffect(() => { deleteEdgeRef.current = handleEdgesDelete; }, [handleEdgesDelete]);


  useEffect(() => { fetchTree(); }, [fetchTree]);

  const handleConnect = useCallback(
    async (connection) => {
      if (!isLoggedIn) return;

      const sourceId = String(connection.source);
      const targetId = String(connection.target);

      const sourceIsFamily = sourceId.startsWith('family-');
      const targetIsFamily = targetId.startsWith('family-');

      // family ↔ family — не поддерживаем
      if (sourceIsFamily && targetIsFamily) return;

      //Сценарий: одна из сторон — family
      if (sourceIsFamily || targetIsFamily) {
        const familyId = sourceIsFamily ? sourceId : targetId;
        const personIdStr = sourceIsFamily ? targetId : sourceId;
        const personId = Number(personIdStr);

        const family = familiesRef.current.find((f) => f.id === familyId);
        if (!family) return;

        // Персона — один из родителей этой семьи → игнорируем.
        if (family.parentIds.includes(personId)) return;

        // Персона уже ребёнок этой семьи → тоже игнорируем.
        if (family.children.some((c) => c.childId === personId)) return;

        const personName =
          nodesRef.current.find((n) => n.id === String(personId))?.data?.first_name || 'человек';

        const kind = await dialogRef.current.choose({
          title: 'Новая связь',
          description: `Кем будет «${personName}» для этой пары?`,
          actions: [
            { value: 'biological', label: 'Родной ребёнок', variant: 'default' },
            { value: 'adoptive', label: 'Приёмный ребёнок', variant: 'warning' },
          ],
          cancelLabel: 'Отмена',
        });
        if (!kind) return;

        try {
          for (const parentId of family.parentIds) {
            await actions.createParentChild(Number(parentId), personId, kind);
          }
          await fetchTree();
        } catch (err) {
          await dialogRef.current.alert({
            title: 'Ошибка',
            description: err.message || 'Не удалось создать связь',
            variant: 'danger',
            confirmLabel: 'Понятно',
          });
          await fetchTree();
        }
        return;
      }

      //Обычный случай: персона ↔ персона
      const sourceNumId = Number(sourceId);
      const targetNumId = Number(targetId);
      if (sourceNumId === targetNumId) return;
      setPendingConnection({ sourceId: sourceNumId, targetId: targetNumId });
    },
    [isLoggedIn, actions, fetchTree]
  );


  const handleAddRootPerson = () => {
    setEditModalState({ isOpen: true, mode: 'add', personData: null });
  };

  const isEmpty = !loading && nodes.length === 0;
  const showTopLeftAddButton = isLoggedIn && !isEmpty;

  if (loading) {
    return <div className="flex items-center justify-center h-screen text-gray-500">Загрузка дерева...</div>;
  }

  return (
    <div className="w-full h-screen bg-slate-50 relative">
      {/* Верхний левый угол: кнопка «Меню» + «Добавить человека» */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-3">
        <button
          onClick={() => setMenuOpen(true)}
          className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl shadow-md border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          title="Настройки дерева"
        >
          <Menu className="w-4 h-4 text-gray-600" />
          Меню
        </button>

        {showTopLeftAddButton && (
          <button
            onClick={handleAddRootPerson}
            className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-md border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <UserPlus className="w-4 h-4 text-blue-600" />
            Добавить человека
          </button>
        )}
      </div>

      {loadError && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-800 shadow">
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
          setViewPersonId(node.data.id);
        }}
        onConnect={handleConnect}
        onEdgesDelete={handleEdgesDelete}
        nodesConnectable={isLoggedIn}
        nodesFocusable={isLoggedIn}
        edgesFocusable={isLoggedIn}
        elementsSelectable={isLoggedIn}
        deleteKeyCode={isLoggedIn ? ['Backspace', 'Delete'] : null}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView
      >
        <Background color="#cbd5e1" gap={16} />
        <Controls />
      </ReactFlow>

      {isEmpty && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto bg-white rounded-2xl shadow-xl border border-gray-200 p-8 max-w-sm text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-blue-50 flex items-center justify-center">
              {isLoggedIn ? <UserPlus className="w-8 h-8 text-blue-600" /> : <Lock className="w-8 h-8 text-amber-500" />}
            </div>
            <h2 className="text-lg font-bold text-gray-800">
              {loadError ? 'Не удалось загрузить дерево' : 'Дерево пока пустое'}
            </h2>
            <p className="text-sm text-gray-500">
              {isLoggedIn
                ? loadError
                  ? 'Попробуйте добавить человека — данные сохранятся.'
                  : 'Создайте первую персону, чтобы начать строить дерево.'
                : 'Войдите, чтобы добавить первых людей.'}
            </p>
            {isLoggedIn ? (
              <button
                onClick={handleAddRootPerson}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
              >
                <UserPlus className="w-4 h-4" /> Добавить человека
              </button>
            ) : (
              <p className="text-xs text-gray-400">Авторизуйтесь через кнопку в правом верхнем углу</p>
            )}
          </div>
        </div>
      )}

      {!isLoggedIn && (
        <PersonViewModal
          personId={viewPersonId}
          isOpen={Boolean(viewPersonId)}
          onClose={() => setViewPersonId(null)}
        />
      )}

      {isLoggedIn && (
        <PersonExtendedViewModal
          personId={viewPersonId}
          isOpen={Boolean(viewPersonId)}
          onClose={() => setViewPersonId(null)}
          onRefresh={fetchTree}
        />
      )}

      <PersonModal
        isOpen={editModalState.isOpen}
        mode={editModalState.mode}
        personData={editModalState.personData}
        onClose={() => setEditModalState((s) => ({ ...s, isOpen: false, presetParentIds: null }))}
        onRefresh={fetchTree}
      />

      {isLoggedIn && (
        <ConnectionModal
          isOpen={Boolean(connectionSource) || Boolean(pendingConnection)}
          sourcePerson={connectionSource}
          presetSourceId={pendingConnection?.sourceId ?? null}
          presetTargetId={pendingConnection?.targetId ?? null}
          allPersons={personsRef.current}
          onClose={() => {
            setConnectionSource(null);
            setPendingConnection(null);
          }}
          onSuccess={fetchTree}
        />
      )}

      {/* Drawer вынесен из верхнего блока — это fixed-панель */}
      <SideMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        direction={layoutDirection}
        onDirectionChange={handleDirectionChange}
        theme={theme}
        onThemeChange={handleThemeChange}
      />
    </div>
  );
};