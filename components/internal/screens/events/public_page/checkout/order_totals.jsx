"use client";

import { earlybirdLabel } from "@/lib/events/earlybird";
import { buildPurchasableSelections } from "@/lib/events/purchasables";
import { currency } from "@/components/internal/screens/tickets/constants";
import { cn } from "@/lib/utils";

const credit = (n) => `−${currency(n)}`;

// "Sec B · Row E · Seats 3, 4" for each row held for this order.
function seatDetail(seatSel) {
  const names = new Map((seatSel?.sections ?? []).map((s) => [s.id, s.name]));
  const rows = new Map();
  for (const seat of seatSel?.seats ?? []) {
    const key = `${seat.sectionId}|${seat.rowLabel}`;
    if (!rows.has(key)) rows.set(key, { section: names.get(seat.sectionId) ?? "", row: seat.rowLabel, seats: [] });
    rows.get(key).seats.push(seat.seatLabel);
  }
  return [...rows.values()]
    .map((r) => `Sec ${r.section} · Row ${r.row} · Seat${r.seats.length > 1 ? "s" : ""} ${r.seats.join(", ")}`)
    .join("; ");
}

// Every line the order is made of, add-ons by name so the summary matches the Stripe receipt.
function orderLines(event, checkout) {
  const {
    ticket,
    qty,
    price,
    ebReduction,
    usePurchasables,
    visiblePurs,
    purSelections,
    addonUnit,
    discountAmount,
    appliedDiscount,
    groupDiscount,
    gCfg,
    donationAmount,
    seatSel,
  } = checkout;

  const lines = [
    {
      key: "tickets",
      label: ticket?.name || "Tickets",
      count: qty,
      value: currency(price * qty),
      detail: seatDetail(seatSel),
    },
  ];
  if (ebReduction > 0) {
    lines.push({
      key: "earlybird",
      label: `Early bird (${earlybirdLabel(event)})`,
      value: credit(ebReduction * qty),
      credit: true,
    });
  }

  let itemized = 0;
  if (usePurchasables) {
    for (const p of buildPurchasableSelections(visiblePurs, purSelections)) {
      itemized += p.total;
      lines.push({
        key: p.id,
        label: p.name,
        count: p.quantity * qty,
        value: p.total > 0 ? currency(p.total * qty) : "Free",
      });
    }
  }
  // Offerings and slot surcharges have no per-item names here.
  const rest = Math.round((addonUnit - itemized) * 100) / 100;
  if (rest !== 0) {
    lines.push({
      key: "extras",
      label: usePurchasables ? "Time slot" : "Add-ons",
      count: qty,
      value: rest > 0 ? currency(rest * qty) : credit(-rest * qty),
      credit: rest < 0,
    });
  }

  if (discountAmount > 0) {
    lines.push({
      key: "discount",
      label: `Discount (${appliedDiscount.code})`,
      value: credit(discountAmount),
      credit: true,
    });
  }
  if (groupDiscount > 0) {
    lines.push({
      key: "group",
      label: `Group discount (${gCfg.discountPercent}%)`,
      value: credit(groupDiscount),
      credit: true,
    });
  }
  if (donationAmount > 0) {
    lines.push({ key: "donation", label: "Donation", value: currency(donationAmount) });
  }
  return lines;
}

function Lines({ lines, className }) {
  return (
    <div className={cn("space-y-1.5 text-text-secondary", className)}>
      {lines.map((line) => (
        <div
          key={line.key}
          className={cn(
            "flex items-baseline justify-between gap-3",
            line.credit && "text-emerald-600 dark:text-emerald-400",
          )}
        >
          <span className="min-w-0">
            <span className="block truncate">
              {line.label}
              {line.count > 1 ? (
                <span className="text-text-tertiary"> × {line.count}</span>
              ) : null}
            </span>
            {line.detail ? (
              <span className="mt-0.5 block truncate text-xs text-text-tertiary">{line.detail}</span>
            ) : null}
          </span>
          <span className="shrink-0 tabular-nums">{line.value}</span>
        </div>
      ))}
    </div>
  );
}

function TotalRow({ total }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-text-secondary">Total</span>
      <span className="text-lg font-bold tabular-nums text-foreground">
        {total === 0 ? "Free" : currency(total)}
      </span>
    </div>
  );
}

export function DetailsTotals({ event, checkout }) {
  const lines = orderLines(event, checkout);
  return (
    <div className="border-t border-border pt-4">
      {lines.length > 1 ? <Lines lines={lines} className="mb-2 text-xs" /> : null}
      <TotalRow total={checkout.total} />
    </div>
  );
}

export function OrderSummary({ event, checkout }) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-text-tertiary">
        Order summary
      </p>
      <Lines lines={orderLines(event, checkout)} className="text-sm" />
      <div className="border-t border-border pt-3">
        <TotalRow total={checkout.total} />
      </div>
    </div>
  );
}
