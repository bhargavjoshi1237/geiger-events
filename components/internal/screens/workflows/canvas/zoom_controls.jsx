"use client";

import React from "react";
import { Panel, useReactFlow } from "@xyflow/react";
import { Maximize, Minus, Plus } from "lucide-react";

// Floating zoom controls for the workflow canvas, mirroring the Geiger Notes
// board controls. Uses semantic tokens; sits bottom-left inside the canvas.
export function ZoomControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  return (
    <Panel position="bottom-left">
      <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface-card/80 shadow-xl backdrop-blur-md">
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => zoomIn({ duration: 300 })}
          className="p-2 text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => zoomOut({ duration: 300 })}
          className="border-t border-border p-2 text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Fit view"
          onClick={() => fitView({ duration: 300, padding: 0.2 })}
          className="border-t border-border p-2 text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
        >
          <Maximize className="h-4 w-4" />
        </button>
      </div>
    </Panel>
  );
}

export default ZoomControls;
