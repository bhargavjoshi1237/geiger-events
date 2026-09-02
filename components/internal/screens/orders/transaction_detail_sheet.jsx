"use client";

import React from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@geiger/ui/sheet";
import { StatusPill } from "@/components/internal/shared/screen_kit";
import { cn } from "@/lib/utils";

import {
  REFUND_STATUS_MAP,
  TRANSACTION_TYPE_MAP,
  currency,
  estFee,
  formatDateTime,
  methodLabel,
  orderRef,
  reasonLabel,
} from "./constants";

function DetailRow({ label, value, strong, muted, danger }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm">
      <span className={muted ? "text-text-secondary" : "text-foreground"}>{label}</span>
      <span
        className={cn(
          "text-right tabular-nums",
          danger
            ? "font-semibold text-red-300"
            : strong
              ? "font-semibold text-white"
              : "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="rounded-xl border border-border bg-surface-subtle p-4">
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-text-secondary">
        {title}
      </p>
      <div className="divide-y divide-border">{children}</div>
    </div>
  );
}

function TransactionSheetBody({ transaction, eventName }) {
  const { order, refund } = transaction;
  const isRefund = transaction.type === "Refund";
  const amount = Math.abs(transaction.amount || 0);
  // Fees only apply to money coming in; a refund returns what was charged.
  const fee = isRefund ? 0 : estFee(amount);
  const net = isRefund ? amount : amount - fee;

  return (
    <>
      <SheetHeader className="border-b border-border p-5">
        <div className="flex items-center gap-2">
          <SheetTitle className="text-base">{orderRef(transaction.orderId)}</SheetTitle>
          <StatusPill status={transaction.type} map={TRANSACTION_TYPE_MAP} />
        </div>
        <SheetDescription>
          {transaction.name || "Unnamed buyer"} · {eventName || "—"}
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-6 p-5">
        <Card title="Money">
          <DetailRow
            label={isRefund ? "Refunded" : "Charged"}
            value={isRefund ? `-${currency(amount)}` : currency(amount)}
            strong
            danger={isRefund}
          />
          <DetailRow label="Method" value={methodLabel(transaction.method)} />
          {isRefund ? null : (
            <>
              <DetailRow label="Est. fee" value={currency(fee)} muted />
              <DetailRow label="Net" value={currency(net)} strong />
            </>
          )}
          <DetailRow label="Date" value={formatDateTime(transaction.date)} muted />
        </Card>

        <Card title="Order">
          <DetailRow label="Reference" value={orderRef(transaction.orderId)} muted />
          <DetailRow label="Event" value={eventName || "—"} muted />
          <DetailRow
            label="Ticket"
            value={`${order?.ticket || "—"} × ${order?.quantity ?? 1}`}
            muted
          />
          <DetailRow label="Buyer" value={order?.name || transaction.name || "—"} muted />
          <DetailRow label="Email" value={order?.email || "—"} muted />
          <DetailRow label="Order total" value={currency(order?.total || 0)} />
          <DetailRow
            label="Refunded to date"
            value={currency(order?.refundedTotal || 0)}
            muted
          />
          {order?.stripePaymentIntentId ? (
            <div className="pt-2">
              <p className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">
                Payment intent
              </p>
              <p className="mt-0.5 break-all font-mono text-xs text-foreground">
                {order.stripePaymentIntentId}
              </p>
            </div>
          ) : null}
        </Card>

        {refund ? (
          <Card title="Refund">
            <DetailRow
              label="Status"
              value={<StatusPill status={refund.status} map={REFUND_STATUS_MAP} />}
            />
            <DetailRow label="Reason" value={reasonLabel(refund.reasonCode)} muted />
            <DetailRow label="Method" value={methodLabel(refund.method)} muted />
            {refund.reason ? (
              <div className="pt-2">
                <p className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">
                  Note
                </p>
                <p className="mt-0.5 text-xs text-foreground">{refund.reason}</p>
              </div>
            ) : null}
          </Card>
        ) : null}
      </div>
    </>
  );
}

// Read-only detail sheet for one ledger line — the same shell as the order
// drawer, since a transaction is a view over an order (or a refund against one)
// rather than something with a page of its own.
export function TransactionDetailSheet({ transaction, eventName, onOpenChange }) {
  return (
    <Sheet open={!!transaction} onOpenChange={(o) => !o && onOpenChange?.(false)}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
        {transaction ? (
          <TransactionSheetBody
            key={transaction.id}
            transaction={transaction}
            eventName={eventName}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export default TransactionDetailSheet;
