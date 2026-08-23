"use client";

// The web-clip picker — the module's entry point.
//
// Any feature that wants to pull a component off a live website mounts this and
// receives a finished clip object. It owns the whole flow (address → pick →
// review) and knows nothing about who called it, which is what makes it
// reusable across schedule items, page blocks, and conference records.
//
//   <WebClipDialog open={open} onOpenChange={setOpen} onClip={(clip) => …} />
//
// Nothing is uploaded: a clip references the origin site's images directly, so
// capture is instant and costs no storage. See lib/clip/assets.js.

import React, { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  Globe,
  Loader2,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { extractClip } from "@/lib/clip/extract";
import { removeClipAssets } from "@/lib/clip/assets";
import { clipHostLabel, removedSummary } from "@/lib/clip/model";
import { CLIP_PAGE_PATH } from "@/lib/clip/rewrite";
import { normalizeUrl } from "@/lib/net/url_safety";
import { ElementPicker } from "./element_picker";
import { ClipAppearance } from "./clip_appearance";
import { ClipPruner } from "./clip_pruner";

const LOAD_HINTS = {
  blocked: {
    tone: "error",
    text: "That page couldn't be loaded for picking. It may have refused our request.",
  },
  empty: {
    tone: "warn",
    text: "This page looks empty — it probably builds itself with JavaScript, which the picker doesn't run. Try a page that renders its content in the HTML.",
  },
};

export function WebClipDialog({ open, onOpenChange, onClip }) {
  const [step, setStep] = useState("url");
  const [url, setUrl] = useState("");
  const [frameSrc, setFrameSrc] = useState("");
  const [loadState, setLoadState] = useState(null);
  const [busy, setBusy] = useState("");
  const [clip, setClip] = useState(null);
  const pickedRef = useRef(null);
  // Once the caller has the clip, its assets are theirs — the schedule screen
  // cleans them up on save instead.
  const handedOff = useRef(false);

  const reset = () => {
    setStep("url");
    setUrl("");
    setFrameSrc("");
    setLoadState(null);
    setBusy("");
    setClip(null);
    // pickedRef is not cleared here — a render-phase reset must not touch refs.
    // ElementPicker reports null on mount and whenever its src changes, which
    // covers every path back to an empty selection.
  };

  // Re-seed on open (render-phase reset, matching the rest of the app's
  // dialogs).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) reset();
  }

  const load = () => {
    const target = normalizeUrl(url);
    if (!target) {
      toast.error("Enter a public web address, like stripe.com/pricing.");
      return;
    }
    pickedRef.current = null;
    handedOff.current = false;
    setUrl(target.toString());
    setLoadState(null);
    setFrameSrc(`${CLIP_PAGE_PATH}?url=${encodeURIComponent(target.toString())}`);
    setStep("pick");
  };

  const onPick = useCallback((el) => {
    pickedRef.current = el;
  }, []);

  const onLoadState = useCallback((state) => setLoadState(state), []);

  const capture = async () => {
    const el = pickedRef.current;
    if (!el) {
      toast.error("Click an element on the page first.");
      return;
    }

    setBusy("Extracting…");
    // Yield a frame so the button's spinner paints before the synchronous
    // stylesheet walk blocks the thread.
    await new Promise((r) => setTimeout(r, 0));

    let extracted;
    try {
      extracted = extractClip(el, { url, title: loadState?.title || "" });
    } catch (err) {
      console.error("[clip.extract]", err);
      extracted = null;
    }

    if (!extracted) {
      setBusy("");
      toast.error("Couldn't extract that element. Try selecting its parent.");
      return;
    }

    setBusy("");
    setClip(extracted);
    setStep("review");
  };

  const confirm = () => {
    if (!clip) return;
    // `assets` and `oversize` are capture-time bookkeeping — they don't belong
    // in the stored record.
    const { assets, oversize, unresolvedAssets, ...stored } = clip;
    handedOff.current = true;
    onClip?.(stored);
    onOpenChange(false);
  };

  // A no-op for clips captured now, which upload nothing. It still runs because
  // a re-clip can be replacing a clip made while rehosting was the default, and
  // abandoning that one should not strand its files in the bucket. Only ever
  // for a clip the caller never received — after that they own it.
  const discardUnused = () => {
    if (clip && !handedOff.current) removeClipAssets(clip);
  };

  const close = () => {
    discardUnused();
    onOpenChange(false);
  };

  const hint = loadState ? LOAD_HINTS[loadState.status] : null;
  const removed = clip ? removedSummary(clip) : "";

  return (
    // Esc and the overlay route through close() too, so an abandoned capture
    // is cleaned up however the dialog is dismissed.
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent
        className="flex h-[88vh] max-h-[88vh] w-[96vw] max-w-6xl flex-col gap-0 overflow-hidden bg-background p-0"
        showCloseButton={false}
      >
        <DialogHeader className="shrink-0 space-y-0 border-b border-border px-4 py-3">
          <DialogTitle className="text-base">Clip from a website</DialogTitle>
          <DialogDescription className="sr-only">
            Load a public page, select an element, and import it.
          </DialogDescription>

          <div className="mt-3 flex items-center gap-2">
            {step !== "url" ? (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  if (step !== "review") return reset();
                  discardUnused();
                  setClip(null);
                  setStep("pick");
                }}
                aria-label="Back"
                className="shrink-0 text-text-secondary hover:bg-surface-active hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            ) : null}

            <div className="relative flex-1">
              <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && load()}
                placeholder="stripe.com/pricing"
                spellCheck={false}
                autoFocus={step === "url"}
                className="pl-9"
              />
            </div>

            <Button
              onClick={load}
              disabled={!url.trim()}
              className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {step === "pick" ? (
                <RefreshCw className="h-4 w-4" />
              ) : null}
              {step === "url" ? "Load page" : "Reload"}
            </Button>

            <Button
              variant="outline"
              onClick={close}
              className="shrink-0 border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            >
              Cancel
            </Button>
          </div>
        </DialogHeader>

        {step === "url" ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
            <Globe className="h-8 w-8 text-text-tertiary" />
            <p className="text-sm text-muted-foreground">
              Paste the address of any public page. You&apos;ll be able to hover
              its parts, pick the one you want, and bring it across.
            </p>
            <p className="flex items-center gap-1.5 text-xs text-text-tertiary">
              <ShieldCheck className="h-3.5 w-3.5" />
              Scripts, forms, and embedded frames are always removed.
            </p>
          </div>
        ) : null}

        {step === "pick" ? (
          <>
            {hint ? (
              <div
                className={cn(
                  "flex shrink-0 items-start gap-2 border-b px-4 py-2 text-xs",
                  hint.tone === "error"
                    ? "border-red-500/20 bg-red-500/10 text-red-300"
                    : "border-amber-500/20 bg-amber-500/10 text-amber-300",
                )}
              >
                <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" />
                {hint.text}
              </div>
            ) : null}

            <ElementPicker
              src={frameSrc}
              onPick={onPick}
              onLoadState={onLoadState}
            />

            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-4 py-3">
              <p className="text-xs text-text-tertiary">
                Nothing on the page can run — you&apos;re picking from a static
                copy.
              </p>
              <Button
                onClick={capture}
                disabled={!!busy}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                {busy || "Use this element"}
              </Button>
            </div>
          </>
        ) : null}

        {step === "review" && clip ? (
          <>
            <div className="min-h-0 flex-1 overflow-auto bg-surface-subtle p-6">
              <div className="mx-auto max-w-3xl space-y-2">
                <ClipPruner
                  clip={clip}
                  onChange={(next) => setClip((c) => ({ ...c, ...next }))}
                />
              </div>
            </div>

            <div className="shrink-0 space-y-2 border-t border-border px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary">
                <span className="font-mono">{clip.source.selector}</span>
                <span className="text-text-tertiary">
                  {Math.round((clip.html.length + clip.css.length) / 1024)} KB
                </span>
                {removed ? (
                  <span className="flex items-center gap-1 text-text-tertiary">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Removed {removed}
                  </span>
                ) : null}
                <span className="text-text-tertiary">
                  Images load from {clipHostLabel(clip) || "the original site"}
                </span>
              </div>

              <ClipAppearance
                compact
                clip={clip}
                onChange={(next) => setClip(next)}
              />

              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-text-tertiary">
                  This is exactly how it will appear on your page.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      discardUnused();
                      setClip(null);
                      setStep("pick");
                    }}
                    className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                  >
                    Pick something else
                  </Button>
                  <Button
                    onClick={confirm}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Check className="h-4 w-4" /> Use this clip
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export default WebClipDialog;
