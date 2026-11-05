"use client";

import React, { useEffect, useState, useSyncExternalStore } from "react";
import { Copy, Minus, Square, X } from "lucide-react";

import { getDesktopBridge } from "@/lib/desktop/bridge";
import { cn } from "@/lib/utils";

const subscribeNothing = () => () => {};
const readBridge = () => getDesktopBridge();
const noBridgeOnServer = () => null;

// Full-height cells flush to the window corner, so they read as window chrome rather than more toolbar icons.
const CELL =
  "flex h-full w-11 items-center justify-center text-muted-foreground transition-colors duration-150 hover:bg-surface-hover hover:text-foreground focus-visible:bg-surface-hover focus-visible:text-foreground focus-visible:outline-none";

function useWindowState(bridge) {
  const [state, setState] = useState({ maximized: false, fullscreen: false });

  useEffect(() => {
    if (!bridge) return;
    let alive = true;
    bridge.getWindowState().then((next) => alive && next && setState(next)).catch(() => {});
    const unsubscribe = bridge.onWindowState((next) => next && setState(next));
    return () => {
      alive = false;
      unsubscribe?.();
    };
  }, [bridge]);

  return state;
}

// The desktop app's own minimize / maximize / close, in place of the native frame; renders nothing outside the frameless main window.
export function WindowControls({ className, divider = false }) {
  const bridge = useSyncExternalStore(subscribeNothing, readBridge, noBridgeOnServer);
  const { maximized, fullscreen } = useWindowState(bridge);
  if (!bridge?.frameless || !bridge.windowControl) return null;

  const restore = maximized || fullscreen;
  const RestoreIcon = restore ? Copy : Square;

  return (
    <div className={cn("desktop-window-controls flex h-full items-stretch", className)}>
      {divider ? <span aria-hidden="true" className="mx-2 h-5 w-px self-center bg-border" /> : null}
      <button type="button" aria-label="Minimize" className={CELL} onClick={() => bridge.windowControl("minimize")}>
        <Minus className="size-4" strokeWidth={1.5} />
      </button>
      <button
        type="button"
        aria-label={restore ? "Restore" : "Maximize"}
        className={CELL}
        onClick={() => bridge.windowControl("toggle-maximize")}
      >
        <RestoreIcon className={cn("size-3.5", restore && "-scale-x-100")} strokeWidth={1.5} />
      </button>
      <button
        type="button"
        aria-label="Close"
        className={cn(CELL, "hover:bg-red-600 hover:text-white focus-visible:bg-red-600 focus-visible:text-white")}
        onClick={() => bridge.windowControl("close")}
      >
        <X className="size-4" strokeWidth={1.5} />
      </button>
    </div>
  );
}
