"use client";

import { cn } from "@/lib/utils";

// Shared chrome for the second wave of landing miniatures. Same rules as the
// first batch (showcase_demos.jsx): drawn at the app's own type scale on the
// bare FeatureCard shelf, deterministic values so SSR matches client, and each
// demo is a detail of a feature rather than a whole screen.

// Small pill used for counts, states, and live markers across the demos.
export function Chip({ children, tone = "muted", className }) {
  const tones = {
    muted: "border-white/8 text-white/45",
    live: "border-emerald-500/25 bg-emerald-500/10 text-emerald-400",
    paid: "border-emerald-500/25 bg-emerald-500/10 text-emerald-400",
    partial: "border-amber-500/25 bg-amber-500/10 text-amber-400",
    disputed: "border-red-500/25 bg-red-500/10 text-red-400",
    ok: "border-emerald-500/25 bg-emerald-500/10 text-emerald-400",
  };
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] leading-none",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
