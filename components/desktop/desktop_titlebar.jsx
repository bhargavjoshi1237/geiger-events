"use client";

import React, { useSyncExternalStore } from "react";

import { getDesktopBridge } from "@/lib/desktop/bridge";
import { cn } from "@/lib/utils";
import { WindowControls } from "./window_controls";

const subscribeNothing = () => () => {};
const isFrameless = () => Boolean(getDesktopBridge()?.frameless);
const noBridgeOnServer = () => false;

// Edges are 6px, corners 12px; corners sit on top so a diagonal grab wins over the edges beside it.
const RESIZE_HANDLES = [
  { edge: "n", className: "inset-x-3 top-0 h-1.5 cursor-ns-resize" },
  { edge: "s", className: "inset-x-3 bottom-0 h-1.5 cursor-ns-resize" },
  { edge: "w", className: "inset-y-3 left-0 w-1.5 cursor-ew-resize" },
  { edge: "e", className: "inset-y-3 right-0 w-1.5 cursor-ew-resize" },
  { edge: "nw", className: "left-0 top-0 size-3 cursor-nwse-resize" },
  { edge: "se", className: "bottom-0 right-0 size-3 cursor-nwse-resize" },
  { edge: "ne", className: "right-0 top-0 size-3 cursor-nesw-resize" },
  { edge: "sw", className: "bottom-0 left-0 size-3 cursor-nesw-resize" },
];

function useIsFrameless() {
  return useSyncExternalStore(subscribeNothing, isFrameless, noBridgeOnServer);
}

// In the desktop app this header doubles as the window's title bar: it drags the window and carries our window controls.
export function DesktopTitlebar({ className, children }) {
  const frameless = useIsFrameless();
  return (
    <div className={cn("desktop-titlebar relative", className)}>
      {children}
      {/* Stops a pixel short so the header's bottom border runs under the controls too; z-30 because the suite Topbar's header is z-20. */}
      {frameless ? <WindowControls divider className="absolute right-0 top-0 bottom-px z-30" /> : null}
    </div>
  );
}

// The transparent window has no OS resize border, so these invisible strips hand the drag to the shell.
function ResizeHandles() {
  const start = (edge) => (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    getDesktopBridge()?.startResize?.(edge);
  };
  const end = () => getDesktopBridge()?.endResize?.();

  return (
    <div aria-hidden="true" className="desktop-resize-handles">
      {RESIZE_HANDLES.map(({ edge, className }) => (
        <div
          key={edge}
          className={cn("fixed z-[2147483647]", className)}
          onPointerDown={start(edge)}
          onPointerUp={end}
          onLostPointerCapture={end}
        />
      ))}
    </div>
  );
}

// Window chrome for the frameless main window: resize handles everywhere, plus controls and a grab strip on header-less pages.
export function DesktopWindowChrome() {
  const frameless = useIsFrameless();
  if (!frameless) return null;
  return (
    <>
      <div className="desktop-floating-chrome pointer-events-none fixed inset-x-0 top-0 z-[2147483646] flex h-14 justify-end">
        <WindowControls className="pointer-events-auto" />
      </div>
      <ResizeHandles />
    </>
  );
}
