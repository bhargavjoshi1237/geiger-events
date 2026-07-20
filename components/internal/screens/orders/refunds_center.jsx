"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, MoreHorizontal, RotateCcw, Trash2 } from "lucide-react";

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
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { useProject } from "@/context/project-context";
import { listEvents } from "@/lib/supabase/events";
import { listProjectOrders } from "@/lib/supabase/orders";
import {
  listOrderRefunds,
  updateRefundStatus,
  softDeleteOrderRefund,
} from "@/lib/supabase/order_refunds";

import { OrderDetailDrawer } from "./order_detail_drawer";
import {
  REFUND_STATUS_MAP,
  REFUND_STATUS_FILTER_OPTIONS,
  currency,
  formatDate,
  orderRef,
  reasonLabel,
  methodLabel,
} from "./constants";

const NEXT_STATUS = ["Requested", "Approved", "Denied", "Issued"];

export function RefundsCenterScreen() {
  const { projectId } = useProject();
  const [refunds, setRefunds] = useState([]);
  const [orders, setOrders] = useState([]);
  const [eventNames, setEventNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      listOrderRefunds(projectId),
      listProjectOrders(projectId),
      listEvents(projectId),
    ]).then(([rf, ord, events]) => {
      if (!alive) return;
      setRefunds(rf ?? []);
      setOrders(ord ?? []);
      const map = {};
      for (const e of events ?? []) map[e.id] = e.name;
      setEventNames(map);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const ordersById = useMemo(() => {
    const m = {};
    for (const o of orders) m[o.id] = o;
    return m;
  }, [orders]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return refunds.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      const o = ordersById[r.orderId];
      if (
        q &&
        !`${o?.name || ""} ${o?.email || ""} ${eventNames[r.eventId] || ""} ${orderRef(r.orderId)}`
          .toLowerCase()
          .includes(q)
      )
        return false;
      return true;
    });
  }, [refunds, search, status, ordersById, eventNames]);

  const stats = useMemo(() => {
    const issued = refunds.filter((r) => r.status === "Issued");
    const issuedTotal = issued.reduce((s, r) => s + r.amount, 0);
    const pending = refunds.filter((r) => r.status === "Requested").length;
    const gross = orders.reduce((s, o) => s + o.total, 0);
    const rate = gross ? Math.round((issuedTotal / gross) * 100) : 0;
    return [
      { label: "Refunds", value: String(refunds.length), footer: `${pending} pending` },
      { label: "Issued", value: String(issued.length), footer: "Completed" },
      { label: "Refunded", value: currency(issuedTotal), footer: "Total paid back" },
      { label: "Refund rate", value: `${rate}%`, footer: "Of gross revenue" },
    ];
  }, [refunds, orders]);

  const openOrder = useMemo(
    () => (openId ? orders.find((o) => o.id === openId) || null : null),
    [openId, orders],
  );

  const setStatusFor = async (r, next) => {
    setRefunds((prev) =>
      prev.map((x) => (x.id === r.id ? { ...x, status: next } : x)),
    );
    const ok = await updateRefundStatus(r.id, next);
    if (!ok) toast.error("Couldn't update on the server.");
    else toast.success(`Marked ${next.toLowerCase()}.`);
  };

  const remove = async (r) => {
    setRefunds((prev) => prev.filter((x) => x.id !== r.id));
    toast.success("Refund removed.");
    const ok = await softDeleteOrderRefund(r.id);
    if (!ok) toast.error("Couldn't remove on the server.");
  };

  const columns = [
    {
      key: "buyer",
      header: "Buyer",
      render: (r) => {
        const o = ordersById[r.orderId];
        return (
          <div className="flex flex-col gap-1">
            <span className="font-medium text-foreground">
              {o?.name || "Unknown buyer"}
            </span>
            <span className="text-xs text-text-secondary">
              {orderRef(r.orderId)} · {eventNames[r.eventId] || "—"}
            </span>
          </div>
        );
      },
    },
    {
      key: "reason",
      header: "Reason",
      render: (r) => (
        <span className="text-sm text-text-secondary">
          {reasonLabel(r.reasonCode)} · {methodLabel(r.method)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusPill status={r.status} map={REFUND_STATUS_MAP} />,
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      className: "text-right font-semibold tabular-nums text-white",
      render: (r) => currency(r.amount),
    },
    {
      key: "date",
      header: "Date",
      align: "right",
      className: "text-right text-text-tertiary",
      render: (r) => <span className="text-xs">{formatDate(r.createdAt)}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (r) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-44 border-border bg-surface-card shadow-xl"
            >
              <DropdownMenuItem
                className="cursor-pointer gap-2 text-muted-foreground focus:bg-surface-hover focus:text-foreground"
                onClick={() => setOpenId(r.orderId)}
              >
                <RotateCcw className="h-4 w-4" /> View order
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-surface-strong" />
              {NEXT_STATUS.filter((s) => s !== r.status).map((s) => (
                <DropdownMenuItem
                  key={s}
                  className="cursor-pointer gap-2 text-muted-foreground focus:bg-surface-hover focus:text-foreground"
                  onClick={() => setStatusFor(r, s)}
                >
                  Mark {s.toLowerCase()}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator className="bg-surface-strong" />
              <DropdownMenuItem
                className="cursor-pointer gap-2 text-red-300 focus:bg-red-500/10 focus:text-red-300"
                onClick={() => remove(r)}
              >
                <Trash2 className="h-4 w-4 text-red-300" /> Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Refunds & Cancellations"
        description="Every refund raised against an order — approve, deny, or issue full and partial refunds and keep a running total."
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <FilterDropdown
          value={status}
          onValueChange={setStatus}
          options={REFUND_STATUS_FILTER_OPTIONS}
          height="h-9"
        />
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search buyer, order, event…"
          className="w-full sm:max-w-xs"
        />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading refunds…
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(r) => r.id}
          onRowClick={(r) => setOpenId(r.orderId)}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              <EmptyState
                icon={RotateCcw}
                title={refunds.length ? "No refunds match your filters" : "No refunds yet"}
                description={
                  refunds.length
                    ? "Try clearing the search or filters."
                    : "Issue a refund from any order and it'll be tracked here."
                }
              />
            </div>
          }
        />
      )}

      <OrderDetailDrawer
        order={openOrder}
        eventName={openOrder ? eventNames[openOrder.eventId] : ""}
        onOpenChange={(o) => !o && setOpenId(null)}
        onRefunded={() => {
          // Re-pull refunds so a drawer-issued refund lands in the queue.
          listOrderRefunds(projectId).then((rf) => setRefunds(rf ?? []));
        }}
      />
    </MainScreenWrapper>
  );
}

export default RefundsCenterScreen;
