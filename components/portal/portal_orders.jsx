"use client";

import React, { useMemo, useState } from "react";
import { ShoppingBag, Receipt } from "lucide-react";

import { EmptyState, StatusPill, SearchInput } from "@/components/internal/shared/screen_kit";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, Cover, money, fmtDate } from "./portal_kit";

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
  return (
    <Card onClick={() => onOpen(o)} className="flex items-center gap-4 p-0">
      <Cover url={o.coverUrl} name={o.eventName} className="h-16 w-16 shrink-0 rounded-l-xl" />
      <div className="min-w-0 flex-1 py-3">
        <p className="truncate text-sm font-semibold text-foreground">{o.eventName}</p>
        <p className="mt-0.5 text-xs text-text-secondary">
          {o.ticket || "Admission"} × {o.quantity} · {fmtDate(o.createdAt)}
        </p>
        <p className="mt-0.5 font-mono text-[11px] text-text-tertiary">{o.orderCode}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 pr-4">
        <StatusPill status={o.status} map={ORDER_STATUS} />
        <span className="text-sm tabular-nums text-foreground">{money(o.total)}</span>
      </div>
    </Card>
  );
}

function ReceiptDialog({ order, onClose }) {
  return (
    <Dialog open={Boolean(order)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        {order ? (
          <>
            <DialogHeader>
              <DialogTitle>Order receipt</DialogTitle>
            </DialogHeader>

            <div className="rounded-xl border border-border bg-surface-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {order.eventName}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-text-tertiary">
                    {order.orderCode}
                  </p>
                </div>
                <StatusPill status={order.status} map={ORDER_STATUS} />
              </div>

              <div className="my-4 h-px bg-border" />

              <Line
                label={`${order.ticket || "Admission"} × ${order.quantity}`}
                value={money(order.unitPrice * order.quantity)}
              />
              <div className="my-3 h-px bg-border" />
              <div className="flex items-center justify-between text-sm font-semibold text-foreground">
                <span>Total</span>
                <span className="tabular-nums">{money(order.total)}</span>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Meta label="Purchased">{fmtDate(order.createdAt)}</Meta>
              {order.eventDate ? <Meta label="Event date">{fmtDate(order.eventDate)}</Meta> : null}
              {order.buyerName ? <Meta label="Buyer">{order.buyerName}</Meta> : null}
              {order.city ? <Meta label="Location">{order.city}</Meta> : null}
            </dl>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Line({ label, value }) {
  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span>{label}</span>
      <span className="tabular-nums text-foreground">{value}</span>
    </div>
  );
}

function Meta({ label, children }) {
  return (
    <div>
      <dt className="text-xs text-text-tertiary">{label}</dt>
      <dd className="text-foreground">{children}</dd>
    </div>
  );
}

export function PortalOrders({ orders }) {
  const [open, setOpen] = useState(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

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

  if (!orders?.length) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title="No orders yet"
        description="Your ticket purchases and receipts will show up here."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <FilterDropdown
          value={status}
          options={STATUS_FILTER}
          onValueChange={setStatus}
        />
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
        <EmptyState
          icon={Receipt}
          title="No matching orders"
          description="Try a different search or clear the status filter."
        />
      )}

      <ReceiptDialog order={open} onClose={() => setOpen(null)} />
    </div>
  );
}

export default PortalOrders;
