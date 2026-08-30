"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Repeat,
  RotateCcw,
  Settings2,
  ShoppingBag,
} from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  EmptyState,
  Field,
  ScreenHeader,
  SearchInput,
  SettingsList,
  SettingRow,
  SectionCard,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import { useProject } from "@/context/project-context";
import { listEvents } from "@/lib/supabase/events";
import { listProjectOrders } from "@/lib/supabase/orders";
import { RecordsScreen } from "./records_kit";
import { Segmented, NumField as Num } from "./controls";
import { currency, formatDate } from "./constants";

// --- Order policies (attachable) ---------------------------------------------

const KINDS = [
  {
    value: "policy",
    label: "Order policy",
    defaultConfig: {
      selfService: true,
      refundPolicy: "partial",
      refundApproval: "manual",
      refundWindowDays: 7,
      allowNameChange: true,
      allowTicketTransfer: false,
    },
  },
];

function summarizePolicy(r) {
  const c = r.config || {};
  const refund =
    c.refundPolicy === "none"
      ? "No refunds"
      : `${c.refundPolicy === "full" ? "Full" : "Partial"} refunds`;
  return `${refund} · transfers ${c.allowTicketTransfer ? "on" : "off"}`;
}

// --- Policy edit sections ----------------------------------------------------
// records_kit renders each as an element, never calls it.

function SelfServiceSection({ config, setConfig }) {
  const set = (patch) => setConfig({ ...config, ...patch });

  return (
    <SectionCard bare>
      <SettingsList>
        <SettingRow
          title="Let buyers manage their order"
          description="Update details and download tickets from their confirmation link."
          checked={config.selfService ?? true}
          onCheckedChange={(v) => set({ selfService: v })}
        />
      </SettingsList>
    </SectionCard>
  );
}

function PolicyRefundsSection({ config, setConfig }) {
  const set = (patch) => setConfig({ ...config, ...patch });

  return (
    <div className="space-y-6">
      <SectionCard bare>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Policy">
            <Select
              value={config.refundPolicy || "partial"}
              onValueChange={(v) => set({ refundPolicy: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No refunds</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="full">Full</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {config.refundPolicy !== "none" ? (
            <Num
              label="Request window"
              hint="Days before the event."
              value={config.refundWindowDays ?? 7}
              onChange={(v) => set({ refundWindowDays: v })}
            />
          ) : null}
        </div>
      </SectionCard>

      {config.refundPolicy !== "none" ? (
        <SectionCard bare>
          <Field
            label="Approval"
            hint="Auto-approve eligible requests, or review each one."
          >
            <Segmented
              value={config.refundApproval || "manual"}
              onChange={(v) => set({ refundApproval: v })}
              options={[
                { value: "auto", label: "Automatic" },
                { value: "manual", label: "Manual review" },
              ]}
            />
          </Field>
        </SectionCard>
      ) : null}
    </div>
  );
}

function PolicyTransfersSection({ config, setConfig }) {
  const set = (patch) => setConfig({ ...config, ...patch });

  return (
    <SectionCard bare>
      <SettingsList>
        <SettingRow
          title="Allow name changes"
          checked={config.allowNameChange ?? true}
          onCheckedChange={(v) => set({ allowNameChange: v })}
        />
        <SettingRow
          title="Allow ticket transfer"
          checked={config.allowTicketTransfer ?? false}
          onCheckedChange={(v) => set({ allowTicketTransfer: v })}
        />
      </SettingsList>
    </SectionCard>
  );
}

const POLICY_SECTIONS = [
  {
    key: "selfService",
    label: "Self-service",
    icon: Settings2,
    desc: "What buyers can change about their order themselves.",
    render: SelfServiceSection,
  },
  {
    key: "refunds",
    label: "Refunds",
    icon: RotateCcw,
    desc: "Your refund policy and how requests are handled.",
    render: PolicyRefundsSection,
  },
  {
    key: "transfers",
    label: "Transfers",
    icon: Repeat,
    desc: "Whether attendees can hand a ticket to someone else.",
    render: PolicyTransfersSection,
  },
];

// --- View switch -------------------------------------------------------------

function ViewTabs({ view, setView }) {
  return (
    <div className="w-fit">
      <Segmented
        value={view}
        onChange={setView}
        options={[
          { value: "policies", label: "Policies" },
          { value: "orders", label: "Orders" },
        ]}
      />
    </div>
  );
}

// --- Cross-event orders list -------------------------------------------------

function OrdersListView({ tabs }) {
  const { projectId } = useProject();
  const [orders, setOrders] = useState([]);
  const [eventNames, setEventNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) =>
      q
        ? `${o.name} ${o.email} ${eventNames[o.eventId] || ""}`
            .toLowerCase()
            .includes(q)
        : true,
    );
  }, [orders, search, eventNames]);

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Orders & Attendees"
        description="Every ticket order across your events."
      />
      <Toolbar>
        {tabs}
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search name, email, event…"
        />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading orders…
        </div>
      ) : filtered.length ? (
        <div className="overflow-hidden rounded-xl border border-border bg-surface-subtle">
          <div className="divide-y divide-border">
            {filtered.map((o) => (
              <div
                key={o.id}
                className="flex items-center gap-3 px-4 py-3 text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {o.name || "Unnamed"}
                  </p>
                  <p className="truncate text-xs text-text-secondary">
                    {eventNames[o.eventId] || "—"} · {o.ticket} ×{o.quantity}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-emerald-400 tabular-nums">
                    {currency(o.total)}
                  </p>
                  <p className="text-xs text-text-tertiary">
                    {formatDate(o.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={ShoppingBag}
            title={orders.length ? "No orders match your search" : "No orders yet"}
            description={
              orders.length
                ? "Try a different search."
                : "Ticket orders from your events will appear here."
            }
          />
        </div>
      )}
    </MainScreenWrapper>
  );
}

// --- Screen (tabbed: Policies + Orders) --------------------------------------

export function OrdersAttendeesScreen() {
  const [view, setView] = useState("policies");
  const tabs = <ViewTabs view={view} setView={setView} />;

  if (view === "orders") {
    return <OrdersListView tabs={tabs} />;
  }

  return (
    <RecordsScreen
      module="order_policy"
      title="Orders & Attendees"
      description="Reusable order policies — refunds, transfers, and self-service — that you attach to events."
      singular="policy"
      icon={ShoppingBag}
      kinds={KINDS}
      summarize={summarizePolicy}
      sections={POLICY_SECTIONS}
      headerExtra={tabs}
    />
  );
}

export default OrdersAttendeesScreen;
