"use client";

import { useState } from "react";
import { Check, ChevronDown, RotateCcw, Scale, ShoppingBag } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  CARD,
  LABEL,
  META,
  PANEL,
  TITLE,
} from "@/components/landing/showcase_demos";
import { Chip } from "./shared";

/* ------------------------------------------------------------------ *
 * Orders — "what happens after money moves"
 * ------------------------------------------------------------------ */

const ORDERS = [
  { id: "NS-4821", name: "Priya Raman", amount: 240, status: "paid" },
  { id: "NS-4822", name: "Marco Silva", amount: 45, status: "paid" },
  { id: "NS-4823", name: "Ada Chen", amount: 240, status: "partial" },
  { id: "NS-4824", name: "Tom Okafor", amount: 120, status: "disputed" },
  { id: "NS-4825", name: "Lena Fischer", amount: 45, status: "refunded" },
];

const ORDER_TABS = ["All", "Paid", "Partial", "Refunded", "Disputed"];

// Order cockpit — every order, every state, one list.
export function OrdersCockpitDemo() {
  const [tab, setTab] = useState("All");
  const shown =
    tab === "All" ? ORDERS : ORDERS.filter((order) => order.status === tab.toLowerCase());

  return (
    <div className={PANEL}>
      <div className="mb-2 flex shrink-0 items-baseline justify-between">
        <span className={TITLE}>Order cockpit</span>
        <span className={META}>Today · $12,480 · 214 orders</span>
      </div>

      <div className="mb-2 flex shrink-0 flex-wrap gap-1">
        {ORDER_TABS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={cn(
              "rounded-full border px-2 py-0.5 text-[10px] transition-colors",
              tab === item
                ? "border-white/25 bg-white/10 text-white"
                : "border-white/[0.07] text-white/40 hover:text-white/70",
            )}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 space-y-1.5">
        {shown.map((order) => (
          <div key={order.id} className={cn(CARD, "flex items-center gap-2 px-3 py-2")}>
            <span
              className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full",
                order.status === "paid"
                  ? "bg-emerald-400"
                  : order.status === "partial"
                    ? "bg-amber-400"
                    : order.status === "disputed"
                      ? "bg-red-400"
                      : "bg-white/25",
              )}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-medium text-white">
                {order.name}
              </div>
              <div className="truncate text-[10px] text-white/40">{order.id}</div>
            </div>
            <span className="shrink-0 text-[11px] tabular-nums text-white/80">
              ${order.amount}
            </span>
            <Chip tone={order.status === "refunded" ? "muted" : order.status}>
              {order.status}
            </Chip>
          </div>
        ))}
      </div>

      <div className="mt-2 flex shrink-0 items-center justify-between rounded-lg border border-dashed border-white/10 px-2.5 py-1.5">
        <span className="text-[10px] text-white/35">Payouts run twice daily</span>
        <span className="flex items-center gap-1 text-[10px] font-medium text-white/60">
          <ShoppingBag className="h-3 w-3" />
          Open cockpit
        </span>
      </div>
    </div>
  );
}

// Refunds — full or partial, with the money-path guard rails on screen.
export function RefundsDemo() {
  const [mode, setMode] = useState("full");
  const [issued, setIssued] = useState(false);
  const amount = mode === "full" ? 240 : 120;

  return (
    <div className={PANEL}>
      <div className="mb-2 flex shrink-0 items-baseline justify-between">
        <span className={TITLE}>Refunds & cancellations</span>
        <span className={META}>Policy · refundable 48h</span>
      </div>

      <div className={cn(CARD, "mb-2 flex shrink-0 items-center justify-between px-3 py-2")}>
        <div className="min-w-0">
          <div className="text-[12px] font-medium text-white">Ada Chen · NS-4823</div>
          <div className={META}>VIP + Afterparty ×2 · paid $240</div>
        </div>
        <span className="shrink-0 text-[11px] tabular-nums text-white/60">3h ago</span>
      </div>

      <div className={cn(LABEL, "shrink-0")}>Refund amount</div>
      <div className="mt-1.5 grid shrink-0 grid-cols-2 gap-1.5">
        {[
          { id: "full", label: "Full", value: "$240" },
          { id: "half", label: "Partial", value: "$120" },
        ].map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => {
              setMode(option.id);
              setIssued(false);
            }}
            className={cn(
              "rounded-md border px-2 py-1.5 text-left transition-colors",
              mode === option.id
                ? "border-white/25 bg-white/10"
                : "border-white/[0.07] text-white/45 hover:text-white/70",
            )}
          >
            <div className="text-[11px] text-white">{option.label}</div>
            <div className="text-[10px] tabular-nums text-white/40">{option.value}</div>
          </button>
        ))}
      </div>

      <div className={cn(LABEL, "mt-2.5 shrink-0")}>Reason</div>
      <div className="mt-1.5 flex shrink-0 items-center justify-between rounded-md border border-white/[0.08] bg-[#262626] px-2.5 py-1.5 text-[11px] text-white/70">
        Buyer request · change of plans
        <ChevronDown className="h-3 w-3 text-white/30" />
      </div>

      <button
        type="button"
        onClick={() => setIssued(true)}
        disabled={issued}
        className={cn(
          "mt-2.5 flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg text-[11px] font-medium transition-colors",
          issued
            ? "border border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
            : "bg-white text-zinc-950 hover:bg-white/90",
        )}
      >
        {issued ? (
          <>
            <Check className="h-3 w-3" />
            ${amount} refunded · back to card in 5–7 days
          </>
        ) : (
          <>
            <RotateCcw className="h-3 w-3" />
            Issue ${amount} refund
          </>
        )}
      </button>
    </div>
  );
}

const DISPUTES = [
  { id: "d1", order: "NS-4824 · Tom Okafor", amount: 120, reason: "Fraud", deadline: "3d left", status: "evidence" },
  { id: "d2", order: "NS-4799 · Iris Nakamura", amount: 45, reason: "Not as described", deadline: "6d left", status: "won" },
  { id: "d3", order: "NS-4903 · Hugo Alves", amount: 240, reason: "Duplicate charge", deadline: "1d left", status: "review" },
];

// Disputes & chargebacks — evidence windows the card networks actually give you.
export function DisputesDemo() {
  const [statuses, setStatuses] = useState(
    Object.fromEntries(DISPUTES.map((item) => [item.id, item.status])),
  );

  const submit = (id) => setStatuses((prev) => ({ ...prev, [id]: "review" }));

  return (
    <div className={PANEL}>
      <div className="mb-2 flex shrink-0 items-baseline justify-between">
        <span className={TITLE}>Disputes & chargebacks</span>
        <span className={META}>$11,800 open</span>
      </div>

      <div className="min-h-0 flex-1 space-y-1.5">
        {DISPUTES.map((item) => {
          const status = statuses[item.id];
          return (
            <div key={item.id} className={cn(CARD, "flex items-center gap-2 px-3 py-2")}>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-medium text-white">
                  {item.order}
                </div>
                <div className="truncate text-[10px] text-white/40">
                  {item.reason} · ${item.amount} · {item.deadline}
                </div>
              </div>
              {status === "evidence" ? (
                <button
                  type="button"
                  onClick={() => submit(item.id)}
                  className="shrink-0 rounded-md bg-white px-2.5 py-1 text-[10px] font-medium text-zinc-950 transition-colors hover:bg-white/90"
                >
                  Submit evidence
                </button>
              ) : (
                <Chip tone={status === "review" ? "live" : "ok"}>
                  {status === "review" ? "Under review" : "Won"}
                </Chip>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex shrink-0 items-center justify-between rounded-lg border border-dashed border-white/10 px-2.5 py-1.5">
        <span className="flex items-center gap-1 text-[10px] text-white/35">
          <Scale className="h-3 w-3" />
          Chargebacks auto-defend from your ticket policy
        </span>
        <span className="text-[10px] font-medium text-white/60">Open dispute center</span>
      </div>
    </div>
  );
}
