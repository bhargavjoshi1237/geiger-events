"use client";

import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Panel,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTheme } from "next-themes";
import { Presentation } from "lucide-react";

import { ZoomControls } from "@/components/internal/screens/workflows/canvas/zoom_controls";
import { slidesToGraph, graphToSlides } from "@/lib/display/graph";
import {
  defaultConfig,
  defaultDuration,
  groupedCatalog,
} from "@/lib/display/constants";
import { nodeTypes } from "./board_nodes";

const DND_MIME = "application/geiger-display-slide";

const newSlideId = () =>
  `slide_${
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)
  }`;

// Draggable palette of slide types. Drag a chip onto the canvas to add a slide
// at the drop point — same interaction as the workflow canvas so the two
// builders feel like one tool.
function Palette() {
  const onDragStart = (type) => (event) => {
    event.dataTransfer.setData(DND_MIME, type);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <Panel position="top-right">
      <div className="w-52 rounded-xl border border-border bg-surface-card/90 p-2 shadow-xl backdrop-blur-md">
        <p className="px-1 pb-1 text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
          Drag to add
        </p>
        <div className="max-h-[52vh] space-y-2 overflow-y-auto">
          {groupedCatalog().map((group) => (
            <div key={group.group}>
              <p className="px-1 py-0.5 text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                {group.group}
              </p>
              {group.items.map((item) => {
                const Icon = item.icon || Presentation;
                return (
                  <div
                    key={item.key}
                    draggable
                    onDragStart={onDragStart(item.key)}
                    title={item.desc}
                    className="flex cursor-grab items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground active:cursor-grabbing"
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function CanvasInner({ slides, graph, onChange, onSelect }) {
  const { resolvedTheme } = useTheme();
  const { screenToFlowPosition } = useReactFlow();

  // Seed once on mount from the canonical slides (the builder remounts the
  // canvas when the view toggles, so this always reflects the latest slides).
  const seeded = useMemo(() => slidesToGraph(slides, graph), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [nodes, setNodes, onNodesChange] = useNodesState(seeded.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(seeded.edges);

  // Reconcile canvas -> canonical slides after the first render. The builder does
  // not re-seed this component, so emitting up never loops back into a re-seed.
  const firstRun = useRef(true);
  const slidesRef = useRef(slides);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const nextGraph = { nodes, edges, viewport: graph?.viewport };
    const nextSlides = graphToSlides(nextGraph, slidesRef.current);
    slidesRef.current = nextSlides;
    onChange({ slides: nextSlides, graph: nextGraph });
  }, [nodes, edges]); // eslint-disable-line react-hooks/exhaustive-deps

  // Push inspector edits back into the node the canvas is rendering, so a config
  // change shows on the node summary without re-seeding (which would lose pan).
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => {
        const slide = slides.find((s) => s.id === node.id);
        if (!slide) return node;
        if (
          node.data?.config === slide.config &&
          node.data?.duration === slide.duration
        ) {
          return node;
        }
        return {
          ...node,
          data: { ...node.data, config: slide.config, duration: slide.duration },
        };
      }),
    );
  }, [slides, setNodes]);

  const onConnect = useCallback(
    (connection) =>
      setEdges((eds) => addEdge({ ...connection, type: "smoothstep" }, eds)),
    [setEdges],
  );

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      const type = event.dataTransfer.getData(DND_MIME);
      if (!type) return;
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const node = {
        id: newSlideId(),
        type: "slide",
        position,
        data: { type, config: defaultConfig(type), duration: defaultDuration(type) },
        width: 260,
      };
      setNodes((nds) => nds.concat(node));
    },
    [screenToFlowPosition, setNodes],
  );

  const handleSelectionChange = useCallback(
    ({ nodes: selectedNodes }) => onSelect?.(selectedNodes?.[0]?.id || null),
    [onSelect],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onSelectionChange={handleSelectionChange}
      nodeTypes={nodeTypes}
      colorMode={resolvedTheme === "light" ? "light" : "dark"}
      defaultViewport={seeded.viewport}
      proOptions={{ hideAttribution: true }}
      minZoom={0.2}
      maxZoom={2}
      fitView
      fitViewOptions={{ padding: 0.3 }}
      deleteKeyCode={["Backspace", "Delete"]}
      className="bg-background"
    >
      <Background color="var(--canvas-dots)" gap={12} size={1} variant="dots" />
      <ZoomControls />
      <Palette />
    </ReactFlow>
  );
}

// Drag-drop node canvas view of a board's slide queue. `slides` is canonical;
// this view adds positions + connectors and reconciles edits back via onChange.
export function BoardCanvas({ slides, graph, onChange, onSelect }) {
  return (
    <div className="h-[60vh] w-full overflow-hidden rounded-xl border border-border bg-background">
      <ReactFlowProvider>
        <CanvasInner
          slides={slides}
          graph={graph}
          onChange={onChange}
          onSelect={onSelect}
        />
      </ReactFlowProvider>
    </div>
  );
}

export default BoardCanvas;
