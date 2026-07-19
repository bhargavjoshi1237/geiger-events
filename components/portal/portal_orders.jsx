"use client";
/* eslint-disable @next/next/no-img-element -- portal renders remote Supabase cover URLs; next/image adds no value here */

import React, { useMemo, useState } from "react";
import {
  ShoppingBag,
  Receipt,
  MessageSquare,
  CalendarDays,
  CalendarClock,
  User,
  MapPin,
} from "lucide-react";

import {
  EmptyState,
  StatusPill,
  SearchInput,
  ScreenHeader,
} from "@/components/internal/shared/screen_kit";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TicketStubRow, money, fmtDate } from "./portal_kit";
import { RefundPanel, REFUND_STATUS } from "./portal_tickets";

const ORDER_STATUS = {
  confirmed: { label: "Confirmed", dotClass: "bg-emerald-400" },
  cancelled: { label: "Cancelled", dotClass: "bg-red-400" },
  refunded: { label: "Refunded", dotClass: "bg-sky-400" },
};

const STATUS_FILTER = [
  { value: "all", label: "All statuses" },
  { value: "confirmed", label: "Confirmed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "refunded", label: "Refunded" },
];

function OrderCard({ o, onOpen }) {
  const meta = [
    { label: ORDER_STATUS[o.status]?.label || o.status },
    { label: fmtDate(o.createdAt) },
    { label: o.orderCode, muted: true },
    o.refund ? { label: REFUND_STATUS[o.refund.status]?.label || "Refund", muted: true } : null,
  ].filter(Boolean);

  return (
    <TicketStubRow
      onClick={() => onOpen(o)}
      image={o.coverUrl}
      name={o.eventName}
      description={`${o.ticket || "Admission"} × ${o.quantity}`}
      meta={meta}
      stubValue={money(o.total)}
      stubLabel="total"
    />
  );
}

function ReceiptDialog({ order, onClose, onMessage, onRequestRefund }) {
  return (
    <Dialog open={Boolean(order)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-md gap-0 overflow-y-auto p-0">
        {order ? (
          <>
            <DialogHeader className="border-b border-border p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-subtle text-muted-foreground">
                  {order.coverUrl ? (
                    <img src={order.coverUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Receipt className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <DialogTitle className="truncate text-left text-base">
                    {order.eventName}
                  </DialogTitle>
                  <p className="mt-0.5 font-mono text-[11px] text-text-tertiary">
                    {order.orderCode}
                  </p>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-5 p-5">
              {/* Itemised breakdown — receipt with a torn total line */}
              <div className="overflow-hidden rounded-xl border border-border bg-surface-card">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <span className="text-xs font-medium uppercase tracking-wide text-text-tertiary">
                    Summary
                  </span>
                  <StatusPill status={order.status} map={ORDER_STATUS} />
                </div>
                <div className="space-y-2.5 px-4 py-3.5">
                  <Line
                    label={`${order.ticket || "Admission"} × ${order.quantity}`}
                    value={money(order.unitPrice * order.quantity)}
                  />
                </div>
                <div className="border-t border-dashed border-border" />
                <div className="flex items-center justify-between px-4 py-3.5">
                  <span className="text-sm font-medium text-text-secondary">Total paid</span>
                  <span className="text-lg font-semibold tabular-nums text-foreground">
                    {money(order.total)}
                  </span>
                </div>
              </div>

              {/* Details */}
              <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
                <DetailRow icon={CalendarDays} label="Purchased">
                  {fmtDate(order.createdAt)}
                </DetailRow>
                {order.eventDate ? (
                  <DetailRow icon={CalendarClock} label="Event date">
                    {fmtDate(order.eventDate)}
                  </DetailRow>
                ) : null}
                {order.buyerName ? (
                  <DetailRow icon={User} label="Buyer">
                    {order.buyerName}
                  </DetailRow>
                ) : null}
                {order.city ? (
                  <DetailRow icon={MapPin} label="Location">
                    {order.city}
                  </DetailRow>
                ) : null}
              </dl>

              {/* Actions */}
              <div className="flex flex-col gap-2 border-t border-border pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onMessage(order)}
                  className="w-full border-border bg-surface-card text-foreground hover:bg-surface-hover"
                >
                  <MessageSquare className="h-4 w-4" /> Message organiser
                </Button>
                <RefundPanel ticket={order} onRequestRefund={onRequestRefund} />
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Line({ label, value }) {
  return (
    <div className="flex items-center justify-between text-sm text-text-secondary">
      <span>{label}</span>
      <span className="tabular-nums text-foreground">{value}</span>
    </div>
  );
}

function DetailRow({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface-card text-text-tertiary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <dt className="text-[11px] uppercase tracking-wide text-text-tertiary">{label}</dt>
        <dd className="truncate text-sm text-foreground">{children}</dd>
      </div>
    </div>
  );
}

export function PortalOrders({ orders, onMessage, onRequestRefund }) {
  const [open, setOpen] = useState(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  // Keep the open receipt's data fresh after a refund refetch.
  const openOrder = useMemo(
    () => (open ? (orders || []).find((o) => o.id === open.id) || open : null),
    [open, orders],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (orders || []).filter((o) => {
      if (status !== "all" && o.status !== status) return false;
      if (!q) return true;
      return (
        o.eventName.toLowerCase().includes(q) ||
        (o.orderCode || "").toLowerCase().includes(q) ||
        (o.ticket || "").toLowerCase().includes(q)
      );
    });
  }, [orders, search, status]);

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Orders"
        description="Your purchases and receipts."
      />

      {!orders?.length ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={ShoppingBag}
            title="No orders yet"
            description="Your ticket purchases and receipts will show up here."
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <FilterDropdown value={status} options={STATUS_FILTER} onValueChange={setStatus} />
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search orders…"
              className="sm:max-w-xs"
            />
          </div>

          {filtered.length ? (
            <div className="space-y-3">
              {filtered.map((o) => (
                <OrderCard key={o.id} o={o} onOpen={setOpen} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-surface-subtle">
              <EmptyState
                icon={Receipt}
                title="No matching orders"
                description="Try a different search or clear the status filter."
              />
            </div>
          )}
        </div>
      )}

      <ReceiptDialog
        order={openOrder}
        onClose={() => setOpen(null)}
        onMessage={(o) => {
          setOpen(null);
          onMessage?.(o);
        }}
        onRequestRefund={onRequestRefund}
      />
    </MainScreenWrapper>
  );
}

export default PortalOrders;
