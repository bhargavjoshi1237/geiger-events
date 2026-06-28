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
import { Zap } from "lucide-react";

import { nodeTypes } from "./workflow_nodes";
import { ZoomControls } from "./zoom_controls";
import { stepsToGraph, graphToSteps } from "@/lib/workflows/graph";
import {
  CONDITION_CATALOG,
  ACTION_CATALOG,
  catalogEntry,
  defaultConfig,
  groupByGroup,
} from "../constants";

const DND_MIME = "application/geiger-workflow";

const newNodeId = () =>
  `step_${
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)
  }`;

// Draggable palette of conditions + actions. Drag a chip onto the canvas to add
// a node at the drop point.
function Palette() {
  const onDragStart = (kind, type) => (event) => {
    event.dataTransfer.setData(DND_MIME, JSON.stringify({ kind, type }));
    event.dataTransfer.effectAllowed = "move";
  };

  const groups = [
    { group: "Conditions", items: CONDITION_CATALOG, kind: "condition" },
    ...groupByGroup(ACTION_CATALOG).map((g) => ({ ...g, kind: "action" })),
  ];

  return (
    <Panel position="top-right">
      <div className="w-52 rounded-xl border border-border bg-surface-card/90 p-2 shadow-xl backdrop-blur-md">
        <p className="px-1 pb-1 text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
          Drag to add
        </p>
        <div className="max-h-[52vh] space-y-2 overflow-y-auto">
          {groups.map((group) => (
            <div key={group.group}>
              <p className="px-1 py-0.5 text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                {group.group}
              </p>
              {group.items.map((item) => {
                const Icon = item.icon || Zap;
                return (
                  <div
                    key={item.key}
                    draggable
                    onDragStart={onDragStart(group.kind, item.key)}
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

function CanvasInner({ steps, graph, onChange }) {
  const { resolvedTheme } = useTheme();
  const { screenToFlowPosition } = useReactFlow();

  // Seed once on mount from the canonical steps (the builder remounts the canvas
  // when the view toggles, so this always reflects the latest steps).
  const seeded = useMemo(() => stepsToGraph(steps, graph), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [nodes, setNodes, onNodesChange] = useNodesState(seeded.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(seeded.edges);

  // Reconcile canvas → canonical steps after the first render. The builder does
  // not re-seed this component, so emitting up never loops back into a re-seed.
  const firstRun = useRef(true);
  const stepsRef = useRef(steps);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const nextGraph = { nodes, edges, viewport: graph?.viewport };
    const nextSteps = graphToSteps(nextGraph, stepsRef.current);
    stepsRef.current = nextSteps;
    onChange({ steps: nextSteps, graph: nextGraph });
  }, [nodes, edges]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const raw = event.dataTransfer.getData(DND_MIME);
      if (!raw) return;
      let payload;
      try {
        payload = JSON.parse(raw);
      } catch {
        return;
      }
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      const entry = catalogEntry(payload.type);
      const node = {
        id: newNodeId(),
        type: payload.kind,
        position,
        data: { type: payload.type, config: defaultConfig(entry), kind: payload.kind },
        width: 300,
      };
      setNodes((nds) => nds.concat(node));
    },
    [screenToFlowPosition, setNodes],
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

// Drag-drop node canvas view of a workflow. `steps` is canonical; this view
// adds positions + connectors and reconciles edits back via onChange.
export function WorkflowCanvas({ steps, graph, onChange }) {
  return (
    <div className="h-[70vh] w-full overflow-hidden rounded-xl border border-border bg-background">
      <ReactFlowProvider>
        <CanvasInner steps={steps} graph={graph} onChange={onChange} />
      </ReactFlowProvider>
    </div>
  );
}

export default WorkflowCanvas;
