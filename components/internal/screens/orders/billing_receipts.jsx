"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Eye,
  FileText,
  Loader2,
  Receipt,
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
import { ActionMenu } from "@geiger/ui/action-menu";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { useProject } from "@/context/project-context";
import { listEvents } from "@/lib/supabase/events";
import { listProjectOrders } from "@/lib/supabase/orders";
import { addOrderEvent } from "@/lib/supabase/order_events";

import { OrderDetailDrawer } from "./order_detail_drawer";
import {
  ORDER_STATUS_MAP,
  RECEIPT_STATUS_FILTER_OPTIONS,
  currency,
  formatDate,
  orderRef,
} from "./constants";

export function BillingReceiptsScreen() {
  const { projectId } = useProject();
  const [orders, setOrders] = useState([]);
  const [eventNames, setEventNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [eventId, setEventId] = useState("all");
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all([listProjectOrders(projectId), listEvents(projectId)]).then(
      ([ord, events]) => {
        if (!alive) return;
        setOrders(ord ?? []);
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

  const documents = useMemo(() => orders.filter((o) => !o.cancelledAt), [orders]);

  const eventFilterOptions = useMemo(
    () => [
      { value: "all", label: "All Events" },
      ...Object.entries(eventNames).map(([id, name]) => ({ value: id, label: name })),
    ],
    [eventNames],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return documents.filter((o) => {
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
  }, [documents, search, status, eventId, eventNames]);

  // Every active filter joins the reset key, so changing one drops back to page 1.
  const pager = usePagination(filtered, {
    resetKey: `${search}|${status}|${eventId}`,
  });

  const stats = useMemo(() => {
    const billed = documents.reduce((s, o) => s + o.total, 0);
    return [
      { label: "Receipts", value: String(documents.length), footer: "One per order" },
      { label: "Billed", value: currency(billed), footer: "Across all receipts" },
      { label: "Buyers", value: String(new Set(documents.map((o) => o.email)).size), footer: "Unique emails" },
    ];
  }, [documents]);

  const openOrder = useMemo(
    () => (openId ? orders.find((o) => o.id === openId) || null : null),
    [openId, orders],
  );

  const sendReceipt = async (o) => {
    const ok = await addOrderEvent({
      orderId: o.id,
      projectId: o.projectId,
      type: "receipt_sent",
      summary: `Receipt sent to ${o.email || "buyer"}`,
    });
    if (ok) toast.success("Receipt sent.");
    else toast.error("Couldn't send the receipt.");
  };

  const generateInvoice = async (o) => {
    const ok = await addOrderEvent({
      orderId: o.id,
      projectId: o.projectId,
      type: "invoice_generated",
      summary: `Invoice generated for ${orderRef(o.id)}`,
    });
    if (ok) toast.success("Invoice generated.");
    else toast.error("Couldn't generate the invoice.");
  };

  const columns = [
    {
      key: "doc",
      header: "Receipt",
      render: (o) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-muted-foreground">
            <Receipt className="h-4 w-4" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-medium text-foreground">{orderRef(o.id)}</span>
            <span className="text-xs text-text-secondary">
              {o.name || "Unnamed"} · {o.email || "—"}
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
      key: "status",
      header: "Status",
      render: (o) => (
        <StatusPill status={o.displayStatus} map={ORDER_STATUS_MAP} />
      ),
    },
    {
      key: "date",
      header: "Date",
      render: (o) => (
        <span className="text-sm text-text-tertiary">{formatDate(o.createdAt)}</span>
      ),
    },
    {
      key: "total",
      header: "Amount",
      align: "right",
      className: "text-right font-semibold tabular-nums text-white",
      render: (o) => currency(o.total),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (o) => (
        <ActionMenu
          label="Receipt actions"
          items={[
            { icon: Eye, label: "View order", onSelect: () => setOpenId(o.id) },
            { icon: Receipt, label: "Resend receipt", onSelect: () => sendReceipt(o) },
            { separator: true },
            { icon: FileText, label: "Generate invoice", onSelect: () => generateInvoice(o) },
          ]}
        />
      ),
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Billing & Receipts"
        description="Receipts and invoices for every order — resend a receipt or generate a VAT invoice on request."
      />

      <StatsBar stats={stats} columns={3} />

      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown
            value={status}
            onValueChange={setStatus}
            options={RECEIPT_STATUS_FILTER_OPTIONS}
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
          placeholder="Search buyer, order, event…"
        />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading receipts…
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
                  icon={Receipt}
                  title={
                    documents.length
                      ? "No receipts match your filters"
                      : "No receipts yet"
                  }
                  description={
                    documents.length
                      ? "Try clearing the search or filters."
                      : "Each paid order gets a receipt here that you can resend or invoice."
                  }
                />
              </div>
            }
          />
          <ListPagination {...pager} itemLabel="receipts" />
        </div>
      )}

      <OrderDetailDrawer
        order={openOrder}
        eventName={openOrder ? eventNames[openOrder.eventId] : ""}
        onOpenChange={(o) => !o && setOpenId(null)}
      />
    </MainScreenWrapper>
  );
}

export default BillingReceiptsScreen;
