import { MarkerType } from '@xyflow/react';
import { RELATION_CONFIG, RELATION_TYPES } from './relation-config';

// relationship_type из БД → RELATION_TYPES
const CHILD_KIND_MAP = {
  biological: RELATION_TYPES.BIOLOGICAL_PARENT,
  adoptive: RELATION_TYPES.ADOPTIVE_PARENT,
  foster: RELATION_TYPES.FOSTER_PARENT,
  step: RELATION_TYPES.STEP_PARENT,
};

/**
 * Строит "сырые" узлы и рёбра для dagre-layout.
 * Рендер-рёбра (с цветами/маркерами) — см. buildRenderEdges, после layout.
 *
 * apiData — ответ GET /api/graph:
 *   { tree_id, tree_name, owner_id, can_edit, persons, families,
 *     marriage_edges, child_edges, association_edges }
 */
export function buildRawGraph(apiData, {
  canEdit,
  layoutDirection = 'TB',
  onEdit,
  onDelete,
  onAddConnection,
}) {
  const persons = apiData.persons || [];
  const families = apiData.families || [];
  const childEdges = apiData.child_edges || [];

  const personNodes = persons.map((p) => ({
    id: String(p.id),
    type: 'personNode',
    data: {
      ...p,
      canEdit,
      layoutDirection,
      onEdit: () => onEdit(p),
      onDelete: () => onDelete(p.id),
      onAddConnection: () => onAddConnection(p),
    },
    position: { x: 0, y: 0 },
  }));

  const familyNodes = families.map((f) => {
    const spouse1 = f.spouse1_id != null ? f.spouse1_id : null;
    const spouse2 = f.spouse2_id != null ? f.spouse2_id : null;
    return {
      id: `family-${f.id}`,
      type: 'familyNode',
      data: {
        layoutDirection,
        status: f.status,
        dbId: f.id,
        spouse1_id: spouse1,
        spouse2_id: spouse2,
      },
      position: { x: 0, y: 0 },
      draggable: false,
      selectable: false,
    };
  });

  // Для dagre: family-children → person→child (разворачиваем в каждого родителя)
  const layoutEdges = [];
  for (const f of families) {
    const parents = [f.spouse1_id, f.spouse2_id].filter(Boolean);
    const familyChildren = childEdges
      .filter((ce) => ce.family_id === f.id)
      .map((ce) => ce.child_id);
    for (const parentId of parents) {
      for (const childId of familyChildren) {
        layoutEdges.push({
          source: String(parentId),
          target: String(childId),
        });
      }
    }
  }

  const familiesMeta = families.map((f) => ({
    id: `family-${f.id}`,
    parentIds: [f.spouse1_id, f.spouse2_id].filter((id) => id != null),
    childIds: childEdges.filter((ce) => ce.family_id === f.id).map((ce) => ce.child_id),
    status: f.status,
  }));
  return {
    rawNodes: [...personNodes, ...familyNodes],
    families: familiesMeta,
    layoutEdges,
  };

  const orphanedEdges = apiData.orphaned_parent_edges || [];
  for (const oe of orphanedEdges) {
    layoutEdges.push({
      source: String(oe.parent_id),
      target: String(oe.child_id),
    });
  }
}

export function buildRenderEdges(apiData, layoutedNodes, {
  canEdit,
  layoutDirection = 'TB',
  onRequestDeleteEdge,
}) {
  const posById = new Map(layoutedNodes.map((n) => [n.id, n.position]));
  const isVertical = layoutDirection === 'TB' || layoutDirection === 'BT';
  const familiesById = new Map((apiData.families || []).map((f) => [f.id, f]));

  // --- marriage edges ---
  const marriageEdges = (apiData.marriage_edges || [])
    .map((me) => {
      const a = posById.get(String(me.source_id));
      const b = posById.get(String(me.target_id));
      if (!a || !b) return null;

      const [sourceId, targetId] = isVertical
        ? (a.x <= b.x ? [me.source_id, me.target_id] : [me.target_id, me.source_id])
        : (a.y <= b.y ? [me.source_id, me.target_id] : [me.target_id, me.source_id]);

      const fam = familiesById.get(me.family_id);
      const isDivorced = fam?.status === 'divorced' || fam?.status === 'widowed';

      return {
        id: `m-${me.family_id}`,
        source: String(sourceId),
        target: String(targetId),
        sourceHandle: 'perp-source',
        targetHandle: 'perp-target',
        type: 'relationEdge',
        animated: true,
        data: {
          kind: RELATION_TYPES.MARRIAGE,
          familyId: me.family_id,
          divorced: isDivorced,
          canDelete: canEdit,
          onRequestDelete: onRequestDeleteEdge,
        },
      };
    })
    .filter(Boolean);

  // --- child edges (family → child) ---
  const childEdges = (apiData.child_edges || []).map((ce) => {
    const kind = CHILD_KIND_MAP[ce.relationship_type] || RELATION_TYPES.BIOLOGICAL_PARENT;
    const cfg = RELATION_CONFIG[kind];
    return {
      id: `fc-${ce.family_id}-${ce.child_id}`,
      source: `family-${ce.family_id}`,
      target: String(ce.child_id),
      sourceHandle: 'flow-source',
      targetHandle: 'flow-target',
      type: 'relationEdge',
      animated: true,
      markerEnd: cfg.arrow
        ? { type: MarkerType.ArrowClosed, color: cfg.color }
        : undefined,
      data: {
        kind,
        familyId: `family-${ce.family_id}`,
        familyDbId: ce.family_id,
        childId: ce.child_id,
        relationshipType: ce.relationship_type,
        canDelete: canEdit,
        onRequestDelete: onRequestDeleteEdge,
      },
    };
  });

  // --- association edges (крёстные) ---
  const associationEdges = (apiData.association_edges || []).map((ae) => {
    const cfg = RELATION_CONFIG[RELATION_TYPES.GODPARENT];
    return {
      id: `a-${ae.id}`,
      source: String(ae.source_id),
      target: String(ae.target_id),
      sourceHandle: 'flow-source',
      targetHandle: 'flow-target',
      type: 'relationEdge',
      animated: true,
      markerEnd: cfg.arrow
        ? { type: MarkerType.ArrowClosed, color: cfg.color }
        : undefined,
      data: {
        kind: RELATION_TYPES.GODPARENT,
        associationId: ae.id,
        associationType: ae.type,
        canDelete: canEdit,
        onRequestDelete: onRequestDeleteEdge,
      },
    };
  });

  // --- orphaned parent edges (прямые, без family-node) ---
  const orphanedEdges = (apiData.orphaned_parent_edges || []).map((oe, i) => {
    const kind = CHILD_KIND_MAP[oe.relationship_type] || RELATION_TYPES.BIOLOGICAL_PARENT;
    const cfg = RELATION_CONFIG[kind];
    return {
      id: `op-${oe.parent_id}-${oe.child_id}-${i}`,
      source: String(oe.parent_id),
      target: String(oe.child_id),
      sourceHandle: 'flow-source',
      targetHandle: 'flow-target',
      type: 'relationEdge',
      animated: true,
      markerEnd: cfg.arrow
        ? { type: MarkerType.ArrowClosed, color: cfg.color }
        : undefined,
      data: {
        kind,
        orphaned: true,  // ← помечаем: это прямая связь, не family-child
        familyDbId: oe.family_id, 
        parentId: oe.parent_id,
        childId: oe.child_id,
        relationshipType: oe.relationship_type,
        canDelete: canEdit,
        onRequestDelete: onRequestDeleteEdge,
      },
    };
  });

  return { marriageEdges, childEdges, orphanedEdges, associationEdges };
}