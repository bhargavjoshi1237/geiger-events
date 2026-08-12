// Adapter between a display board's canonical `slides` array and the
// `@xyflow/react` graph ({ nodes, edges, viewport }) the board canvas edits.
// Mirrors lib/workflows/graph.js — same contract, different payload.
//
// `slides` is the source of truth for what the board plays and in what order.
// The canvas is a presentation layer: it carries node POSITIONS and the
// connectors, and the playback order is the slides array order. The queue is a
// single chain, so list order <=> sequential edges round-trips losslessly, and
// `graphToSlides` walks the chain from the head to recover order after a drag or
// a reconnect.

const NODE_W = 260;
const ROW_H = 150;
const COL_X = 0;

// Build { nodes, edges, viewport } from the ordered slides. Reuses each slide's
// saved position when present, else auto-lays-out a vertical column. Keeps the
// previous viewport so toggling views doesn't reset the user's pan/zoom.
export function slidesToGraph(slides, prevGraph) {
  const list = Array.isArray(slides) ? slides : [];

  const nodes = list.map((slide, i) => ({
    id: slide.id,
    type: "slide",
    position: slide.position || { x: COL_X, y: i * ROW_H },
    data: {
      type: slide.type,
      config: slide.config || {},
      duration: slide.duration,
      index: i,
    },
    width: NODE_W,
  }));

  // Sequential edges s1 -> s2 -> …
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

// Reconcile a canvas graph back into the canonical slides array. Walks outgoing
// edges from the head to recover order, preserves each slide's `config` from the
// previous slides (by id), and folds the node's current position back in. Any
// node not reachable from the head is appended so edits never drop a slide.
export function graphToSlides(graph, prevSlides) {
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph?.edges) ? graph.edges : [];
  if (!nodes.length) return [];

  const prevById = new Map(
    (Array.isArray(prevSlides) ? prevSlides : []).map((s) => [s.id, s]),
  );
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  // Adjacency in edge declaration order (stable for a linear chain).
  const outgoing = new Map();
  const hasIncoming = new Set();
  for (const e of edges) {
    if (!outgoing.has(e.source)) outgoing.set(e.source, []);
    outgoing.get(e.source).push(e.target);
    hasIncoming.add(e.target);
  }

  const toSlide = (node) => {
    const prev = prevById.get(node.id) || {};
    return {
      id: node.id,
      type: node.data?.type ?? prev.type,
      config: node.data?.config ?? prev.config ?? {},
      duration: node.data?.duration ?? prev.duration ?? 10,
      position: node.position || prev.position || { x: COL_X, y: 0 },
    };
  };

  // The head is the only node nothing points at. With no clear head (a cycle, or
  // a fresh canvas with no edges yet) fall back to the first node so the order
  // still resolves to something stable.
  const head = nodes.find((n) => !hasIncoming.has(n.id)) || nodes[0];

  const ordered = [];
  const seen = new Set();
  let cursor = head;
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    ordered.push(toSlide(cursor));
    const nextIds = outgoing.get(cursor.id) || [];
    cursor = nextIds.map((id) => nodeById.get(id)).find((n) => n && !seen.has(n.id));
  }

  // Append any orphans (unreachable from the head) so edits never drop a slide.
  for (const node of nodes) {
    if (!seen.has(node.id)) {
      ordered.push(toSlide(node));
      seen.add(node.id);
    }
  }

  return ordered;
}
