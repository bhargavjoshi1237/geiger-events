
const NODE_W = 260;
const ROW_H = 150;
const COL_X = 0;

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

export function graphToSlides(graph, prevSlides) {
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph?.edges) ? graph.edges : [];
  if (!nodes.length) return [];

  const prevById = new Map(
    (Array.isArray(prevSlides) ? prevSlides : []).map((s) => [s.id, s]),
  );
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

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

  for (const node of nodes) {
    if (!seen.has(node.id)) {
      ordered.push(toSlide(node));
      seen.add(node.id);
    }
  }

  return ordered;
}
