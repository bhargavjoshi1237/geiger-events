"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Box, Info, Loader2, Maximize, Minimize, Orbit, RotateCcw, Sparkles } from "lucide-react";

import { Button, LogoLoading, cn } from "@geiger/ui";
import { slideLabel } from "@/lib/display/constants";
import { DEFAULT_PLACEMENT, PLACEMENTS, placementEntry } from "@/lib/display/placements";

// The board simulated on real venue hardware: pick a screen type, orbit the
// room, fly between viewpoints. Everything three.js sits behind next/dynamic.

const VenueScene = dynamic(() => import("./venue_scene"), {
  ssr: false,
  loading: () => <Placeholder icon={Loader2} label="Building the venue" spin />,
});

// Doubles as the loading state and the no-WebGL notice. While loading (`spin`)
// the animated mark carries the message on its own; the notice path keeps its
// icon and copy, since that one has something to say.
function Placeholder({ icon: Icon, label, spin }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-white/50">
      {spin ? (
        <LogoLoading size={40} label={label} />
      ) : (
        <>
          <Icon className="h-5 w-5" />
          <p className="text-xs">{label}</p>
        </>
      )}
    </div>
  );
}

// Probed once per page; the server assumes yes so markup matches the loader.
let webglSupport = null;
function supportsWebgl() {
  if (webglSupport === null) {
    try {
      webglSupport = Boolean(document.createElement("canvas").getContext("webgl2"));
    } catch {
      webglSupport = false;
    }
  }
  return webglSupport;
}
const noSubscribe = () => () => {};
const assumeSupported = () => true;

class SceneBoundary extends React.Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error("[venue.scene]", error);
  }

  render() {
    if (this.state.failed) return <Placeholder icon={Box} label="The venue preview couldn't start." />;
    return this.props.children;
  }
}

function HudButton({ label, active, onClick, children }) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "text-white/70 hover:bg-white/10 hover:text-white",
        active && "bg-white/15 text-white",
      )}
    >
      {children}
    </Button>
  );
}

const hud = "rounded-lg border border-white/10 bg-black/55 backdrop-blur";

export function VenuePreview({ slides, event, sessions, theme, speed, defaultPlacement = DEFAULT_PLACEMENT }) {
  const webgl = React.useSyncExternalStore(noSubscribe, supportsWebgl, assumeSupported);
  const frame = useRef(null);
  const [placement, setPlacement] = useState(defaultPlacement);
  const [presetKey, setPresetKey] = useState(null);
  const [nonce, setNonce] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);
  const [showLights, setShowLights] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [index, setIndex] = useState(0);

  const entry = placementEntry(placement);
  const preset = entry.presets.find((p) => p.key === presetKey) || entry.presets[0];
  const Icon = entry.icon;
  const current = slides[index] || null;

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === frame.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else frame.current?.requestFullscreen?.().catch(() => {});
  }, []);

  const choosePlacement = (key) => {
    setPlacement(key);
    setPresetKey(null);
  };

  const choosePreset = (key) => {
    setPresetKey(key);
    setNonce((n) => n + 1);
  };

  return (
    <div className="space-y-3">
      <div
        ref={frame}
        className={cn(
          "relative aspect-video w-full touch-none select-none overflow-hidden border border-border bg-black",
          fullscreen ? "rounded-none" : "rounded-xl",
        )}
      >
        {!webgl ? (
          <Placeholder icon={Box} label="This browser can't show the 3D venue preview." />
        ) : (
          <SceneBoundary>
            <VenueScene
              slides={slides}
              event={event}
              sessions={sessions}
              theme={theme}
              speed={speed}
              placement={placement}
              preset={preset}
              nonce={nonce}
              autoRotate={autoRotate}
              showLights={showLights}
              onSlideChange={setIndex}
            />
          </SceneBoundary>
        )}

        <div className="pointer-events-none absolute left-3 top-3 max-w-[65%] space-y-1.5">
          <div className={cn(hud, "inline-flex items-center gap-2 px-2.5 py-1.5")}>
            <Icon className="h-4 w-4 text-white/80" />
            <span className="text-sm font-medium text-white">{entry.label}</span>
          </div>
          <div className="hidden flex-wrap gap-1 sm:flex">
            {entry.specs.map((spec) => (
              <span key={spec} className="rounded-md border border-white/10 bg-black/50 px-1.5 py-0.5 text-[11px] text-white/70">
                {spec}
              </span>
            ))}
          </div>
        </div>

        <div className={cn(hud, "absolute right-3 top-3 flex items-center gap-0.5 p-1")}>
          <HudButton label="Auto pan" active={autoRotate} onClick={() => setAutoRotate((v) => !v)}>
            <Orbit className="h-4 w-4" />
          </HudButton>
          <HudButton label="Show lighting" active={showLights} onClick={() => setShowLights((v) => !v)}>
            <Sparkles className="h-4 w-4" />
          </HudButton>
          <HudButton label="Reset view" onClick={() => choosePreset(preset.key)}>
            <RotateCcw className="h-4 w-4" />
          </HudButton>
          <HudButton label={fullscreen ? "Exit fullscreen" : "Fullscreen"} onClick={toggleFullscreen}>
            {fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </HudButton>
        </div>

        <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-end justify-between gap-2">
          <div className={cn(hud, "pointer-events-auto flex gap-0.5 p-1")}>
            {entry.presets.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => choosePreset(p.key)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  p.key === preset.key ? "bg-white/15 text-white" : "text-white/65 hover:bg-white/10 hover:text-white",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          {current ? (
            <span className={cn(hud, "hidden px-2 py-1 text-[11px] text-white/70 sm:inline")}>
              Now showing · {slideLabel(current.type)}
            </span>
          ) : null}
        </div>
      </div>

      <p className="flex items-start gap-2 text-xs text-text-secondary">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-tertiary" />
        <span>
          {entry.tip} <span className="text-text-tertiary">Drag to orbit · scroll to zoom · right-drag to pan.</span>
        </span>
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PLACEMENTS.map((p) => {
          const PIcon = p.icon;
          const selected = p.key === placement;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => choosePlacement(p.key)}
              aria-pressed={selected}
              className={cn(
                "flex items-start gap-3 rounded-xl border bg-surface-card p-3 text-left transition-colors",
                selected ? "border-foreground" : "border-border hover:border-border-strong",
              )}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-subtle text-muted-foreground">
                <PIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{p.short}</p>
                <p className="line-clamp-2 text-xs text-text-secondary">{p.desc}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default VenuePreview;
