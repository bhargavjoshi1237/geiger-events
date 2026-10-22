"use client";

import { ShieldCheck } from "lucide-react";

import { Checkbox } from "@geiger/ui/checkbox";

import { cn } from "@/lib/utils";

function paragraphsOf(text) {
  return String(text || "")
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean);
}

// The disclaimer copy plus its tick-box; shared by the gate, Express Lane and the editor preview.
export function PurchaseDisclaimerBody({
  cfg,
  checked,
  onCheckedChange,
  className,
  boxClassName,
  scroll = true,
}) {
  return (
    <div className={cn("space-y-3", className)}>
      <div
        className={cn(
          "space-y-2 rounded-xl border border-border bg-surface-subtle px-4 py-3",
          scroll && "max-h-56 overflow-y-auto",
          boxClassName,
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

// The organiser's terms, inline above the final checkout button; the button stays disabled until they're accepted.
export function PurchaseGateInline({ cfg, checked, onCheckedChange }) {
  if (!cfg) return null;
  return (
    <section className="space-y-2.5">
      <p className="flex items-start gap-2 text-sm font-medium text-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 leading-snug">{cfg.title || "Before you buy"}</span>
      </p>
      <PurchaseDisclaimerBody
        cfg={cfg}
        checked={checked}
        onCheckedChange={onCheckedChange}
        boxClassName="max-h-40"
      />
    </section>
  );
}
