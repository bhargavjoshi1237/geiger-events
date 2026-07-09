"use client";

import React from "react";
import { Ticket } from "lucide-react";

import { cn } from "@/lib/utils";
import { currency } from "./constants";

// Small pill for the ticket's meta line (quantity, applied type, visibility).
function MetaChip({ children, className }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-surface-subtle px-2 py-0.5 text-[11px] font-medium text-text-secondary",
        className,
      )}
    >
      {children}
    </span>
  );
}

// A read-only event ticket rendered as a torn-ticket stub: a body (name,
// description, meta chips) and a perforated right panel showing the price.
// Clicking anywhere fires `onEdit`; `menu` (a DropdownMenu) sits in the header
// row and stops propagation so it doesn't open the editor.
export function TicketStub({
  name,
  price,
  description,
  qty,
  typeName,
  visibilityLabel,
  onEdit,
  menu,
}) {
  const priceLabel = Number(price) > 0 ? currency(price) : "Free";
  const qtyLabel = Number(qty) > 0 ? `${qty} available` : "Unlimited";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onEdit}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEdit();
        }
      }}
      className="group relative flex cursor-pointer overflow-hidden rounded-xl bg-surface-card text-left transition-colors hover:bg-surface-active"
    >
      {/* Main body */}
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface-subtle text-muted-foreground">
            <Ticket className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-foreground">
              {name || "Untitled ticket"}
            </p>
            {description ? (
              <p className="mt-0.5 truncate text-xs text-text-secondary">
                {description}
              </p>
            ) : null}
          </div>
          {menu ? (
            <div
              onClick={(e) => e.stopPropagation()}
              className="-mr-1 -mt-1 shrink-0"
            >
              {menu}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <MetaChip>{qtyLabel}</MetaChip>
          {typeName ? <MetaChip>{typeName}</MetaChip> : null}
          {visibilityLabel ? (
            <MetaChip>{visibilityLabel}</MetaChip>
          ) : typeName ? null : (
            <MetaChip className="text-text-tertiary">No rules applied</MetaChip>
          )}
        </div>
      </div>

      {/* Perforation with notch cut-outs punched to the canvas colour */}
      <div className="relative w-px shrink-0 self-stretch">
        <div className="absolute inset-y-4 left-0 border-l border-dashed border-border" />
        <span className="absolute -top-1.5 left-0 h-3 w-3 -translate-x-1/2 rounded-full bg-background" />
        <span className="absolute -bottom-1.5 left-0 h-3 w-3 -translate-x-1/2 rounded-full bg-background" />
      </div>

      {/* Price stub */}
      <div className="flex w-24 shrink-0 flex-col items-center justify-center gap-0.5 p-3">
        <span className="text-lg font-semibold tabular-nums text-foreground">
          {priceLabel}
        </span>
        <span className="text-[10px] uppercase tracking-wide text-text-tertiary">
          price
        </span>
      </div>
    </div>
  );
}

export default TicketStub;
