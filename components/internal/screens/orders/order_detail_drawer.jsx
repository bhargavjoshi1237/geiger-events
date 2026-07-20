"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Ban, Loader2, Plus, Receipt, RotateCcw, StickyNote } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, StatusPill } from "@/components/internal/shared/screen_kit";

import { listOrderEvents, addOrderEvent } from "@/lib/supabase/order_events";
import { listRefundsForOrder, issueRefund } from "@/lib/supabase/order_refunds";
import { cancelOrder } from "@/lib/supabase/orders";
import {
  ORDER_STATUS_MAP,
  ORDER_EVENT_LABELS,
  REFUND_REASON_OPTIONS,
  REFUND_METHOD_OPTIONS,
  currency,
  formatDateTime,
  orderRef,
  reasonLabel,
  methodLabel,
} from "./constants";

// --- Refund dialog -----------------------------------------------------------

// Remounted (via key) each time it opens, so state initializes fresh — no reset
// effect needed.
function RefundDialog({ open, onOpenChange, order, onConfirm, pending }) {
  const remaining = Math.max(0, (order?.total || 0) - (order?.refundedTotal || 0));
  const [amount, setAmount] = useState(remaining);
  const [reasonCode, setReasonCode] = useState("requested_by_customer");
  const [method, setMethod] = useState("original");
  const [reason, setReason] = useState("");

  const submit = () => {
    const value = Number(amount) || 0;
    if (value <= 0) {
      toast.error("Enter a refund amount above zero.");
      return;
    }
    if (value > remaining) {
      toast.error(`You can refund at most ${currency(remaining)} on this order.`);
      return;
    }
    onConfirm({ amount: value, reasonCode, method, reason });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-background">
        <DialogHeader>
          <DialogTitle>Issue a refund</DialogTitle>
          <DialogDescription>
            {order ? `${order.name || "This buyer"} · ${orderRef(order.id)}` : ""}
            {" — "}
            {currency(remaining)} refundable.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Amount">
              <Input
                type="number"
                min={0}
                max={remaining}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="tabular-nums"
              />
            </Field>
            <Field label="Method">
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REFUND_METHOD_OPTIONS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Reason">
            <Select value={reasonCode} onValueChange={setReasonCode}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REFUND_REASON_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Note" hint="Optional — shown on the order timeline.">
            <Textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Buyer can no longer attend."
            />
          </Field>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={pending}
            onClick={submit}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Refund {currency(Number(amount) || 0)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Line items --------------------------------------------------------------

function LineRow({ label, value, muted, strong }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm">
      <span className={muted ? "text-text-secondary" : "text-foreground"}>{label}</span>
      <span
        className={
          strong
            ? "font-semibold tabular-nums text-white"
            : "tabular-nums text-foreground"
        }
      >
        {value}
      </span>
    </div>
  );
}

// --- Drawer ------------------------------------------------------------------

// The drawer's inner content — mounted fresh per order (keyed by order.id), so
// `loading` starts true and the fetch effect only ever sets state in its async
// continuation.
function OrderDrawerBody({ order, eventName, onRefunded, onCancelled }) {
  const [events, setEvents] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refundOpen, setRefundOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([listOrderEvents(order.id), listRefundsForOrder(order.id)]).then(
      ([ev, rf]) => {
        if (!alive) return;
        setEvents(ev ?? []);
        setRefunds(rf ?? []);
        setLoading(false);
      },
    );
    return () => {
      alive = false;
    };
  }, [order.id]);

  const remaining = Math.max(0, (order.total || 0) - (order.refundedTotal || 0));
  const canRefund = !order.cancelledAt && remaining > 0;
  const canCancel = !order.cancelledAt;

  const lineItems = useMemo(() => {
    const rows = [];
    rows.push({
      label: `${order.ticket || "Ticket"} × ${order.quantity || 1}`,
      value: currency((order.price || 0) * (order.quantity || 1)),
    });
    if (order.donation) {
      rows.push({ label: "Donation", value: currency(Number(order.donation) || 0) });
    }
    if (order.discount) {
      const d = order.discount;
      const label =
        typeof d === "object" ? `Discount${d.code ? ` (${d.code})` : ""}` : "Discount";
      rows.push({ label, value: "applied", muted: true });
    }
    return rows;
  }, [order]);

  const handleRefund = async ({ amount, reasonCode, method, reason }) => {
    if (!order) return;
    setPending(true);
    const res = await issueRefund({
      orderId: order.id,
      amount,
      reasonCode,
      method,
      reason,
    });
    setPending(false);
    if (!res || !res.ok) {
      toast.error("Couldn't issue the refund.");
      return;
    }
    setRefundOpen(false);
    toast.success(`Refunded ${currency(amount)}.`);
    // Refresh the drawer's lists and let the parent update the row.
    const [ev, rf] = await Promise.all([
      listOrderEvents(order.id),
      listRefundsForOrder(order.id),
    ]);
    setEvents(ev ?? []);
    setRefunds(rf ?? []);
    onRefunded?.(order.id, { refundedTotal: res.refundedTotal });
  };

  const handleCancel = async () => {
    if (!order) return;
    const ok = await cancelOrder(order.id);
    if (!ok) {
      toast.error("Couldn't cancel the order.");
      return;
    }
    toast.success("Order cancelled.");
    onCancelled?.(order.id);
    const ev = await listOrderEvents(order.id);
    setEvents(ev ?? []);
  };

  const handleReceipt = async () => {
    if (!order) return;
    const saved = await addOrderEvent({
      orderId: order.id,
      projectId: order.projectId,
      type: "receipt_sent",
      summary: `Receipt re-sent to ${order.email || "buyer"}`,
    });
    if (!saved) {
      toast.error("Couldn't send the receipt.");
      return;
    }
    // Client-side action for now; a real email send belongs in a server route.
    setEvents((prev) => [saved, ...prev]);
    toast.success("Receipt sent.");
  };

  const handleNote = async () => {
    const text = note.trim();
    if (!order || !text) return;
    setNote("");
    const saved = await addOrderEvent({
      orderId: order.id,
      projectId: order.projectId,
      type: "note",
      summary: text,
    });
    if (!saved) {
      toast.error("Couldn't add the note.");
      return;
    }
    setEvents((prev) => [saved, ...prev]);
  };

  return (
    <>
      <SheetHeader className="border-b border-border p-5">
        <div className="flex items-center gap-2">
          <SheetTitle className="text-base">{orderRef(order.id)}</SheetTitle>
          <StatusPill status={order.displayStatus} map={ORDER_STATUS_MAP} />
        </div>
        <SheetDescription>
          {order.name || "Unnamed buyer"} · {eventName || "—"}
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-6 p-5">
              {/* Buyer + payment */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">
                    Buyer
                  </p>
                  <p className="mt-1 truncate text-foreground">{order.name || "—"}</p>
                  <p className="truncate text-xs text-text-secondary">
                    {order.email || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">
                    Placed
                  </p>
                  <p className="mt-1 text-foreground">{formatDateTime(order.createdAt)}</p>
                  <p className="text-xs text-text-secondary">
                    {order.stripePaymentIntentId ? "Card · Stripe" : "No payment ref"}
                  </p>
                </div>
              </div>

              {/* Line items */}
              <div className="rounded-xl border border-border bg-surface-subtle p-4">
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-text-secondary">
                  Items
                </p>
                <div className="divide-y divide-border">
                  {lineItems.map((li, i) => (
                    <LineRow key={i} {...li} />
                  ))}
                </div>
                <div className="mt-1 border-t border-border-strong pt-1">
                  <LineRow label="Total" value={currency(order.total)} strong />
                  {order.refundedTotal > 0 ? (
                    <>
                      <LineRow
                        label="Refunded"
                        value={`-${currency(order.refundedTotal)}`}
                        muted
                      />
                      <LineRow label="Net" value={currency(remaining)} strong />
                    </>
                  ) : null}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <Button
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={!canRefund}
                  onClick={() => setRefundOpen(true)}
                >
                  <RotateCcw className="h-4 w-4" /> Issue refund
                </Button>
                <Button
                  variant="outline"
                  className="border-border bg-surface-card text-muted-foreground hover:bg-surface-active hover:text-foreground"
                  onClick={handleReceipt}
                >
                  <Receipt className="h-4 w-4" /> Resend receipt
                </Button>
                <Button
                  variant="outline"
                  className="border-border bg-surface-card text-red-300 hover:bg-red-500/10 hover:text-red-300"
                  disabled={!canCancel}
                  onClick={handleCancel}
                >
                  <Ban className="h-4 w-4" /> Cancel
                </Button>
              </div>

              {/* Refunds on this order */}
              {refunds.length ? (
                <div>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-text-secondary">
                    Refunds
                  </p>
                  <div className="space-y-2">
                    {refunds.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-subtle px-3 py-2 text-sm"
                      >
                        <span className="text-foreground">
                          {reasonLabel(r.reasonCode)} · {methodLabel(r.method)}
                        </span>
                        <span className="font-semibold tabular-nums text-red-300">
                          -{currency(r.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Add note */}
              <div className="flex items-center gap-2">
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add an internal note…"
                  onKeyDown={(e) => e.key === "Enter" && handleNote()}
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0 border-border bg-surface-card text-muted-foreground hover:bg-surface-active hover:text-foreground"
                  aria-label="Add note"
                  onClick={handleNote}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Timeline */}
              <div>
                <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-text-secondary">
                  Timeline
                </p>
                {loading ? (
                  <div className="flex items-center gap-2 py-4 text-sm text-text-secondary">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                  </div>
                ) : events.length ? (
                  <ol className="space-y-3">
                    {events.map((e) => (
                      <li key={e.id} className="flex gap-3">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-border-strong" />
                        <div className="min-w-0">
                          <p className="text-sm text-foreground">
                            {ORDER_EVENT_LABELS[e.type] || e.type}
                            {e.amount != null ? ` · ${currency(e.amount)}` : ""}
                          </p>
                          {e.summary &&
                          e.summary !== (ORDER_EVENT_LABELS[e.type] || "") ? (
                            <p className="truncate text-xs text-text-secondary">
                              {e.summary}
                            </p>
                          ) : null}
                          <p className="text-xs text-text-tertiary">
                            {formatDateTime(e.createdAt)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="flex items-center gap-2 py-2 text-sm text-text-secondary">
                    <StickyNote className="h-4 w-4" /> No activity yet.
                  </p>
                )}
              </div>
            </div>

      {/* Keyed on open so the form resets to fresh state each time it opens. */}
      <RefundDialog
        key={refundOpen ? "open" : "closed"}
        open={refundOpen}
        onOpenChange={setRefundOpen}
        order={order}
        onConfirm={handleRefund}
        pending={pending}
      />
    </>
  );
}

// The Sheet stays mounted (for enter/exit animation); the body remounts per
// order via key so its data-loading state initializes cleanly.
export function OrderDetailDrawer({
  order,
  eventName,
  onOpenChange,
  onRefunded,
  onCancelled,
}) {
  return (
    <Sheet open={!!order} onOpenChange={(o) => !o && onOpenChange?.(false)}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
        {order ? (
          <OrderDrawerBody
            key={order.id}
            order={order}
            eventName={eventName}
            onRefunded={onRefunded}
            onCancelled={onCancelled}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export default OrderDetailDrawer;
