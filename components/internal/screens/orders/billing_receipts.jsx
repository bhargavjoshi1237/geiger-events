"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Eye, FileText, Loader2, MoreHorizontal, Receipt } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  ScreenHeader,
  SearchInput,
  StatsBar,
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
import { useProject } from "@/context/project-context";
import { listEvents } from "@/lib/supabase/events";
import { listProjectOrders } from "@/lib/supabase/orders";
import { addOrderEvent } from "@/lib/supabase/order_events";

import { OrderDetailDrawer } from "./order_detail_drawer";
import { currency, formatDate, orderRef } from "./constants";

export function BillingReceiptsScreen() {
  const { projectId } = useProject();
  const [orders, setOrders] = useState([]);
  const [eventNames, setEventNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
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

  // Each order is a billable document (receipt); invoices are generated on demand.
  const documents = useMemo(() => orders.filter((o) => !o.cancelledAt), [orders]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return documents.filter((o) =>
      q
        ? `${o.name} ${o.email} ${eventNames[o.eventId] || ""} ${orderRef(o.id)}`
            .toLowerCase()
            .includes(q)
        : true,
    );
  }, [documents, search, eventNames]);

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

  // Client-side actions for now — a real email/PDF pipeline belongs in a server
  // route; here we log the action to the order timeline.
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
        <div className="flex flex-col gap-1">
          <span className="font-medium text-foreground">{orderRef(o.id)}</span>
          <span className="text-xs text-text-secondary">
            {o.name || "Unnamed"} · {o.email || "—"}
          </span>
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
                onClick={() => setOpenId(o.id)}
              >
                <Eye className="h-4 w-4" /> View order
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer gap-2 text-muted-foreground focus:bg-surface-hover focus:text-foreground"
                onClick={() => sendReceipt(o)}
              >
                <Receipt className="h-4 w-4" /> Resend receipt
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-surface-strong" />
              <DropdownMenuItem
                className="cursor-pointer gap-2 text-muted-foreground focus:bg-surface-hover focus:text-foreground"
                onClick={() => generateInvoice(o)}
              >
                <FileText className="h-4 w-4" /> Generate invoice
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
        title="Billing & Receipts"
        description="Receipts and invoices for every order — resend a receipt or generate a VAT invoice on request."
      />

      <StatsBar stats={stats} columns={3} />

      <Toolbar>
        <div />
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
          Loading receipts…
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(o) => o.id}
          onRowClick={(o) => setOpenId(o.id)}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              <EmptyState
                icon={Receipt}
                title={documents.length ? "No receipts match your search" : "No receipts yet"}
                description={
                  documents.length
                    ? "Try a different search."
                    : "Each paid order gets a receipt here that you can resend or invoice."
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
      />
    </MainScreenWrapper>
  );
}

export default BillingReceiptsScreen;
