"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, Loader2 } from "lucide-react";

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
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { useProject } from "@/context/project-context";
import { listEvents } from "@/lib/supabase/events";
import { listProjectOrders } from "@/lib/supabase/orders";
import { listOrderRefunds } from "@/lib/supabase/order_refunds";

import {
  TRANSACTION_TYPE_MAP,
  TRANSACTION_TYPE_FILTER_OPTIONS,
  currency,
  formatDate,
  orderRef,
  methodLabel,
} from "./constants";

// Rough gateway fee estimate (Stripe-style 2.9% + $0.30 per successful charge).
const estFee = (amount) => amount * 0.029 + 0.3;

export function TransactionsScreen() {
  const { projectId } = useProject();
  const [orders, setOrders] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [eventNames, setEventNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");

  useEffect(() => {
    let alive = true;
    Promise.all([
      listProjectOrders(projectId),
      listOrderRefunds(projectId),
      listEvents(projectId),
    ]).then(([ord, rf, events]) => {
      if (!alive) return;
      setOrders(ord ?? []);
      setRefunds(rf ?? []);
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

  // The ledger: every charge (order) and refund merged, newest first.
  const ledger = useMemo(() => {
    const charges = orders.map((o) => ({
      id: `c-${o.id}`,
      type: "Charge",
      orderId: o.id,
      name: o.name || "Unnamed",
      eventId: o.eventId,
      method: o.stripePaymentIntentId ? "original" : "manual",
      amount: o.total,
      date: o.createdAt,
    }));
    const refundLines = refunds.map((r) => ({
      id: `r-${r.id}`,
      type: "Refund",
      orderId: r.orderId,
      name: ordersById[r.orderId]?.name || "Unnamed",
      eventId: r.eventId,
      method: r.method,
      amount: -r.amount,
      date: r.createdAt,
    }));
    return [...charges, ...refundLines].sort(
      (a, b) => new Date(b.date || 0) - new Date(a.date || 0),
    );
  }, [orders, refunds, ordersById]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ledger.filter((t) => {
      if (type !== "all" && t.type !== type) return false;
      if (
        q &&
        !`${t.name} ${eventNames[t.eventId] || ""} ${orderRef(t.orderId)}`
          .toLowerCase()
          .includes(q)
      )
        return false;
      return true;
    });
  }, [ledger, search, type, eventNames]);

  const stats = useMemo(() => {
    const gross = orders.reduce((s, o) => s + o.total, 0);
    const refunded = refunds.reduce((s, r) => s + r.amount, 0);
    const fees = orders.reduce((s, o) => s + estFee(o.total), 0);
    const net = gross - refunded - fees;
    return [
      { label: "Gross charged", value: currency(gross), footer: `${orders.length} charges` },
      { label: "Refunded", value: currency(refunded), footer: `${refunds.length} refunds` },
      { label: "Est. fees", value: currency(fees), footer: "2.9% + $0.30" },
      { label: "Net", value: currency(net), footer: "After refunds & fees" },
    ];
  }, [orders, refunds]);

  const columns = [
    {
      key: "type",
      header: "Type",
      render: (t) => <StatusPill status={t.type} map={TRANSACTION_TYPE_MAP} />,
    },
    {
      key: "detail",
      header: "Detail",
      render: (t) => (
        <div className="flex flex-col gap-1">
          <span className="font-medium text-foreground">{t.name}</span>
          <span className="text-xs text-text-secondary">
            {orderRef(t.orderId)} · {eventNames[t.eventId] || "—"}
          </span>
        </div>
      ),
    },
    {
      key: "method",
      header: "Method",
      render: (t) => (
        <span className="text-sm text-text-secondary">{methodLabel(t.method)}</span>
      ),
    },
    {
      key: "date",
      header: "Date",
      render: (t) => (
        <span className="text-sm text-text-tertiary">{formatDate(t.date)}</span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      className: "text-right font-semibold tabular-nums",
      render: (t) => (
        <span className={t.amount < 0 ? "text-red-300" : "text-emerald-400"}>
          {t.amount < 0 ? `-${currency(Math.abs(t.amount))}` : currency(t.amount)}
        </span>
      ),
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Transactions"
        description="The money ledger — every charge and refund across your events, with estimated fees and net settlement."
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <FilterDropdown
          value={type}
          onValueChange={setType}
          options={TRANSACTION_TYPE_FILTER_OPTIONS}
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
          Loading transactions…
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(t) => t.id}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              <EmptyState
                icon={ArrowLeftRight}
                title={ledger.length ? "No transactions match your filters" : "No transactions yet"}
                description={
                  ledger.length
                    ? "Try clearing the search or filters."
                    : "Charges and refunds will appear here as orders come in."
                }
              />
            </div>
          }
        />
      )}
    </MainScreenWrapper>
  );
}

export default TransactionsScreen;
