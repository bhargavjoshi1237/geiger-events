"use client";

import { Check, Heart, Loader2, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function OfferingsPicker({ offerings, isChosen, selectSingle, toggleMultiple, accent }) {
  if (!offerings.length) return null;

  return (
    <div className="space-y-4 ">
      {offerings.map((o) => (
        <div key={o.id} className="space-y-2">
          <div>
            <p className="text-sm font-medium text-foreground w-full flex items-center">
              {o.name}
              {o.required ? <span className="ml-1 text-red-400">*</span> : null}
              <span className="ml-auto text-xs font-normal text-text-tertiary">
                {o.selectionType === "multiple"
                  ? "Choose any"
                  : o.required
                    ? ""
                    : "Optional"}
              </span>
            </p>
            {o.description ? (
              <p className="text-xs text-text-secondary mt-1 mb-1">
                {o.description}
              </p>
            ) : null}
          </div>
          <div className="space-y-2 mt-1 pt-2 pb-2">
            {o.options.map((opt) => {
              const selected = isChosen(o, opt.id);
              const free = !(Number(opt.price) > 0);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() =>
                    o.selectionType === "single"
                      ? selectSingle(o, opt.id)
                      : toggleMultiple(o.id, opt.id)
                  }
                  style={selected ? { borderColor: accent.color } : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                    selected
                      ? "bg-surface-card"
                      : "border-border bg-transparent hover:bg-surface-card",
                  )}
                >
                  <span
                    style={
                      selected
                        ? { backgroundColor: accent.color, borderColor: accent.color }
                        : undefined
                    }
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center border",
                      o.selectionType === "single" ? "rounded-full" : "rounded",
                      selected ? "" : "border-border-strong",
                    )}
                  >
                    {selected ? (
                      <Check className="h-3 w-3" style={{ color: accent.text }} />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1 text-sm text-foreground">
                    {opt.label}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-sm font-medium tabular-nums",
                      free ? "text-text-secondary" : "text-foreground",
                    )}
                  >
                    {free ? "Free" : `+$${Number(opt.price)}`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function GroupAttendees({ qty, gCfg, attendees, setAttendee }) {
  return (
    <div className="space-y-3 border-t border-border pt-4">
      <div>
        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Users className="h-4 w-4 text-muted-foreground" />
          Who are these {qty} tickets for?
        </p>
        <p className="mt-0.5 text-xs text-text-secondary">
          Each attendee gets their own ticket emailed to them.
          {gCfg.discountPercent > 0 ? ` Group discount: ${gCfg.discountPercent}% off.` : ""}
        </p>
      </div>
      {Array.from({ length: qty }).map((_, i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-2">
          <Input
            placeholder={`Attendee ${i + 1} name`}
            value={attendees[i]?.name || ""}
            onChange={(e) => setAttendee(i, "name", e.target.value)}
          />
          <Input
            type="email"
            placeholder={`Attendee ${i + 1} email`}
            value={attendees[i]?.email || ""}
            onChange={(e) => setAttendee(i, "email", e.target.value)}
          />
        </div>
      ))}
    </div>
  );
}

export function DonationField({
  donCfg,
  donationAmount,
  setDonationAmount,
  donationCustom,
  setDonationCustom,
  accent,
}) {
  return (
    <div className="space-y-2 border-t border-border pt-4">
      <p className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Heart className="h-4 w-4 text-muted-foreground" />
        {donCfg.prompt || (donCfg.cause ? `Support ${donCfg.cause}` : "Add a donation")}
        {donCfg.required ? <span className="text-red-400">*</span> : null}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {donCfg.suggestedAmounts.map((amt) => {
          const active = !donationCustom && donationAmount === amt;
          return (
            <button
              key={amt}
              type="button"
              onClick={() => {
                setDonationCustom("");
                setDonationAmount(active ? 0 : amt);
              }}
              style={active ? { borderColor: accent.color } : undefined}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-medium tabular-nums transition-colors",
                active
                  ? "bg-surface-card text-foreground"
                  : "border-border bg-transparent text-muted-foreground hover:bg-surface-card",
              )}
            >
              ${amt}
            </button>
          );
        })}
        {donCfg.allowCustom ? (
          <div className="flex items-center gap-1">
            <span className="text-sm text-text-secondary">$</span>
            <Input
              type="number"
              min={0}
              inputMode="decimal"
              value={donationCustom}
              onChange={(e) => {
                const v = e.target.value;
                setDonationCustom(v);
                setDonationAmount(Math.max(0, Number(v) || 0));
              }}
              placeholder="Other"
              className="h-8 w-24 tabular-nums"
            />
          </div>
        ) : null}
      </div>
      {donCfg.minAmount > 0 ? (
        <p className="text-xs text-text-tertiary">Minimum donation ${donCfg.minAmount}.</p>
      ) : null}
    </div>
  );
}

export function DiscountField({
  appliedDiscount,
  removeDiscount,
  discountInput,
  setDiscountInput,
  applyDiscount,
  discountBusy,
}) {
  return (
    <div className="border-t border-border pt-4">
      {appliedDiscount ? (
        <div className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
          <span className="flex items-center gap-2 text-sm text-foreground">
            <Check className="h-4 w-4 text-emerald-400" />
            <span className="font-mono">{appliedDiscount.code}</span> applied
          </span>
          <button
            type="button"
            onClick={removeDiscount}
            className="text-xs text-text-secondary hover:text-red-400"
          >
            Remove
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Input
            value={discountInput}
            onChange={(e) => setDiscountInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyDiscount();
              }
            }}
            placeholder="Discount code"
            className="uppercase"
          />
          <Button
            type="button"
            variant="outline"
            disabled={discountBusy || !discountInput.trim()}
            onClick={applyDiscount}
            className="shrink-0 border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
          >
            {discountBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
          </Button>
        </div>
      )}
    </div>
  );
}
