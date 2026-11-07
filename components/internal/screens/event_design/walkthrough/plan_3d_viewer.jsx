"use client";

import React, { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { Box, Camera, Footprints, MapPin, Rotate3d, RotateCcw } from "lucide-react";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  LogoLoading,
} from "@geiger/ui";
import { cn } from "@/lib/utils";
import { buildScene, planViewpoints, walkWorld } from "@/lib/event_design";

// The 3D walkthrough of a plan: orbit (dollhouse) or walk (first person) with viewpoints, reset and screenshot.
// Everything three.js sits behind next/dynamic (ssr off) so screens that never open 3D pay nothing for it.

const Plan3DScene = dynamic(() => import("./plan_3d_scene"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      <LogoLoading size={48} aria-label="Preparing the 3D view" />
    </div>
  ),
});

let webglSupport = null;
function supportsWebgl() {
  if (webglSupport === null) {
    try {
      const canvas = document.createElement("canvas");
      webglSupport = Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
    } catch {
      webglSupport = false;
    }
  }
  return webglSupport;
}
const noSubscribe = () => () => {};
const assumeTrue = () => true;
const assumeFalse = () => false;

function subscribeTheme(callback) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}
const isDark = () => document.documentElement.classList.contains("dark");

function subscribeCoarse(callback) {
  const query = window.matchMedia("(pointer: coarse)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
const isCoarse = () => window.matchMedia("(pointer: coarse)").matches;

class SceneBoundary extends React.Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error("[walkthrough.scene]", error);
  }

  render() {
    if (this.state.failed) return <Notice>The 3D view couldn&apos;t start in this browser.</Notice>;
    return this.props.children;
  }
}

function Notice({ children }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-6 text-center text-text-tertiary">
      <Box className="h-5 w-5" />
      <p className="text-xs">{children}</p>
    </div>
  );
}

function ToolButton({ active, label, onClick, children }) {
  return (
    <Button
      type="button"
      variant="ghost"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "h-8 w-8 text-muted-foreground hover:bg-surface-active hover:text-foreground",
        active && "bg-surface-active text-foreground",
      )}
    >
      {children}
    </Button>
  );
}

const MOVE_KEYS = new Set(["w", "a", "s", "d", "q", "e", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift"]);
const JOY_RADIUS = 36;

function Joystick({ inputRef }) {
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const origin = useRef(null);
  const move = (e) => {
    if (!origin.current || origin.current.id !== e.pointerId) return;
    let dx = e.clientX - origin.current.x;
    let dy = e.clientY - origin.current.y;
    const len = Math.hypot(dx, dy);
    if (len > JOY_RADIUS) {
      dx = (dx / len) * JOY_RADIUS;
      dy = (dy / len) * JOY_RADIUS;
    }
    setKnob({ x: dx, y: dy });
    inputRef.current.joyX = dx / JOY_RADIUS;
    inputRef.current.joyY = -dy / JOY_RADIUS;
  };
  const end = (e) => {
    if (origin.current?.id !== e.pointerId) return;
    origin.current = null;
    setKnob({ x: 0, y: 0 });
    inputRef.current.joyX = 0;
    inputRef.current.joyY = 0;
  };
  return (
    <div
      data-viewer-ui
      role="presentation"
      className="absolute bottom-4 left-4 flex h-24 w-24 touch-none items-center justify-center rounded-full border border-border bg-surface-card/80 backdrop-blur"
      onPointerDown={(e) => {
        e.stopPropagation();
        const box = e.currentTarget.getBoundingClientRect();
        origin.current = { id: e.pointerId, x: box.left + box.width / 2, y: box.top + box.height / 2 };
        e.currentTarget.setPointerCapture?.(e.pointerId);
        move(e);
      }}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <span
        className="h-10 w-10 rounded-full border border-border-strong bg-surface-strong"
        style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
      />
    </div>
  );
}

const slug = (s) => String(s || "plan").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "plan";

export function Plan3DViewer({
  plan,
  ceilingHeightM,
  showChairs = true,
  showLabels = false,
  showCeiling = false,
  focus,
  onPickTable,
  className,
}) {
  const webgl = useSyncExternalStore(noSubscribe, supportsWebgl, assumeTrue);
  const dark = useSyncExternalStore(subscribeTheme, isDark, assumeFalse);
  const coarse = useSyncExternalStore(subscribeCoarse, isCoarse, assumeFalse);

  const scene = useMemo(() => buildScene(plan, { ceilingHeightM }), [plan, ceilingHeightM]);
  const viewpoints = useMemo(() => planViewpoints(plan, scene), [plan, scene]);
  const world = useMemo(() => walkWorld(plan, scene), [plan, scene]);

  const [mode, setMode] = useState("orbit");
  const [goto, setGoto] = useState(null);
  const [resetNonce, setResetNonce] = useState(0);
  const [shotNonce, setShotNonce] = useState(0);
  const [seenFocus, setSeenFocus] = useState(null);
  const inputRef = useRef({ keys: new Set(), lookDX: 0, lookDY: 0, joyX: 0, joyY: 0 });
  const dragRef = useRef(null);
  const nonceRef = useRef(0);

  const goTo = useCallback(
    (key) => {
      const vp = viewpoints.find((v) => v.key === key);
      if (!vp) return;
      nonceRef.current += 1;
      setMode(vp.mode);
      setGoto({ key, nonce: nonceRef.current });
    },
    [viewpoints],
  );

  // External requests (a viewpoint list beside the viewer) arrive as { key, nonce }.
  if (focus && focus.nonce !== seenFocus) {
    setSeenFocus(focus.nonce);
    const vp = viewpoints.find((v) => v.key === focus.key);
    if (vp) {
      setMode(vp.mode);
      setGoto({ key: focus.key, nonce: `ext-${focus.nonce}` });
    }
  }

  const readInput = useCallback(() => {
    const s = inputRef.current;
    const k = s.keys;
    const has = (...names) => names.some((n) => k.has(n));
    const out = {
      forward: (has("w", "arrowup") ? 1 : 0) - (has("s", "arrowdown") ? 1 : 0),
      strafe: (has("d") ? 1 : 0) - (has("a") ? 1 : 0),
      turn: (has("arrowleft", "q") ? 1 : 0) - (has("arrowright", "e") ? 1 : 0),
      run: has("shift"),
      lookDX: s.lookDX,
      lookDY: s.lookDY,
      joyX: s.joyX,
      joyY: s.joyY,
    };
    s.lookDX = 0;
    s.lookDY = 0;
    return out;
  }, []);

  const onShot = useCallback(
    (url) => {
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug(plan?.name)}-3d.png`;
      a.click();
    },
    [plan?.name],
  );

  const onPick = useCallback(
    (key) => {
      goTo(key);
      onPickTable?.(key);
    },
    [goTo, onPickTable],
  );

  const clearKeys = () => inputRef.current.keys.clear();

  const roomViews = viewpoints.filter((v) => v.group === "room");
  const tableViews = viewpoints.filter((v) => v.group === "table");

  return (
    <div
      tabIndex={0}
      aria-label="3D view of the floor plan"
      className={cn(
        "relative h-full w-full select-none overflow-hidden bg-surface-subtle outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40",
        mode === "walk" && "touch-none cursor-grab active:cursor-grabbing",
        className,
      )}
      onKeyDown={(e) => {
        if (mode !== "walk" || e.target.closest?.("input, textarea, [role='menu']")) return;
        const key = String(e.key || "").toLowerCase();
        if (!MOVE_KEYS.has(key)) return;
        e.preventDefault();
        inputRef.current.keys.add(key);
      }}
      onKeyUp={(e) => inputRef.current.keys.delete(String(e.key || "").toLowerCase())}
      onBlur={clearKeys}
      onPointerDown={(e) => {
        if (e.target.closest?.("[data-viewer-ui]")) return;
        e.currentTarget.focus({ preventScroll: true });
        // No pointer capture here: the canvas must still receive the pointerup for click-a-table.
        if (mode !== "walk") return;
        dragRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
      }}
      onPointerMove={(e) => {
        const drag = dragRef.current;
        if (!drag || drag.id !== e.pointerId) return;
        inputRef.current.lookDX += e.clientX - drag.x;
        inputRef.current.lookDY += e.clientY - drag.y;
        drag.x = e.clientX;
        drag.y = e.clientY;
      }}
      onPointerUp={(e) => {
        if (dragRef.current?.id === e.pointerId) dragRef.current = null;
      }}
      onPointerCancel={() => {
        dragRef.current = null;
      }}
      onPointerLeave={() => {
        dragRef.current = null;
      }}
    >
      {!webgl ? (
        <Notice>This browser can&apos;t show the 3D view.</Notice>
      ) : (
        <SceneBoundary>
          <Plan3DScene
            scene={scene}
            world={world}
            viewpoints={viewpoints}
            mode={mode}
            goto={goto}
            resetNonce={resetNonce}
            shotNonce={shotNonce}
            showChairs={showChairs}
            showLabels={showLabels}
            showCeiling={showCeiling}
            dark={dark}
            readInput={readInput}
            onShot={onShot}
            onPick={onPick}
          />
        </SceneBoundary>
      )}

      <div
        data-viewer-ui
        className="absolute left-3 top-3 flex items-center gap-0.5 rounded-lg border border-border bg-surface-card/90 p-1 backdrop-blur"
      >
        <ToolButton active={mode === "orbit"} label="Orbit — the dollhouse view" onClick={() => setMode("orbit")}>
          <Rotate3d className="h-4 w-4" />
        </ToolButton>
        <ToolButton active={mode === "walk"} label="Walk — first person" onClick={() => setMode("walk")}>
          <Footprints className="h-4 w-4" />
        </ToolButton>
        <span className="mx-1 h-5 w-px bg-border" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="h-8 gap-1.5 px-2 text-sm text-muted-foreground hover:bg-surface-active hover:text-foreground"
            >
              <MapPin className="h-4 w-4" />
              <span className="hidden sm:inline">Viewpoints</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-80 w-56 overflow-y-auto">
            <DropdownMenuLabel>Room</DropdownMenuLabel>
            {roomViews.map((v) => (
              <DropdownMenuItem key={v.key} onSelect={() => goTo(v.key)}>
                {v.mode === "orbit" ? <Rotate3d className="h-4 w-4" /> : <Footprints className="h-4 w-4" />}
                {v.label}
              </DropdownMenuItem>
            ))}
            {tableViews.length ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Seated at</DropdownMenuLabel>
                {tableViews.map((v) => (
                  <DropdownMenuItem key={v.key} onSelect={() => goTo(v.key)}>
                    {v.label}
                  </DropdownMenuItem>
                ))}
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
        <ToolButton label="Reset view" onClick={() => setResetNonce((n) => n + 1)}>
          <RotateCcw className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Save a screenshot" onClick={() => setShotNonce((n) => n + 1)}>
          <Camera className="h-4 w-4" />
        </ToolButton>
      </div>

      {mode === "walk" && coarse ? <Joystick inputRef={inputRef} /> : null}
      {mode === "walk" && !coarse ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-4">
          <p className="rounded-lg border border-border bg-surface-card/90 px-3 py-1.5 text-xs text-text-secondary backdrop-blur">
            WASD or arrows to move · drag to look · Shift to hurry · click a table to sit at it
          </p>
        </div>
      ) : null}
      {mode === "orbit" ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 hidden justify-center px-4 sm:flex">
          <p className="rounded-lg border border-border bg-surface-card/90 px-3 py-1.5 text-xs text-text-secondary backdrop-blur">
            Drag to orbit · right-drag to pan · scroll to zoom · click a table to sit at it
          </p>
        </div>
      ) : null}
    </div>
  );
}

// Viewpoints for a plan, for lists rendered beside the viewer.
export function usePlanViewpoints(plan, ceilingHeightM) {
  return useMemo(() => planViewpoints(plan, buildScene(plan, { ceilingHeightM })), [plan, ceilingHeightM]);
}

export default Plan3DViewer;
