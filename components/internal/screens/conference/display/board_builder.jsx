"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Download,
  ExternalLink,
  LayoutList,
  Loader2,
  Network,
  Plus,
  Presentation,
  Trash2,
} from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { EditorHeader } from "@/components/internal/shared/editor_shell";
import { Field, SegmentedTabs } from "@/components/internal/shared/screen_kit";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  cn,
} from "@geiger/ui";
import {
  BOARD_STATUS_MAP,
  SLIDE_CATALOG,
  SPEED_OPTIONS,
  THEME_OPTIONS,
  catalogEntry,
  defaultConfig,
  defaultDuration,
  slideLabel,
  summarizeSlide,
} from "@/lib/display/constants";
import { boardDurationMs, preloadImages, exportBoardVideo, supportsExport } from "@/lib/display/renderer";
import { BoardCanvas } from "./board_canvas";
import { BoardPreview } from "./board_preview";
import { SlideInspector } from "./slide_inspector";

const newSlideId = () => `slide_${crypto.randomUUID()}`;

const SAVE_DEBOUNCE_MS = 700;

// Header view toggle (List <=> Canvas), matching the workflow builder's.
const VIEW_TABS = [
  { value: "canvas", label: "Canvas", icon: Network },
  { value: "list", label: "List", icon: LayoutList },
];

function ViewToggle({ view, onChange }) {
  return <SegmentedTabs tabs={VIEW_TABS} value={view} onChange={onChange} />;
}

// Ordered slide list — the same queue as the canvas, for boards long enough that
// dragging nodes stops being the fastest way to reorder.
function SlideList({ slides, selectedId, onSelect, onMove, onDelete, onAdd }) {
  return (
    <div className="space-y-2">
      {slides.map((slide, i) => {
        const entry = catalogEntry(slide.type);
        const Icon = entry?.icon || Presentation;
        return (
          <div
            key={slide.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(slide.id)}
            onKeyDown={(e) => e.key === "Enter" && onSelect(slide.id)}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-xl border bg-surface-card px-3 py-3 transition-colors",
              selectedId === slide.id
                ? "border-foreground"
                : "border-border hover:border-border-strong",
            )}
          >
            <span className="w-6 shrink-0 text-center text-xs font-semibold tabular-nums text-text-tertiary">
              {i + 1}
            </span>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-subtle text-muted-foreground">
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {slideLabel(slide.type)}
              </p>
              <p className="truncate text-xs text-text-secondary">{summarizeSlide(slide)}</p>
            </div>
            <span className="shrink-0 rounded-md border border-border bg-surface-subtle px-2 py-0.5 text-xs font-medium tabular-nums text-text-secondary">
              {slide.duration ?? entry?.duration ?? 10}s
            </span>
            <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Move earlier"
                disabled={i === 0}
                onClick={() => onMove(i, -1)}
                className="text-text-secondary hover:bg-surface-active hover:text-foreground disabled:opacity-30"
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Move later"
                disabled={i === slides.length - 1}
                onClick={() => onMove(i, 1)}
                className="text-text-secondary hover:bg-surface-active hover:text-foreground disabled:opacity-30"
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Remove slide"
                onClick={() => onDelete(slide)}
                className="text-text-secondary hover:bg-red-500/10 hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      })}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-card py-4 text-sm text-text-secondary transition-colors hover:border-border-strong hover:text-muted-foreground"
          >
            <Plus className="h-4 w-4" /> Add a slide
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56 border-border bg-surface-card shadow-xl">
          {SLIDE_CATALOG.map((entry) => {
            const Icon = entry.icon;
            return (
              <DropdownMenuItem
                key={entry.key}
                onClick={() => onAdd(entry.key)}
                className="cursor-pointer gap-2 text-muted-foreground focus:bg-surface-hover focus:text-foreground"
              >
                <Icon className="h-4 w-4" /> {entry.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// The board editor: preview on the left, queue below it, inspector on the right.
// Every edit lands in local state immediately and is persisted on a debounce —
// the board is one record, so a per-keystroke write would be wasteful.
export function BoardBuilder({ board, event, sessions, onBack, onPersist, onDelete }) {
  const [config, setConfig] = useState(() => board.config || {});
  const [view, setView] = useState("canvas");
  const [selectedId, setSelectedId] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const slides = useMemo(() => config.slides || [], [config.slides]);
  const theme = config.theme || "midnight";
  const speed = Number(config.speed) || 1;
  const published = config.published === true;

  // Debounced persist. A burst of inspector edits collapses into one write, and
  // `configRef` tracks the latest value for callbacks that need to read it
  // without re-binding — every mutation funnels through commit(), so the ref is
  // only ever written from an event handler, never during render.
  //
  // `saveTimer` is nulled the moment a save fires or is cancelled: it doubles as
  // the "a write is still owed" flag the flushes below read, and a stale id
  // there would make every re-render flush again.
  const saveTimer = useRef(null);
  const configRef = useRef(config);
  // The parent rebuilds onPersist every render; holding it in a ref keeps commit()
  // and the flushes stable so they don't re-fire on unrelated re-renders.
  const onPersistRef = useRef(onPersist);
  useEffect(() => {
    onPersistRef.current = onPersist;
  }, [onPersist]);

  const flush = useCallback(() => {
    if (!saveTimer.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = null;
    onPersistRef.current(configRef.current);
  }, []);

  // `immediate` is for discrete actions (publishing) where the user is told the
  // change took effect and may leave the screen before a debounce would fire.
  const commit = useCallback((next, { immediate = false } = {}) => {
    configRef.current = next;
    setConfig(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (immediate) {
      saveTimer.current = null;
      onPersistRef.current(next);
      return;
    }
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      onPersistRef.current(next);
    }, SAVE_DEBOUNCE_MS);
  }, []);

  // Flush a pending save when the builder unmounts, so leaving the screen never
  // drops the last edit.
  useEffect(() => flush, [flush]);

  // Unmount cleanup never runs on a tab close or hard navigation, so flush on
  // the way out too — a debounced edit would otherwise be lost silently.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [flush]);

  const setSlides = useCallback(
    (nextSlides, nextGraph) =>
      commit({
        ...configRef.current,
        slides: nextSlides,
        ...(nextGraph ? { graph: nextGraph } : {}),
      }),
    [commit],
  );

  const selected = slides.find((s) => s.id === selectedId) || null;

  const addSlide = (type) => {
    const slide = {
      id: newSlideId(),
      type,
      duration: defaultDuration(type),
      config: defaultConfig(type),
      position: { x: 0, y: slides.length * 150 },
    };
    setSlides([...slides, slide]);
    setSelectedId(slide.id);
  };

  const updateSlide = (next) =>
    setSlides(slides.map((s) => (s.id === next.id ? next : s)));

  const deleteSlide = (slide) => {
    setSlides(slides.filter((s) => s.id !== slide.id));
    if (selectedId === slide.id) setSelectedId(null);
  };

  const moveSlide = (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= slides.length) return;
    const copy = [...slides];
    [copy[index], copy[target]] = [copy[target], copy[index]];
    // Positions follow the new order so the canvas doesn't read as scrambled.
    setSlides(copy.map((s, i) => ({ ...s, position: { x: 0, y: i * 150 } })));
  };

  const liveUrl =
    typeof window === "undefined" ? "" : `${window.location.origin}/display/${board.id}`;

  const copyLiveUrl = () => {
    if (!published) {
      toast.error("Publish the board first — the link only works once it's live.");
      return;
    }
    navigator.clipboard.writeText(liveUrl);
    toast.success("Live board URL copied.");
  };

  const togglePublished = (value) => {
    commit({ ...configRef.current, published: value }, { immediate: true });
    toast.success(value ? "Board published." : "Board unpublished.");
  };

  const runExport = async () => {
    if (!slides.length) {
      toast.error("Add at least one slide first.");
      return;
    }
    if (!supportsExport()) {
      toast.error("This browser can't record video. Try Chrome or Edge.");
      return;
    }
    setExporting(true);
    setProgress(0);
    try {
      const images = await preloadImages(slides, event);
      const blob = await exportBoardVideo({
        slides,
        event,
        sessions,
        theme,
        speed,
        images,
        onProgress: setProgress,
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${(board.name || "display-board").replace(/[^\w-]+/g, "-").toLowerCase()}.webm`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success("Video downloaded.");
    } catch (e) {
      console.error("[display.export]", e);
      toast.error(e?.message || "Couldn't record the board.");
    } finally {
      setExporting(false);
      setProgress(0);
    }
  };

  const loopSeconds = Math.round(boardDurationMs(slides, speed) / 1000);

  return (
    <MainScreenWrapper>
      <EditorHeader
        back={{ label: "Display Boards", onClick: onBack }}
        title={board.name}
        status={published ? "Published" : "Draft"}
        statusMap={BOARD_STATUS_MAP}
        meta={`${event?.name || "No event"} · ${slides.length} slide${
          slides.length === 1 ? "" : "s"
        } · ${loopSeconds ? `${loopSeconds}s loop` : "empty loop"}`}
        actions={
          <>
            <Button
              variant="outline"
              onClick={copyLiveUrl}
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            >
              <Copy className="h-4 w-4" /> Copy live URL
            </Button>
            <Button
              variant="outline"
              disabled={exporting}
              onClick={runExport}
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {exporting
                ? `Recording ${Math.round(progress * 100)}%`
                : "Download video"}
            </Button>
            {published ? (
              <Button
                variant="outline"
                asChild
                className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              >
                <a href={liveUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" /> Open board
                </a>
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <BoardPreview
            slides={slides}
            event={event}
            sessions={sessions}
            theme={theme}
            speed={speed}
            selectedId={selectedId}
            onSelectSlide={setSelectedId}
          />

          <div className="flex items-center justify-between gap-3">
            <ViewToggle view={view} onChange={setView} />
            <span className="text-xs text-text-tertiary">
              {view === "canvas"
                ? "Drag from the palette to add a slide; connect them to set the order."
                : "Reorder with the arrows; the board plays top to bottom."}
            </span>
          </div>

          {view === "canvas" ? (
            <BoardCanvas
              slides={slides}
              graph={config.graph}
              onChange={({ slides: nextSlides, graph }) => setSlides(nextSlides, graph)}
              onSelect={setSelectedId}
            />
          ) : (
            <SlideList
              slides={slides}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onMove={moveSlide}
              onDelete={deleteSlide}
              onAdd={addSlide}
            />
          )}
        </div>

        <div className="space-y-4">
          <div className="space-y-4 rounded-xl border border-border bg-surface-subtle p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
              Board settings
            </p>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-card px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Published</p>
                <p className="text-xs text-text-secondary">
                  Makes the live URL readable on a screen that isn&apos;t signed in.
                </p>
              </div>
              <Switch checked={published} onCheckedChange={togglePublished} />
            </div>

            <Field label="Theme">
              <Select
                value={theme}
                onValueChange={(v) => commit({ ...configRef.current, theme: v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {THEME_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Rotation speed" hint="Scales every slide's time on screen">
              <Select
                value={String(speed)}
                onValueChange={(v) => commit({ ...configRef.current, speed: Number(v) })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SPEED_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Button
              variant="destructive"
              onClick={() => onDelete(board)}
              className="w-full justify-start"
            >
              <Trash2 className="h-4 w-4" /> Delete This Board
            </Button>
          </div>

          <div className="min-h-[320px]">
            <SlideInspector
              slide={selected}
              sessions={sessions}
              eventId={event?.id}
              onChange={updateSlide}
              onDelete={deleteSlide}
            />
          </div>
        </div>
      </div>
    </MainScreenWrapper>
  );
}

export default BoardBuilder;
