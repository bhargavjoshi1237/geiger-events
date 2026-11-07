"use client";

import { useMemo, useState } from "react";
import { Eye, ListChecks, RefreshCw, Repeat, RotateCcw } from "lucide-react";

import {
  DataTable,
  EmptyState,
  SearchInput,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import { ListPagination, usePagination } from "@/components/internal/shared/pagination";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { ActionMenu } from "@geiger/ui/action-menu";
import { Badge } from "@geiger/ui/badge";
import { Button } from "@geiger/ui/button";
import { MAX_ATTEMPTS, TEST_EVENT_TYPE, WEBHOOK_EVENT_TYPES } from "@/lib/api_webhooks/catalog";
import {
  DELIVERY_STATUS_FILTER_OPTIONS,
  DELIVERY_STATUS_MAP,
  eventTypeLabel,
  formatRelativeTime,
  formatUntil,
  hostPath,
  shortId,
} from "./constants";

const TYPE_FILTER_OPTIONS = [
  { value: "all", label: "All event types" },
  ...WEBHOOK_EVENT_TYPES.map((t) => ({ value: t.type, label: t.label })),
  { value: TEST_EVENT_TYPE, label: "Test events" },
];

function deliveryStats(health) {
  const totals = { succeeded: 0, failed: 0, dead: 0, pending: 0 };
  for (const h of Object.values(health || {})) {
    totals.succeeded += h.succeeded;
    totals.failed += h.failed;
    totals.dead += h.dead;
    totals.pending += h.pending;
  }
  const settled = totals.succeeded + totals.failed + totals.dead;
  return [
    { label: "Delivered · 7d", value: totals.succeeded.toLocaleString() },
    { label: "Success rate", value: settled ? `${Math.round((totals.succeeded / settled) * 100)}%` : "—" },
    { label: "Retrying", value: totals.failed.toLocaleString() },
    { label: "Failed", value: totals.dead.toLocaleString() },
  ];
}

function ResponseCell({ d }) {
  if (d.status === "pending" && !d.attempts) return <span className="text-sm text-text-tertiary">Waiting</span>;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-sm text-foreground">
        {d.responseStatus ? d.responseStatus : d.lastError ? "No response" : "—"}
      </span>
      {d.responseMs != null ? <span className="text-[11px] text-text-tertiary">{d.responseMs} ms</span> : null}
    </div>
  );
}

export default function DeliveriesTab({
  deliveries,
  endpoints,
  health,
  canManage,
  initialEndpoint = "all",
  onOpen,
  onRetry,
  onReplay,
  onRefresh,
  onAddEndpoint,
}) {
  const [status, setStatus] = useState("all");
  const [endpoint, setEndpoint] = useState(initialEndpoint);
  const [type, setType] = useState("all");
  const [search, setSearch] = useState("");

  const endpointOptions = useMemo(
    () => [
      { value: "all", label: "All endpoints" },
      ...endpoints.map((e) => ({ value: e.id, label: hostPath(e.url) })),
    ],
    [endpoints],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return deliveries.filter((d) => {
      if (status !== "all" && d.status !== status) return false;
      if (endpoint !== "all" && d.endpointId !== endpoint) return false;
      if (type !== "all" && d.eventType !== type) return false;
      if (q && !`${d.eventType} ${d.eventId} ${d.id} ${d.endpointUrl} ${d.lastError}`.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [deliveries, status, endpoint, type, search]);

  const pager = usePagination(filtered, { resetKey: `${status}|${endpoint}|${type}|${search}` });
  const stats = useMemo(() => deliveryStats(health), [health]);

  const columns = [
    {
      key: "event",
      header: "Event",
      render: (d) => (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-1.5 font-medium text-foreground">
            {eventTypeLabel(d.eventType)}
            {d.origin !== "event" ? <Badge variant="outline">{d.origin === "test" ? "Test" : "Replay"}</Badge> : null}
          </span>
          <span className="font-mono text-xs text-text-secondary">
            {d.eventType} · {shortId(d.eventId)}
          </span>
        </div>
      ),
    },
    {
      key: "endpoint",
      header: "Endpoint",
      render: (d) => (
        <span className="block max-w-[16rem] truncate font-mono text-xs text-text-secondary" title={d.endpointUrl}>
          {hostPath(d.endpointUrl) || "Deleted endpoint"}
        </span>
      ),
    },
    { key: "status", header: "Status", render: (d) => <StatusPill status={d.status} map={DELIVERY_STATUS_MAP} /> },
    { key: "response", header: "Response", render: (d) => <ResponseCell d={d} /> },
    {
      key: "attempts",
      header: "Attempts",
      render: (d) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-sm tabular-nums text-text-secondary">
            {d.attempts} of {Math.max(MAX_ATTEMPTS, d.attempts)}
          </span>
          {d.status === "failed" && d.nextAttemptAt ? (
            <span className="text-[11px] text-text-tertiary">Next {formatUntil(d.nextAttemptAt)}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: "when",
      header: "Created",
      render: (d) => <span className="text-sm text-text-tertiary">{formatRelativeTime(d.createdAt)}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (d) => (
        <ActionMenu
          label={`Actions for delivery ${shortId(d.id)}`}
          items={[
            { icon: Eye, label: "View details", onSelect: () => onOpen(d) },
            canManage && d.status !== "succeeded"
              ? { icon: RotateCcw, label: "Retry now", onSelect: () => onRetry(d) }
              : null,
            canManage ? { icon: Repeat, label: "Replay", onSelect: () => onReplay(d) } : null,
          ]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown value={status} onValueChange={setStatus} options={DELIVERY_STATUS_FILTER_OPTIONS} height="h-9" />
          <FilterDropdown value={endpoint} onValueChange={setEndpoint} options={endpointOptions} height="h-9" />
          <FilterDropdown value={type} onValueChange={setType} options={TYPE_FILTER_OPTIONS} height="h-9" />
          <Button variant="ghost" size="sm" className="h-9" onClick={onRefresh} aria-label="Refresh deliveries">
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search event, ID, URL…" />
      </Toolbar>

      <DataTable
        columns={columns}
        data={pager.pageItems}
        getRowKey={(d) => d.id}
        onRowClick={onOpen}
        empty={
          <div className="rounded-xl border border-border bg-surface-subtle">
            <EmptyState
              icon={ListChecks}
              title={deliveries.length ? "No deliveries match your filters" : "No deliveries yet"}
              description={
                deliveries.length
                  ? "Try clearing the search or filters."
                  : endpoints.length
                    ? "Deliveries appear here as soon as a subscribed event happens. Send a test event to try it now."
                    : "Add a webhook endpoint, then every send and its response will be logged here."
              }
              action={
                !deliveries.length && !endpoints.length && canManage ? (
                  <Button variant="outline" size="sm" onClick={onAddEndpoint}>
                    Add endpoint
                  </Button>
                ) : null
              }
            />
          </div>
        }
      />
      <ListPagination {...pager} itemLabel="deliveries" />
      {deliveries.length >= 500 ? (
        <p className="text-xs text-text-tertiary">Showing the latest 500 deliveries. Older ones are kept for 30 days.</p>
      ) : null}
    </div>
  );
}
