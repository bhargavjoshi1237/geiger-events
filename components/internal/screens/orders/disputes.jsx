"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, MoreHorizontal, Plus, Scale, Trash2 } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  Field,
  ScreenHeader,
  SearchInput,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  listDisputes,
  createDispute,
  updateDispute,
  softDeleteDispute,
} from "@/lib/supabase/order_disputes";

import {
  DISPUTE_STATUS_MAP,
  DISPUTE_STATUS_FILTER_OPTIONS,
  currency,
  formatDate,
  orderRef,
} from "./constants";

const DISPUTE_STATUSES = ["Needs response", "Under review", "Won", "Lost"];

function NewDisputeDialog({ open, onOpenChange, orders, onCreate }) {
  const [orderId, setOrderId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [evidenceDue, setEvidenceDue] = useState("");

  const pickOrder = (id) => {
    setOrderId(id);
    const o = orders.find((x) => x.id === id);
    if (o) setAmount(String(o.total));
  };

  const submit = () => {
    if (!orderId) {
      toast.error("Pick the order being disputed.");
      return;
    }
    const o = orders.find((x) => x.id === orderId);
    onCreate({
      orderId,
      eventId: o?.eventId ?? null,
      amount: Number(amount) || 0,
      reason: reason.trim(),
      evidenceDueAt: evidenceDue || null,
    });
    setOrderId("");
    setAmount("");
    setReason("");
    setEvidenceDue("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-background">
        <DialogHeader>
          <DialogTitle>Log a dispute</DialogTitle>
          <DialogDescription>
            Track a chargeback or payment dispute against an order.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <Field label="Order">
            <Select value={orderId} onValueChange={pickOrder}>
              <SelectTrigger>
                <SelectValue placeholder="Select the disputed order" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {orders.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {orderRef(o.id)} · {o.name || "Unnamed"} · {currency(o.total)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Amount">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="tabular-nums"
              />
            </Field>
            <Field label="Evidence due">
              <Input
                type="date"
                value={evidenceDue}
                onChange={(e) => setEvidenceDue(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Reason" hint="Optional — the reason the bank gave.">
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Product not received"
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
            onClick={submit}
          >
            Log dispute
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DisputesScreen() {
  const { projectId } = useProject();
  const [disputes, setDisputes] = useState([]);
  const [orders, setOrders] = useState([]);
  const [eventNames, setEventNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([
      listDisputes(projectId),
      listProjectOrders(projectId),
      listEvents(projectId),
    ]).then(([dp, ord, events]) => {
      if (!alive) return;
      setDisputes(dp ?? []);
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
    return disputes.filter((d) => {
      if (status !== "all" && d.status !== status) return false;
      const o = ordersById[d.orderId];
      if (
        q &&
        !`${o?.name || ""} ${eventNames[d.eventId] || ""} ${orderRef(d.orderId)} ${d.reason}`
          .toLowerCase()
          .includes(q)
      )
        return false;
      return true;
    });
  }, [disputes, search, status, ordersById, eventNames]);

  const stats = useMemo(() => {
    const open = disputes.filter((d) => !["Won", "Lost"].includes(d.status));
    const needs = disputes.filter((d) => d.status === "Needs response").length;
    const atStake = open.reduce((s, d) => s + d.amount, 0);
    const won = disputes.filter((d) => d.status === "Won").length;
    return [
      { label: "Open", value: String(open.length), footer: `${needs} need response` },
      { label: "At stake", value: currency(atStake), footer: "Open disputes" },
      { label: "Won", value: String(won), footer: "Resolved in your favour" },
      { label: "Total", value: String(disputes.length), footer: "All-time" },
    ];
  }, [disputes]);

  const handleCreate = async (draft) => {
    const id = crypto.randomUUID();
    const optimistic = {
      id,
      ...draft,
      projectId,
      status: "Needs response",
      createdAt: new Date().toISOString(),
    };
    setDisputes((prev) => [optimistic, ...prev]);
    toast.success("Dispute logged.");
    const saved = await createDispute({ ...draft, id, projectId });
    if (!saved) {
      setDisputes((prev) => prev.filter((d) => d.id !== id));
      toast.error("Couldn't save the dispute.");
    } else {
      setDisputes((prev) => prev.map((d) => (d.id === id ? saved : d)));
    }
  };

  const setStatusFor = async (d, next) => {
    setDisputes((prev) => prev.map((x) => (x.id === d.id ? { ...x, status: next } : x)));
    const saved = await updateDispute(d.id, { status: next });
    if (!saved) toast.error("Couldn't update on the server.");
    else toast.success(`Marked ${next.toLowerCase()}.`);
  };

  const remove = async (d) => {
    setDisputes((prev) => prev.filter((x) => x.id !== d.id));
    toast.success("Dispute removed.");
    const ok = await softDeleteDispute(d.id);
    if (!ok) toast.error("Couldn't remove on the server.");
  };

  const columns = [
    {
      key: "dispute",
      header: "Dispute",
      render: (d) => {
        const o = ordersById[d.orderId];
        return (
          <div className="flex flex-col gap-1">
            <span className="font-medium text-foreground">{o?.name || "Unknown buyer"}</span>
            <span className="text-xs text-text-secondary">
              {orderRef(d.orderId)} · {eventNames[d.eventId] || "—"}
            </span>
          </div>
        );
      },
    },
    {
      key: "reason",
      header: "Reason",
      render: (d) => (
        <span className="text-sm text-text-secondary">{d.reason || "—"}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (d) => <StatusPill status={d.status} map={DISPUTE_STATUS_MAP} />,
    },
    {
      key: "due",
      header: "Evidence due",
      render: (d) => (
        <span className="text-sm text-text-tertiary">{formatDate(d.evidenceDueAt)}</span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      className: "text-right font-semibold tabular-nums text-white",
      render: (d) => currency(d.amount),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (d) => (
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
              {DISPUTE_STATUSES.filter((s) => s !== d.status).map((s) => (
                <DropdownMenuItem
                  key={s}
                  className="cursor-pointer gap-2 text-muted-foreground focus:bg-surface-hover focus:text-foreground"
                  onClick={() => setStatusFor(d, s)}
                >
                  Mark {s.toLowerCase()}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator className="bg-surface-strong" />
              <DropdownMenuItem
                className="cursor-pointer gap-2 text-red-300 focus:bg-red-500/10 focus:text-red-300"
                onClick={() => remove(d)}
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
        title="Disputes & Chargebacks"
        description="Track payment disputes and chargebacks, what's at stake, and when evidence is due."
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4" /> Log dispute
          </Button>
        }
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <FilterDropdown
          value={status}
          onValueChange={setStatus}
          options={DISPUTE_STATUS_FILTER_OPTIONS}
          height="h-9"
        />
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search buyer, order, reason…"
          className="w-full sm:max-w-xs"
        />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading disputes…
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(d) => d.id}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              <EmptyState
                icon={Scale}
                title={disputes.length ? "No disputes match your filters" : "No disputes"}
                description={
                  disputes.length
                    ? "Try clearing the search or filters."
                    : "Log a chargeback here to track evidence deadlines and outcomes."
                }
                action={
                  disputes.length ? null : (
                    <Button
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={() => setCreateOpen(true)}
                    >
                      <Plus className="h-4 w-4" /> Log dispute
                    </Button>
                  )
                }
              />
            </div>
          }
        />
      )}

      <NewDisputeDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        orders={orders}
        onCreate={handleCreate}
      />
    </MainScreenWrapper>
  );
}

export default DisputesScreen;
