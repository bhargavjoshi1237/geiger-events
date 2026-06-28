// Adapter between a workflow's canonical `steps` array and the @xyflow/react
// `graph` ({ nodes, edges, viewport }) used by the canvas view.
//
// `steps` is the source of truth for the automation logic — an ordered list
// [trigger, step, step, …]. The canvas is a presentation layer: it carries node
// POSITIONS and the connectors, but the logical order is the steps array order.
//
// Conditions in v1 are sequential "gates" (continue if the condition passes),
// so the flow is a single chain and round-trips losslessly: list order ⇔
// sequential edges. `graphToSteps` walks the chain from the trigger so canvas
// edits (drag, reconnect) reconcile back into the ordered steps array.

const NODE_W = 300;
const ROW_H = 150;
const COL_X = 0;

// Build { nodes, edges, viewport } from the ordered steps. Reuses each step's
// saved position when present, else auto-lays-out a vertical column. Keeps the
// previous viewport so toggling views doesn't reset the user's pan/zoom.
export function stepsToGraph(steps, prevGraph) {
  const list = Array.isArray(steps) ? steps : [];

  const nodes = list.map((step, i) => ({
    id: step.id,
    type: step.kind, // "trigger" | "condition" | "action" -> nodeTypes
    position: step.position || { x: COL_X, y: i * ROW_H },
    data: {
      type: step.type,
      config: step.config || {},
      kind: step.kind,
    },
    width: NODE_W,
  }));

  // Sequential edges trigger -> s1 -> s2 -> …
  const edges = [];
  for (let i = 0; i < list.length - 1; i += 1) {
    const a = list[i];
    const b = list[i + 1];
    edges.push({
      id: `e-${a.id}-${b.id}`,
      source: a.id,
      target: b.id,
      type: "smoothstep",
    });
  }

  const viewport =
    prevGraph && prevGraph.viewport ? prevGraph.viewport : { x: 0, y: 0, zoom: 1 };

  return { nodes, edges, viewport };
}

// Reconcile a canvas graph back into the canonical steps array. Walks outgoing
// edges from the trigger to recover order, preserves each step's `config` from
// the previous steps (by id), and folds the node's current position back in.
// Any node not reachable from the trigger is appended so nothing is lost.
export function graphToSteps(graph, prevSteps) {
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph?.edges) ? graph.edges : [];
  if (!nodes.length) return Array.isArray(prevSteps) ? prevSteps : [];

  const prevById = new Map(
    (Array.isArray(prevSteps) ? prevSteps : []).map((s) => [s.id, s]),
  );
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  // Adjacency in edge declaration order (stable for a linear chain).
  const outgoing = new Map();
  for (const e of edges) {
    if (!outgoing.has(e.source)) outgoing.set(e.source, []);
    outgoing.get(e.source).push(e.target);
  }

  const toStep = (node) => {
    const prev = prevById.get(node.id) || {};
    return {
      id: node.id,
      kind: node.data?.kind || node.type || prev.kind,
      type: node.data?.type ?? prev.type,
      config: node.data?.config ?? prev.config ?? {},
      position: node.position || prev.position || { x: COL_X, y: 0 },
    };
  };

  // Start at the trigger node (fallback: first node).
  const triggerNode =
    nodes.find((n) => (n.data?.kind || n.type) === "trigger") || nodes[0];

  const ordered = [];
  const seen = new Set();
  let cursor = triggerNode;
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    ordered.push(toStep(cursor));
    const nextIds = outgoing.get(cursor.id) || [];
    cursor = nextIds.map((id) => nodeById.get(id)).find((n) => n && !seen.has(n.id));
  }

  // Append any orphans (unreachable from the trigger) so edits never drop nodes.
  for (const node of nodes) {
    if (!seen.has(node.id)) {
      ordered.push(toStep(node));
      seen.add(node.id);
    }
  }

  return ordered;
}
