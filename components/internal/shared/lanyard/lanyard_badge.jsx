"use client";

import React from "react";
import dynamic from "next/dynamic";
import { IdCard, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

// The event pass, hanging from its lanyard and draggable. Everything three.js
// lives behind this boundary: the scene is client-only and code-split, so a
// screen that never enables badges pays nothing for it.
//
//   <LanyardBadge template={design} event={event} attendee={attendee} />
//
// `template` is a saved pass design (see lib/passes/render.js). Pass the same
// { event, attendee, qrSettings } context the printer and exporters take and the
// hanging card shows exactly what would come off the printer.

const LanyardScene = dynamic(() => import("./lanyard_scene"), {
  ssr: false,
  loading: () => <Placeholder icon={Loader2} label="Preparing the pass…" spin />,
});

function Placeholder({ icon: Icon, label, spin }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-text-tertiary">
      <Icon className={cn("h-5 w-5", spin && "animate-spin")} />
      <p className="text-xs">{label}</p>
    </div>
  );
}

// WebGL can be missing (a locked-down browser, a software renderer that refuses
// a context). The showcase is decoration, so it says so and stays out of the way
// rather than taking the screen down with it.
//
// Probed once per page and cached, because useSyncExternalStore below reads it
// on every render and must hand back a stable value.
let webglSupport = null;

function supportsWebgl() {
  if (webglSupport === null) {
    try {
      const canvas = document.createElement("canvas");
      webglSupport = Boolean(
        canvas.getContext("webgl2") || canvas.getContext("webgl"),
      );
    } catch {
      webglSupport = false;
    }
  }
  return webglSupport;
}

// Nothing to subscribe to — the answer can't change for the life of the page.
const noSubscribe = () => () => {};
// The server can't probe, and assuming yes keeps its markup identical to the
// dynamic import's own placeholder.
const assumeSupported = () => true;

class SceneBoundary extends React.Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error("[lanyard.scene]", error);
  }

  render() {
    if (this.state.failed) {
      return <Placeholder icon={IdCard} label="The 3D preview couldn't start." />;
    }
    return this.props.children;
  }
}

export function LanyardBadge({
  template,
  event,
  attendee,
  qrSettings,
  className,
  height = 340,
  // The camera's field of view is vertical, so a wide canvas only adds empty
  // space either side of the badge. Capping the width to about the height keeps
  // the framing the same everywhere it is dropped in.
  maxWidth = 420,
}) {
  // The probe needs a real canvas, so the server gets the optimistic answer and
  // React re-renders with the real one after hydration.
  const webgl = React.useSyncExternalStore(
    noSubscribe,
    supportsWebgl,
    assumeSupported,
  );

  return (
    <div
      className={cn("relative mx-auto w-full touch-none select-none", className)}
      style={{ height, maxWidth }}
    >
      {!template ? (
        <Placeholder icon={IdCard} label="No pass design yet." />
      ) : !webgl ? (
        <Placeholder icon={IdCard} label="This browser can't show the 3D preview." />
      ) : (
        <SceneBoundary>
          <LanyardScene
            template={template}
            event={event}
            attendee={attendee}
            qrSettings={qrSettings}
          />
        </SceneBoundary>
      )}
    </div>
  );
}

export default LanyardBadge;
