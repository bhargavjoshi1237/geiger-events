"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";

import { Button } from "@geiger/ui/button";
import { cn } from "@/lib/utils";
import {
  BOARD_H,
  BOARD_W,
  catalogEntry,
  slideLabel,
} from "@/lib/display/constants";
import { BoardPlayer, preloadImages } from "@/lib/display/renderer";

// Live 16:9 preview of a board, driven by the same BoardPlayer the wall runs.
// Playing shows the real rotation; paused parks on one slide so you can dial in
// its config and see the result immediately.
export function BoardPreview({
  slides,
  event,
  sessions,
  theme,
  speed,
  selectedId,
  onSelectSlide,
  className,
}) {
  const canvasRef = useRef(null);
  const playerRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [index, setIndex] = useState(0);
  const [images, setImages] = useState(() => new Map());

  // Decode board imagery whenever the set of image URLs changes.
  const imageKey = JSON.stringify([
    event?.coverUrl || "",
    ...slides.filter((s) => s.type === "image").map((s) => s.config?.url || ""),
  ]);
  useEffect(() => {
    let alive = true;
    preloadImages(slides, event).then((map) => alive && setImages(map));
    return () => {
      alive = false;
    };
  }, [imageKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build the player once against the canvas; data changes are pushed in through
  // update() so playback never restarts mid-edit.
  useEffect(() => {
    if (!canvasRef.current) return undefined;
    const player = new BoardPlayer(canvasRef.current, {
      slides,
      event,
      sessions,
      theme,
      speed,
      images,
      onSlideChange: setIndex,
      // Playback lives in the player; React mirrors it from this callback rather
      // than tracking it in parallel.
      onRunningChange: setPlaying,
    });
    playerRef.current = player;
    player.seek(0);
    return () => {
      player.stop();
      playerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    player.update({ slides, event, sessions, theme, speed, images });
    // A paused preview must repaint to show the edit that just landed.
    if (!player.running) player.frame(performance.now());
  }, [slides, event, sessions, theme, speed, images]);

  // Selecting a node on the canvas parks the preview on that slide, so the
  // inspector edits what you're looking at.
  useEffect(() => {
    if (!selectedId) return;
    const target = slides.findIndex((s) => s.id === selectedId);
    if (target < 0 || target === index) return;
    playerRef.current?.stop();
    playerRef.current?.seek(target);
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    if (player.running) player.stop();
    else player.start();
  }, []);

  const step = useCallback(
    (delta) => {
      const player = playerRef.current;
      if (!player || !slides.length) return;
      player.stop();
      const next = (index + delta + slides.length) % slides.length;
      player.seek(next);
      onSelectSlide?.(slides[next]?.id || null);
    },
    [index, slides, onSelectSlide],
  );

  const current = slides[index] || null;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="overflow-hidden rounded-xl border border-border bg-background">
        <canvas
          ref={canvasRef}
          width={BOARD_W}
          height={BOARD_H}
          className="block aspect-video w-full"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={toggle}
          disabled={!slides.length}
          className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {playing ? "Pause" : "Play"}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Previous slide"
          onClick={() => step(-1)}
          disabled={slides.length < 2}
          className="text-text-secondary hover:bg-surface-active hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Next slide"
          onClick={() => step(1)}
          disabled={slides.length < 2}
          className="text-text-secondary hover:bg-surface-active hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="text-xs text-text-tertiary">
          {slides.length
            ? `${index + 1} of ${slides.length} · ${slideLabel(current?.type)} · ${
                current?.duration ?? catalogEntry(current?.type)?.duration ?? 10
              }s`
            : "No slides yet"}
        </span>
      </div>
    </div>
  );
}

export default BoardPreview;
