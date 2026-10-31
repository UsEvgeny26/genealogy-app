import { MarkerType } from '@xyflow/react';
import { RELATION_CONFIG, RELATION_TYPES } from './relation-config';

function configForParentKind(kind) {
  return kind === 'adoptive'
    ? RELATION_CONFIG[RELATION_TYPES.ADOPTIVE_PARENT]
    : RELATION_CONFIG[RELATION_TYPES.BIOLOGICAL_PARENT];
}

function kindForParentKind(kind) {
  return kind === 'adoptive'
    ? RELATION_TYPES.ADOPTIVE_PARENT
    : RELATION_TYPES.BIOLOGICAL_PARENT;
}

/**
 * Возвращает:
 *   rawNodes         — все узлы (персоны + family nodes)
 *   families         — список семейств (для positionFamilyNodes)
 *   layoutEdges      — родитель-ребёнок в исходном виде (только для dagre)
 *   parentEdges      — родитель-ребёнок для рендера (без скрытых в семьях)
 *   familyChildEdges — рёбра от family node к детям
 *   godparentEdges   — крёстные
 */
export function buildRawGraph(apiData, {
  isLoggedIn,
  layoutDirection = 'TB',
  onEdit,
  onDelete,
  onAddConnection,
  onAddChild,  
  onRequestDeleteEdge,
}) {
  const relations = apiData.relations || [];
  const marriages = apiData.marriages || [];
  const parentChildEdges = apiData.edges || [];

  /* --- 1. Считаем семьи --- */
  const parentsByChild = new Map();
  for (const e of parentChildEdges) {
    if (!parentsByChild.has(e.target_id)) parentsByChild.set(e.target_id, []);
    parentsByChild.get(e.target_id).push({ id: e.source_id, kind: e.kind || 'biological' });
  }

  const families = [];
  const hiddenParentChild = new Set(); // "parentId-childId"

  for (const m of marriages) {
    const commonChildren = [];
    for (const [childId, parents] of parentsByChild) {
      const pA = parents.find((p) => p.id === m.spouse1_id);
      const pB = parents.find((p) => p.id === m.spouse2_id);
      if (pA && pB && pA.kind === pB.kind) {
        commonChildren.push({ childId, kind: pA.kind });
      }
    }

    if (commonChildren.length > 0) {
      const familyId = `family-${m.id}`;
      families.push({
        id: familyId,
        marriageId: m.id,
        marriageStatus: m.status || 'married',
        parentIds: [m.spouse1_id, m.spouse2_id],
        children: commonChildren,
      });
      for (const c of commonChildren) {
        hiddenParentChild.add(`${m.spouse1_id}-${c.childId}`);
        hiddenParentChild.add(`${m.spouse2_id}-${c.childId}`);
      }
    }
  }

  /* --- 2. Узлы --- */
  const personNodes = apiData.nodes.map((node) => ({
    id: String(node.id),
    type: 'personNode',
    data: {
      ...node,
      isLoggedIn,
      layoutDirection,
      onEdit: () => onEdit(node),
      onDelete: () => onDelete(node.id),
      onAddConnection: () => onAddConnection(node),
    },
    position: { x: 0, y: 0 },
  }));

  const familyNodes = families.map((f) => ({
    id: f.id,
    type: 'familyNode',
    data: {
      layoutDirection,
      kind: f.children[0]?.kind || 'biological',
      marriageStatus: f.marriageStatus,
    },
    position: { x: 0, y: 0 },
    draggable: false,
    selectable: false,
  }));

  /* --- 3. Рёбра --- */

  // 3a. Для dagre — все родитель-ребёнок БЕЗ фильтрации (реальная структура)
  const layoutEdges = parentChildEdges.map((edge) => ({
    id: `pc-${edge.source_id}-${edge.target_id}`,
    source: String(edge.source_id),
    target: String(edge.target_id),
    sourceHandle: 'flow-source',
    targetHandle: 'flow-target',
    data: { kind: edge.kind || 'biological' },
  }));

  // 3b. Для рендера — без тех, что ушли в семью
  const parentEdges = parentChildEdges
    .filter((e) => !hiddenParentChild.has(`${e.source_id}-${e.target_id}`))
    .map((edge) => {
      const kind = kindForParentKind(edge.kind);
      const cfg = configForParentKind(edge.kind);
      return {
        id: `pc-${edge.source_id}-${edge.target_id}`,
        source: String(edge.source_id),
        target: String(edge.target_id),
        sourceHandle: 'flow-source',
        targetHandle: 'flow-target',
        type: 'relationEdge',
        animated: true,
        markerEnd: cfg.arrow ? { type: MarkerType.ArrowClosed, color: cfg.color } : undefined,
        data: { kind, canDelete: isLoggedIn, onRequestDelete: onRequestDeleteEdge },
      };
    });

  // 3c. Рёбра от семьи к детям
  const familyChildEdges = families.flatMap((f) =>
    f.children.map((c) => {
      const kind = kindForParentKind(c.kind);
      const cfg = configForParentKind(c.kind);
      return {
        id: `fc-${f.id}-${c.childId}`,
        source: f.id,
        target: String(c.childId),
        sourceHandle: 'flow-source',
        targetHandle: 'flow-target',
        type: 'relationEdge',
        animated: true,
        markerEnd: cfg.arrow ? { type: MarkerType.ArrowClosed, color: cfg.color } : undefined,
        data: {
          kind,
          familyId: f.id,
          childId: c.childId,
          parentIds: f.parentIds,   // ← для удаления через ребро
          canDelete: isLoggedIn,     // ← было false
          onRequestDelete: onRequestDeleteEdge,
        },
      };
    })
  );

  // 3d. Крёстные
  const godparentEdges = relations
    .filter((r) => r.type === 'godparent')
    .map((r) => {
      const cfg = RELATION_CONFIG[RELATION_TYPES.GODPARENT];
      return {
        id: `g-${r.id}`,
        source: String(r.from_id),
        target: String(r.to_id),
        sourceHandle: 'flow-source',
        targetHandle: 'flow-target',
        type: 'relationEdge',
        animated: true,
        markerEnd: cfg.arrow ? { type: MarkerType.ArrowClosed, color: cfg.color } : undefined,
        data: {
          kind: RELATION_TYPES.GODPARENT,
          relationId: r.id,
          canDelete: isLoggedIn,
          onRequestDelete: onRequestDeleteEdge,
        },
      };
    });

  return {
    rawNodes: [...personNodes, ...familyNodes],
    families,
    layoutEdges,
    parentEdges,
    familyChildEdges,
    godparentEdges,
  };
}

export function buildMarriageEdges(marriages, layoutedNodes, {
  isLoggedIn,
  layoutDirection = 'TB',
  onRequestDeleteEdge,
}) {
  const posById = new Map(layoutedNodes.map((n) => [n.id, n.position]));
  const isVertical = layoutDirection === 'TB' || layoutDirection === 'BT';

  return marriages
    .map((m) => {
      const a = posById.get(String(m.spouse1_id));
      const b = posById.get(String(m.spouse2_id));
      if (!a || !b) return null;

      const [sourceId, targetId] = isVertical
        ? (a.x <= b.x ? [m.spouse1_id, m.spouse2_id] : [m.spouse2_id, m.spouse1_id])
        : (a.y <= b.y ? [m.spouse1_id, m.spouse2_id] : [m.spouse2_id, m.spouse1_id]);

      return {
        id: `m-${m.id}`,
        source: String(sourceId),
        target: String(targetId),
        sourceHandle: 'perp-source',
        targetHandle: 'perp-target',
        type: 'relationEdge',
        animated: true,
        data: {
          kind: RELATION_TYPES.MARRIAGE,
          marriageId: m.id,
          divorced: m.status === 'divorced',
          canDelete: isLoggedIn,
          onRequestDelete: onRequestDeleteEdge,
        },
      };
    })
    .filter(Boolean);
}