"use client";

import React from "react";
import { Percent, Tag } from "lucide-react";

import { Checkbox } from "@geiger/ui/checkbox";
import { cn } from "@/lib/utils";
import { couponSummary, normalizeCoupon } from "@/lib/events/discount_rules";

// "Which codes work on this ticket" — the control that replaces event-wide
// discount attachment. A coupon redeems only against tickets that list it here,
// so one ticket can accept several codes and a sibling ticket can accept none.
//
// Rendered as an inline scrolling checklist rather than a popover: it sits
// inside the ticket dialog, and seeing every code at once is the point.
export function DiscountCodePicker({ coupons, value, onChange, className }) {
  const selected = Array.isArray(value) ? value.map(String) : [];

  const toggle = (id, on) => {
    const next = on
      ? [...selected, id]
      : selected.filter((x) => x !== id);
    onChange(next);
  };

  if (!coupons.length) {
    return (
      <div
        className={cn(
          "flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-border bg-surface-subtle px-4 py-6 text-center",
          className,
        )}
      >
        <Tag className="h-5 w-5 text-text-tertiary" />
        <p className="text-sm text-text-secondary">No coupon codes yet</p>
        <p className="text-xs text-text-tertiary">
          Create them under Tickets → Discounts &amp; Codes, then pick them here.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface-card",
        className,
      )}
    >
      <div className="max-h-52 divide-y divide-border overflow-y-auto">
        {coupons.map((c) => {
          const id = String(c.id);
          const on = selected.includes(id);
          return (
            <label
              key={id}
              className={cn(
                "flex cursor-pointer items-start gap-3 px-3 py-2.5 transition-colors",
                on ? "bg-surface-hover" : "hover:bg-surface-active",
              )}
            >
              <Checkbox
                checked={on}
                onCheckedChange={(v) => toggle(id, !!v)}
                className="mt-0.5"
                aria-label={`Allow ${c.config?.code || c.name} on this ticket`}
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground">
                    {c.name || "Untitled"}
                  </span>
                  {c.active === false ? (
                    <span className="shrink-0 rounded bg-surface-active px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text-tertiary">
                      Off
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 block truncate text-xs text-text-secondary">
                  {couponSummary(c.config)}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2 bg-surface-subtle px-3 py-2">
        <span className="text-xs text-text-secondary">
          {selected.length
            ? `${selected.length} code${selected.length > 1 ? "s" : ""} will work on this ticket`
            : "No codes — buyers can't discount this ticket"}
        </span>
        {selected.length ? (
          <button
            type="button"
            onClick={() => onChange([])}
            className="shrink-0 text-xs font-medium text-text-secondary underline-offset-2 hover:text-foreground hover:underline"
          >
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}

// Compact read-only chips for a ticket stub, e.g. "SAVE10 · VIP25".
export function DiscountCodeChips({ coupons, value, className }) {
  const ids = (Array.isArray(value) ? value : []).map(String);
  if (!ids.length) return null;

  const byId = new Map(coupons.map((c) => [String(c.id), c]));
  const codes = ids.map((id) => {
    const c = byId.get(id);
    if (!c) return null;
    const cfg = normalizeCoupon(c.config);
    return {
      id,
      label: cfg.code || c.name || "code",
      off: c.active === false,
    };
  });

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      <Percent className="h-3 w-3 shrink-0" aria-hidden />
      {codes.map((c) => (
        <span
          key={c.id}
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            c.off
              ? "bg-surface-active text-text-tertiary line-through"
              : "bg-surface-hover text-foreground",
          )}
        >
          {c.label}
        </span>
      ))}
    </span>
  );
}

export default DiscountCodePicker;
