"use client";

import { useState } from "react";
import { Dialog } from "radix-ui";
import { FlipHorizontal2, Loader2, X, ZoomIn, ZoomOut } from "lucide-react";
import { LanyardBadge } from "./lanyard_badge";

const CONTROL = "flex h-11 w-11 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:pointer-events-none disabled:opacity-30";

function ViewerStage({ template, event, attendee, qrSettings, loading, emptyMessage }) {
  const [zoom, setZoom] = useState(1);
  const [flipped, setFlipped] = useState(false);
  const ready = Boolean(template) && !loading;

  return (
    <>
      <div className="absolute inset-x-4 bottom-24 top-16 sm:inset-x-16 sm:top-12">
        {loading ? (
          <div role="status" className="flex h-full items-center justify-center text-white/60">
            <Loader2 className="h-5 w-5 animate-spin" /><span className="sr-only">Loading badge</span>
          </div>
        ) : template ? (
          <LanyardBadge
            template={template}
            event={event}
            attendee={attendee}
            qrSettings={qrSettings}
            height="100%"
            maxWidth="100%"
            zoom={zoom}
            facing={flipped ? "back" : "front"}
            fitToViewport
          />
        ) : (
          <div className="flex h-full items-center justify-center text-center text-sm text-white/60">
            {emptyMessage || "Choose a badge design to preview it here."}
          </div>
        )}
      </div>
      <div role="group" aria-label="Card viewer controls" className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-black/60 p-1.5 shadow-xl backdrop-blur-xl">
        <button type="button" className={CONTROL} aria-label="Zoom out" title="Zoom out" disabled={!ready || zoom <= 1} onClick={() => setZoom((value) => Math.max(1, value - 0.25))}><ZoomOut className="h-5 w-5" /></button>
        <button type="button" className={`${CONTROL} w-14 text-xs tabular-nums`} aria-label="Reset zoom" title="Reset zoom" disabled={!ready} onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
        <button type="button" className={CONTROL} aria-label="Zoom in" title="Zoom in" disabled={!ready || zoom >= 2} onClick={() => setZoom((value) => Math.min(2, value + 0.25))}><ZoomIn className="h-5 w-5" /></button>
        <span aria-hidden className="mx-1 h-5 w-px bg-white/15" />
        <button type="button" className={CONTROL} aria-label={flipped ? "Show front of card" : "Show back of card"} title="Flip card" aria-pressed={flipped} disabled={!ready} onClick={() => setFlipped((value) => !value)}><FlipHorizontal2 className="h-5 w-5" /></button>
      </div>
      <Dialog.Close className={`${CONTROL} absolute right-4 top-4 bg-black/40 sm:right-6 sm:top-6`} aria-label="Close card viewer" title="Close (Esc)"><X className="h-5 w-5" /></Dialog.Close>
    </>
  );
}

export function CardViewer({ open, onOpenChange, trigger, ...props }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md" />
        <Dialog.Content className="fixed inset-0 z-[101] overflow-hidden outline-none">
          <Dialog.Title className="sr-only">Card viewer</Dialog.Title>
          <Dialog.Description className="sr-only">Drag the badge to swing it. Use the controls to zoom or flip the card. Press Escape to close.</Dialog.Description>
          <ViewerStage {...props} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
