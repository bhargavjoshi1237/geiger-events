"use client";

import { Minus, Plus } from "lucide-react";

import { Button } from "@geiger/ui/button";

export function QtyStepper({ qty, setQty, max, accent }) {
  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        disabled={qty <= 1}
        onClick={() => setQty((q) => Math.max(1, q - 1))}
        aria-label="Decrease quantity"
        className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground disabled:opacity-40"
      >
        <Minus className="h-4 w-4" />
      </Button>
      <span className="w-8 text-center text-base font-semibold tabular-nums text-foreground">
        {qty}
      </span>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        disabled={qty >= max}
        onClick={() => setQty((q) => Math.min(max, q + 1))}
        aria-label="Increase quantity"
        style={
          qty < max
            ? { borderColor: `color-mix(in srgb, ${accent.color} 40%, transparent)` }
            : undefined
        }
        className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground disabled:opacity-40"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
