"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Ban,
  Eye,
  Loader2,
  Pencil,
  RotateCcw,
  ShoppingBag,
} from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  ScreenHeader,
  SearchInput,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import {
  ListPagination,
  usePagination,
} from "@/components/internal/shared/pagination";
import { Button } from "@geiger/ui/button";
import { ActionMenu } from "@geiger/ui/action-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { useProject } from "@/context/project-context";
import { listEvents } from "@/lib/supabase/events";
import { listProjectOrders, cancelOrder } from "@/lib/supabase/orders";

import { OrderDetailDrawer } from "./order_detail_drawer";
import { OrderEditScreen } from "./order_edit_screen";
import {
  ORDER_STATUS_MAP,
  ORDER_STATUS_FILTER_OPTIONS,
  currency,
  formatDate,
  orderRef,
} from "./constants";

export function AllOrdersScreen() {
  const { projectId } = useProject();
  const [orders, setOrders] = useState([]);
  const [eventNames, setEventNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [eventId, setEventId] = useState("all");
  const [openId, setOpenId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all([listProjectOrders(projectId), listEvents(projectId)]).then(
      ([rows, events]) => {
        if (!alive) return;
        setOrders(rows ?? []);
        const map = {};
        for (const e of events ?? []) map[e.id] = e.name;
        setEventNames(map);
        setLoading(false);
      },
    );
    return () => {
      alive = false;
    };
  }, [projectId]);

  const eventFilterOptions = useMemo(
    () => [
      { value: "all", label: "All Events" },
      ...Object.entries(eventNames).map(([id, name]) => ({ value: id, label: name })),
    ],
    [eventNames],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (status !== "all" && o.displayStatus !== status) return false;
      if (eventId !== "all" && o.eventId !== eventId) return false;
      if (
        q &&
        !`${o.name} ${o.email} ${eventNames[o.eventId] || ""} ${orderRef(o.id)}`
          .toLowerCase()
          .includes(q)
      )
        return false;
      return true;
    });
  }, [orders, search, status, eventId, eventNames]);

  const stats = useMemo(() => {
    const live = orders.filter((o) => !o.cancelledAt);
    const gross = live.reduce((s, o) => s + o.total, 0);
    const refunded = orders.reduce((s, o) => s + (o.refundedTotal || 0), 0);
    const net = gross - refunded;
    const count = live.length;
    const aov = count ? Math.round(net / count) : 0;
    return [
      { label: "Gross revenue", value: currency(gross), footer: "Before refunds" },
      { label: "Net revenue", value: currency(net), footer: "After refunds" },
      { label: "Orders", value: String(count), footer: `${orders.length} all-time` },
      { label: "Refunded", value: currency(refunded), footer: `AOV ${currency(aov)}` },
    ];
  }, [orders]);

  const openOrder = useMemo(
    () => (openId ? orders.find((o) => o.id === openId) || null : null),
    [openId, orders],
  );

  const editOrder = useMemo(
    () => (editId ? orders.find((o) => o.id === editId) || null : null),
    [editId, orders],
  );

  // Every active filter joins the reset key, so changing one drops back to page 1.
  const pager = usePagination(filtered, {
    resetKey: `${search}|${status}|${eventId}`,
  });

  const applyCancel = (id) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === id
          ? { ...o, cancelledAt: new Date().toISOString(), displayStatus: "Cancelled" }
          : o,
      ),
    );
  };

  const applyRefund = (id, { refundedTotal }) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === id
          ? {
              ...o,
              refundedTotal,
              displayStatus:
                refundedTotal >= o.total && o.total > 0
                  ? "Refunded"
                  : refundedTotal > 0
                    ? "Partially refunded"
                    : o.displayStatus,
            }
          : o,
      ),
    );
  };

  const applyEdit = (id, patch) => {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  };

  const handleRowCancel = async (o) => {
    if (o.cancelledAt) return;
    applyCancel(o.id);
    toast.success("Order cancelled.");
    const ok = await cancelOrder(o.id);
    if (!ok) toast.error("Couldn't cancel the order on the server.");
  };

  const columns = [
    {
      key: "order",
      header: "Order",
      render: (o) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-muted-foreground">
            <ShoppingBag className="h-4 w-4" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-medium text-foreground">{o.name || "Unnamed"}</span>
            <span className="text-xs text-text-secondary">
              {orderRef(o.id)} · {o.email || "—"}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "event",
      header: "Event",
      render: (o) => (
        <span className="text-sm text-text-secondary">
          {eventNames[o.eventId] || "—"}
        </span>
      ),
    },
    {
      key: "items",
      header: "Items",
      render: (o) => (
        <span className="text-sm text-text-secondary">
          {o.ticket} ×{o.quantity}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (o) => <StatusPill status={o.displayStatus} map={ORDER_STATUS_MAP} />,
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      className: "text-right font-semibold tabular-nums text-white",
      render: (o) => (
        <div>
          {currency(o.total)}
          {o.refundedTotal > 0 ? (
            <span className="block text-xs font-normal text-red-300">
              -{currency(o.refundedTotal)}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: "date",
      header: "Date",
      align: "right",
      className: "text-right text-text-tertiary",
      render: (o) => <span className="text-xs">{formatDate(o.createdAt)}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (o) => (
        <ActionMenu
          label={`Actions for order ${orderRef(o.id)}`}
          items={[
            {
              icon: Pencil,
              label: "Edit Order",
              onSelect: () => {
                setOpenId(null);
                setEditId(o.id);
              },
            },
            { icon: Eye, label: "View Order", onSelect: () => setOpenId(o.id) },
            { icon: RotateCcw, label: "Issue Refund", onSelect: () => setOpenId(o.id) },
            { separator: true },
            {
              icon: Ban,
              label: "Cancel Order",
              variant: "destructive",
              disabled: !!o.cancelledAt,
              onSelect: () => setCancelTarget(o),
            },
          ]}
        />
      ),
    },
  ];

  // The editor takes the whole screen, the same way a record's edit page does.
  if (editOrder) {
    return (
      <OrderEditScreen
        key={editOrder.id}
        order={editOrder}
        eventName={eventNames[editOrder.eventId]}
        onBack={() => setEditId(null)}
        onView={() => {
          setEditId(null);
          setOpenId(editOrder.id);
        }}
        onSaved={applyEdit}
      />
    );
  }

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="All Orders"
        description="Every ticket order across your events — search, filter, and manage refunds, cancellations and receipts from one place."
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex items-center gap-2">
          <FilterDropdown
            value={status}
            onValueChange={setStatus}
            options={ORDER_STATUS_FILTER_OPTIONS}
            height="h-9"
          />
          <FilterDropdown
            value={eventId}
            onValueChange={setEventId}
            options={eventFilterOptions}
            height="h-9"
          />
        </div>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search name, email, order, event…"
        />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading orders…
        </div>
      ) : (
        <div className="space-y-5">
          <DataTable
            columns={columns}
            data={pager.pageItems}
            getRowKey={(o) => o.id}
            onRowClick={(o) => setOpenId(o.id)}
            empty={
              <div className="rounded-xl border border-border bg-surface-subtle">
                <EmptyState
                  icon={ShoppingBag}
                  title={orders.length ? "No orders match your filters" : "No orders yet"}
                  description={
                    orders.length
                      ? "Try clearing the search or filters."
                      : "Ticket orders from your events will show up here as they come in."
                  }
                />
              </div>
            }
          />
          <ListPagination {...pager} itemLabel="orders" />
        </div>
      )}

      <OrderDetailDrawer
        order={openOrder}
        eventName={openOrder ? eventNames[openOrder.eventId] : ""}
        onOpenChange={(o) => !o && setOpenId(null)}
        onRefunded={applyRefund}
        onCancelled={applyCancel}
      />

      <Dialog
        open={!!cancelTarget}
        onOpenChange={(o) => !o && setCancelTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Order</DialogTitle>
            <DialogDescription>
              Cancel{" "}
              <span className="font-medium text-foreground">
                {orderRef(cancelTarget?.id)}
              </span>{" "}
              from{" "}
              <span className="font-medium text-foreground">
                {cancelTarget?.name || "this buyer"}
              </span>
              ? The buyer loses their tickets. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCancelTarget(null)}>
              Cancel
            </Button>
            <Button
              className="bg-red-500/90 text-white hover:bg-red-500"
              onClick={() => {
                handleRowCancel(cancelTarget);
                setCancelTarget(null);
              }}
            >
              <Ban className="h-4 w-4" /> Cancel Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainScreenWrapper>
  );
}

export default AllOrdersScreen;
