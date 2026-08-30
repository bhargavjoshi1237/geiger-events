"use client";

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

import { Button } from "@geiger/ui/button";
import { IconInput } from "@/components/internal/shared/icon_input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { cn } from "@/lib/utils";
import { extractClip } from "@/lib/clip/extract";
import { removeClipAssets } from "@/lib/clip/assets";
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
  const handedOff = useRef(false);

  const reset = () => {
    setStep("url");
    setUrl("");
    setFrameSrc("");
    setLoadState(null);
    setBusy("");
    setClip(null);
  };

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
    const { assets, oversize, unresolvedAssets, ...stored } = clip;
    handedOff.current = true;
    onClip?.(stored);
    onOpenChange(false);
  };

  const discardUnused = () => {
    if (clip && !handedOff.current) removeClipAssets(clip);
  };

  const close = () => {
    discardUnused();
    onOpenChange(false);
  };

  const hint = loadState ? LOAD_HINTS[loadState.status] : null;

  return (
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
                className="shrink-0 text-muted-foreground hover:bg-surface-active hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            ) : null}

            <IconInput
              icon={Globe}
              wrapperClassName="flex-1"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              placeholder="stripe.com/pricing"
              spellCheck={false}
              autoFocus={step === "url"}
            />

            <Button
              onClick={load}
              disabled={!url.trim()}
              size={step === "url" ? "default" : "icon"}
              title={step === "url" ? "Load page" : "Reload page"}
              aria-label={step === "url" ? "Load page" : "Reload page"}
              className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {step === "url" ? "Load" : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        </DialogHeader>

        {step === "url" ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
            <Globe className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Paste the address of any public page. You&apos;ll be able to hover
              its parts, pick the one you want, and bring it across.
            </p>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
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
              <p className="text-xs text-muted-foreground">
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
                {busy || "Use This Element"}
              </Button>
            </div>
          </>
        ) : null}

        {step === "review" && clip ? (
          <>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
              <aside className="flex max-h-[45%] shrink-0 flex-col overflow-y-auto border-b border-border px-4 py-4 lg:max-h-none lg:w-[19rem] lg:border-b-0 lg:border-r">
                <ClipAppearance
                  compact
                  clip={clip}
                  onChange={(next) => setClip(next)}
                />
              </aside>

              <div className="min-h-0 flex-1 overflow-auto bg-surface-subtle p-6">
                <div className="mx-auto max-w-3xl">
                  <ClipPruner
                    clip={clip}
                    onChange={(next) => setClip((c) => ({ ...c, ...next }))}
                  />
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-4 py-3">
              <p className="text-xs text-muted-foreground">
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
                  Pick Something Else
                </Button>
                <Button
                  onClick={confirm}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Check className="h-4 w-4" /> Use This Clip
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export default WebClipDialog;
