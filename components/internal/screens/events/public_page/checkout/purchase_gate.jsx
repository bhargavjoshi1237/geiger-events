"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";

import { Button } from "@geiger/ui/button";
import { Checkbox } from "@geiger/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";

import { cn } from "@/lib/utils";

function paragraphsOf(text) {
  return String(text || "")
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean);
}

// The disclaimer copy plus its tick-box; shared by the gate, Express Lane and the editor preview.
export function PurchaseDisclaimerBody({ cfg, checked, onCheckedChange, className, scroll = true }) {
  return (
    <div className={cn("space-y-3", className)}>
      <div
        className={cn(
          "space-y-2 rounded-xl border border-border bg-surface-subtle px-4 py-3",
          scroll && "max-h-56 overflow-y-auto",
        )}
      >
        {paragraphsOf(cfg.text).map((p, i) => (
          <p key={i} className="text-xs leading-relaxed text-text-secondary">
            {p}
          </p>
        ))}
      </div>
      {cfg.requireCheck ? (
        <label className="flex cursor-pointer items-start gap-2.5 text-sm text-foreground">
          <Checkbox
            checked={!!checked}
            onCheckedChange={(v) => onCheckedChange?.(v === true)}
            className="mt-0.5"
          />
          <span className="leading-snug">{cfg.checkLabel || "I agree"}</span>
        </label>
      ) : null}
    </div>
  );
}

// Final acknowledgement shown over checkout when the buyer hits the last button.
export function PurchaseGate({ open, cfg, accentStyle, onCancel, onAccept }) {
  const [checked, setChecked] = useState(false);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setChecked(false);
  }

  if (!cfg) return null;
  const ready = !cfg.requireCheck || checked;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-muted-foreground">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <DialogTitle>{cfg.title || "Before you buy"}</DialogTitle>
          </div>
          <DialogDescription className="sr-only">
            Read and accept the organiser&apos;s terms to continue.
          </DialogDescription>
        </DialogHeader>

        <PurchaseDisclaimerBody cfg={cfg} checked={checked} onCheckedChange={setChecked} />

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={onCancel}
          >
            Go back
          </Button>
          <Button
            style={ready ? accentStyle : undefined}
            disabled={!ready}
            className="hover:opacity-90 disabled:opacity-50"
            onClick={onAccept}
          >
            {cfg.confirmLabel || "Agree & continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
