"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTheme } from "next-themes";
import {
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Lock,
  Magnet,
  Maximize,
  Minus,
  MousePointer2,
  Plus,
  Square,
  Type,
  Unlock,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { stockSize } from "@/lib/passes/stock";
import { cn } from "@/lib/utils";
import { CardEditor } from "./card_editor";

// Pixels per millimetre for the on-screen card. React Flow's zoom scales it
// further; the editor divides pointer deltas by both.
const PX_PER_MM = 4;

// The pass itself, as a directly-editable object on the worktable.
function PassNode({ data }) {
  const { getZoom } = useReactFlow();
  const { wMm, hMm } = stockSize(data.template?.stock);

  return (
    <div>
      <CardEditor
        template={data.template}
        event={data.event}
        attendee={data.attendee}
        qrSettings={data.qrSettings}
        selectedId={data.selectedId}
        onSelect={data.onSelect}
        onChange={data.onLayoutChange}
        tool={data.tool}
        onToolDone={data.onToolDone}
        scale={PX_PER_MM}
        getZoom={getZoom}
        snap={data.snap}
        snapMm={data.snapMm}
      />
      <p className="mt-2 text-center text-[11px] text-text-tertiary">
        {wMm} × {hMm} mm
      </p>
    </div>
  );
}

// Scaled plan of one printed sheet: the page, its margin, and where each pass
// lands. Cells up to `count` are filled so a half-used final sheet is obvious.
function SheetNode({ data }) {
  const { grid, count } = data;
  const { cols, rows, page, wMm, hMm, margin, gutter, perPage } = grid;
  const height = 150;
  const width = (page.wMm / page.hMm) * height;
  const sheets = Math.max(1, Math.ceil((count || 1) / perPage));

  const cells = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const index = r * cols + c;
      cells.push({
        index,
        left: ((margin + c * (wMm + gutter)) / page.wMm) * 100,
        top: ((margin + r * (hMm + gutter)) / page.hMm) * 100,
        w: (wMm / page.wMm) * 100,
        h: (hMm / page.hMm) * 100,
      });
    }
  }

  return (
    <div className="cursor-grab active:cursor-grabbing">
      <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
        Sheet
      </p>
      <div
        className="relative rounded-sm border border-border bg-surface-strong shadow-lg"
        style={{ width, height }}
      >
        {cells.map((cell) => (
          <div
            key={cell.index}
            className={cn(
              "absolute rounded-[2px]",
              cell.index < (count || 1) ? "bg-surface-card" : "bg-surface-active",
            )}
            style={{
              left: `${cell.left}%`,
              top: `${cell.top}%`,
              width: `${cell.w}%`,
              height: `${cell.h}%`,
            }}
          />
        ))}
      </div>
      <p className="mt-2 max-w-[150px] text-[11px] leading-snug text-text-tertiary">
        {page.wMm > 214 ? "US Letter" : "A4"} · {perPage} up · {sheets} sheet
        {sheets === 1 ? "" : "s"} for {count || 0} pass{count === 1 ? "" : "es"}
      </p>
    </div>
  );
}

const nodeTypes = { pass: PassNode, sheet: SheetNode };

// Lock + zoom, in one bottom-left stack. Locking freezes the worktable (no pan,
// no wheel zoom, nothing dragged by accident) so the card can be edited without
// the canvas shifting underneath; the zoom buttons still work.
function CanvasControls({ locked, onToggleLock }) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const buttons = [
    ["Zoom in", Plus, () => zoomIn({ duration: 300 })],
    ["Zoom out", Minus, () => zoomOut({ duration: 300 })],
    ["Fit view", Maximize, () => fitView({ duration: 300, padding: 0.25 })],
  ];

  return (
    <Panel position="bottom-left">
      <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface-card/80 shadow-xl backdrop-blur-md">
        <button
          type="button"
          aria-label={locked ? "Unlock canvas" : "Lock canvas"}
          aria-pressed={locked}
          title={locked ? "Unlock canvas" : "Lock canvas"}
          onClick={onToggleLock}
          className={cn(
            "flex items-center justify-center p-2 transition-colors",
            locked
              ? "bg-primary/15 text-foreground"
              : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
          )}
        >
          {locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
        </button>
        {buttons.map(([label, Icon, onClick]) => (
          <button
            key={label}
            type="button"
            aria-label={label}
            title={label}
            onClick={onClick}
            className="flex items-center justify-center border-t border-border p-2 text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>
    </Panel>
  );
}

// Snap spacings offered, in millimetres. 2 mm reads well on a 54-89 mm card.
const SNAP_STEPS = [1, 2, 5, 10];

const TOOLS = [
  ["select", MousePointer2, "Select & move"],
  ["box", Square, "Draw a section"],
  ["text", Type, "Add text"],
  ["image", ImageIcon, "Add an image slot"],
];

function CanvasInner({
  template,
  event,
  attendee,
  qrSettings,
  grid,
  passCount,
  stepperLabel,
  onPrev,
  onNext,
  canStep,
  selectedId,
  onSelect,
  onLayoutChange,
}) {
  const { resolvedTheme } = useTheme();
  const [tool, setTool] = useState("select");
  const [locked, setLocked] = useState(false);
  const [snap, setSnap] = useState(true);
  const [snapMm, setSnapMm] = useState(2);
  const onToolDone = useCallback(() => setTool("select"), []);

  const seeded = useMemo(
    () => [
      {
        id: "pass",
        type: "pass",
        position: { x: 0, y: 0 },
        // The card is manipulated in place, so React Flow must not drag it —
        // but it stays selectable, or the node wrapper turns off pointer events
        // and nothing inside the card can be clicked.
        draggable: false,
        selectable: true,
        data: {},
      },
      {
        id: "sheet",
        type: "sheet",
        position: { x: 520, y: 40 },
        data: { grid, count: passCount },
      },
    ],
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(seeded);

  // Design edits refresh node contents in place — the sheet plan keeps whatever
  // position it was dragged to.
  useEffect(() => {
    setNodes((prev) =>
      prev.map((node) =>
        node.id === "pass"
          ? {
              ...node,
              data: {
                template,
                event,
                attendee,
                qrSettings,
                selectedId,
                onSelect,
                onLayoutChange,
                tool,
                onToolDone,
                snap,
                snapMm,
              },
            }
          : { ...node, data: { grid, count: passCount } },
      ),
    );
  }, [
    template,
    event,
    attendee,
    qrSettings,
    grid,
    passCount,
    selectedId,
    onSelect,
    onLayoutChange,
    tool,
    onToolDone,
    snap,
    snapMm,
    setNodes,
  ]);

  return (
    <ReactFlow
      nodes={nodes}
      onNodesChange={onNodesChange}
      nodeTypes={nodeTypes}
      colorMode={resolvedTheme === "light" ? "light" : "dark"}
      proOptions={{ hideAttribution: true }}
      minZoom={0.3}
      maxZoom={3}
      fitView
      fitViewOptions={{ padding: 0.25 }}
      nodesConnectable={false}
      nodesDraggable={!locked}
      panOnDrag={!locked}
      zoomOnScroll={!locked}
      zoomOnPinch={!locked}
      zoomOnDoubleClick={!locked}
      deleteKeyCode={null}
      className="bg-background"
    >
      <Background color="var(--canvas-dots)" gap={16} size={1} variant="dots" />
      <CanvasControls locked={locked} onToggleLock={() => setLocked((v) => !v)} />

      {/* Tool strip: pick a tool, then drag on the card to create that element. */}
      <Panel position="top-left">
        <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface-card/80 shadow-xl backdrop-blur-md">
          {TOOLS.map(([key, Icon, label]) => (
            <button
              key={key}
              type="button"
              aria-label={label}
              title={label}
              onClick={() => setTool(key)}
              className={cn(
                "flex items-center justify-center p-2 transition-colors",
                key !== "select" && "border-t border-border",
                tool === key
                  ? "bg-primary/15 text-foreground"
                  : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}

          {/* Snapping: the magnet toggles it, the step below sets the spacing. */}
          <button
            type="button"
            aria-label={snap ? "Turn snapping off" : "Turn snapping on"}
            aria-pressed={snap}
            title={snap ? "Snapping on" : "Snapping off"}
            onClick={() => setSnap((v) => !v)}
            className={cn(
              "flex items-center justify-center border-t border-border p-2 transition-colors",
              snap
                ? "bg-primary/15 text-foreground"
                : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
            )}
          >
            <Magnet className="h-4 w-4" />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                disabled={!snap}
                title="Snap spacing"
                className="flex items-center justify-center border-t border-border px-2 py-1.5 text-[10px] text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground disabled:opacity-40"
              >
                {snapMm}mm
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-32 border-border bg-surface-subtle shadow-xl">
              <DropdownMenuLabel className="text-xs text-text-tertiary">
                Snap spacing
              </DropdownMenuLabel>
              {SNAP_STEPS.map((step) => (
                <DropdownMenuItem key={step} onClick={() => setSnapMm(step)}>
                  {step} mm
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Panel>

      <Panel position="bottom-center">
        <div className="flex items-center gap-1 rounded-full border border-border bg-surface-subtle px-1 py-1 shadow-xl">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            aria-label="Previous attendee"
            disabled={!canStep}
            onClick={onPrev}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="max-w-[280px] truncate px-2 text-xs text-text-secondary">
            {stepperLabel}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            aria-label="Next attendee"
            disabled={!canStep}
            onClick={onNext}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </Panel>
    </ReactFlow>
  );
}

// The centre of the workbench: a pannable, zoomable worktable holding the pass
// (edited in place) and the sheet plan, plus a stepper for paging attendees.
export function PassCanvas(props) {
  if (!props.template || !props.grid) {
    return <div className="min-w-0 flex-1 bg-background" />;
  }
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}

export default PassCanvas;
