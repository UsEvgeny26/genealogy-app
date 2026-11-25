import dagre from '@dagrejs/dagre';

const NODE_WIDTH = 200;
const NODE_HEIGHT = 90;
const FAMILY_SIZE = 10;

export const getLayoutedElements = (nodes, edges, direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 60,
    ranksep: 120,
    marginx: 20,
    marginy: 20,
  });

  // Только реальные персоны идут в dagre. FamilyNode — виртуальный, позиционируем после.
  const personNodes = nodes.filter((n) => n.type !== 'familyNode');

  personNodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    if (dagreGraph.hasNode(edge.source) && dagreGraph.hasNode(edge.target)) {
      dagreGraph.setEdge(edge.source, edge.target);
    }
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    if (node.type === 'familyNode') {
      return { ...node, position: { x: 0, y: 0 } };
    }
    const pos = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

const FALLBACK_W = 200;
const FALLBACK_H = 90;

function getSize(node) {
  return {
    w: node.measured?.width ?? node.width ?? FALLBACK_W,
    h: node.measured?.height ?? node.height ?? FALLBACK_H,
  };
}

export function positionFamilyNodes(layoutedNodes, families) {
  if (!families || families.length === 0) return;

  const nodeById = new Map(layoutedNodes.map((n) => [n.id, n]));

  for (const f of families) {
    const fNode = nodeById.get(f.id);
    if (!fNode) continue;

    const validParentIds = (f.parentIds || []).filter(
      (id) => id != null && nodeById.has(String(id))
    );

    if (validParentIds.length === 0) {
      const childIds = (f.childIds || []).filter((id) => nodeById.has(String(id)));
      if (childIds.length > 0) {
        const firstChild = nodeById.get(String(childIds[0]));
        const cSize = getSize(firstChild);
        fNode.position = {
          x: firstChild.position.x + cSize.w / 2 - FAMILY_SIZE / 2,
          y: firstChild.position.y - 60,
        };
      }
      continue;
    }

    const a = nodeById.get(String(validParentIds[0]));
    const b = validParentIds[1] ? nodeById.get(String(validParentIds[1])) : a;

    const aSize = getSize(a);
    const bSize = getSize(b);

    const centerX = (a.position.x + aSize.w / 2 + b.position.x + bSize.w / 2) / 2;
    const centerY = (a.position.y + aSize.h / 2 + b.position.y + bSize.h / 2) / 2;

    fNode.position = {
      x: centerX - FAMILY_SIZE / 2,
      y: centerY - FAMILY_SIZE / 2,
    };
  }
}

export function repositionFamilyNodesLive(nodes, families) {
  if (!families || families.length === 0) return nodes;

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const familyById = new Map(families.map((f) => [f.id, f]));

  let changed = false;
  const next = nodes.map((node) => {
    if (node.type !== 'familyNode') return node;

    const family = familyById.get(node.id);
    if (!family) return node;

    const a = nodeById.get(String(family.parentIds[0]));
    const b = family.parentIds[1] ? nodeById.get(String(family.parentIds[1])) : a;
    if (!a || !b) return node;

    const aSize = getSize(a);
    const bSize = getSize(b);

    const centerX = (a.position.x + aSize.w / 2 + b.position.x + bSize.w / 2) / 2;
    const centerY = (a.position.y + aSize.h / 2 + b.position.y + bSize.h / 2) / 2;

    const newPos = {
      x: centerX - FAMILY_SIZE / 2,
      y: centerY - FAMILY_SIZE / 2,
    };

    if (
      Math.abs(newPos.x - node.position.x) < 0.5 &&
      Math.abs(newPos.y - node.position.y) < 0.5
    ) {
      return node;
    }

    changed = true;
    return { ...node, position: newPos };
  });

  return changed ? next : nodes;
}