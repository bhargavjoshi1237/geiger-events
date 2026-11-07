"use client";

import { CircleAlert, KeySquare, ListChecks, Pencil, Plus, Power, Send, Trash2, Webhook } from "lucide-react";

import { DataTable, EmptyState, StatusPill } from "@/components/internal/shared/screen_kit";
import { ActionMenu } from "@geiger/ui/action-menu";
import { Button } from "@geiger/ui/button";
import { cn } from "@/lib/utils";
import {
  ENDPOINT_STATUS_MAP,
  endpointState,
  eventTypesSummary,
  formatRelativeTime,
  hostPath,
  successRate,
} from "./constants";

function Health({ health }) {
  const rate = successRate(health);
  if (rate === null) {
    return <span className="text-sm text-text-tertiary">{health?.pending ? `${health.pending} queued` : "No deliveries yet"}</span>;
  }
  const tone =
    rate >= 95
      ? "text-emerald-600 dark:text-emerald-400"
      : rate >= 75
        ? "text-amber-600 dark:text-amber-400"
        : "text-red-600 dark:text-red-400";
  return (
    <div className="flex flex-col gap-0.5">
      <span className={cn("text-sm font-medium tabular-nums", tone)}>{rate}% delivered</span>
      <span className="text-[11px] text-text-tertiary">
        {health.succeeded} of {health.succeeded + health.failed + health.dead} · 7 days
        {health.avgMs != null ? ` · ${health.avgMs} ms avg` : ""}
      </span>
    </div>
  );
}

export default function EndpointsTab({
  endpoints,
  health,
  canManage,
  onAdd,
  onEdit,
  onSecret,
  onToggle,
  onTest,
  onDelete,
  onViewDeliveries,
}) {
  const columns = [
    {
      key: "endpoint",
      header: "Endpoint",
      render: (e) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-muted-foreground">
            <Webhook className="h-4 w-4" />
          </div>
          <div className="flex min-w-0 max-w-[22rem] flex-col gap-1">
            <span className="truncate font-mono text-[13px] text-foreground" title={e.url}>
              {hostPath(e.url)}
            </span>
            {e.disabledReason ? (
              <span className="flex items-start gap-1 text-xs text-red-600 dark:text-red-400">
                <CircleAlert className="mt-0.5 size-3 shrink-0" />
                <span className="line-clamp-2">{e.disabledReason}</span>
              </span>
            ) : (
              <span className="truncate text-xs text-text-secondary">{e.description || "No description"}</span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "events",
      header: "Events",
      render: (e) => <span className="text-sm text-text-secondary">{eventTypesSummary(e.eventTypes)}</span>,
    },
    { key: "health", header: "Health", render: (e) => <Health health={health[e.id]} /> },
    {
      key: "last",
      header: "Last delivery",
      render: (e) => (
        <span className="text-sm text-text-secondary">
          {e.lastDeliveryAt ? formatRelativeTime(e.lastDeliveryAt) : "Never"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (e) => <StatusPill status={endpointState(e)} map={ENDPOINT_STATUS_MAP} />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (e) => (
        <ActionMenu
          label={`Actions for ${hostPath(e.url)}`}
          contentClassName="w-48"
          items={[
            canManage ? { icon: Send, label: "Send test event", onSelect: () => onTest(e) } : null,
            { icon: ListChecks, label: "View deliveries", onSelect: () => onViewDeliveries(e) },
            canManage ? { icon: Pencil, label: "Edit", onSelect: () => onEdit(e) } : null,
            { icon: KeySquare, label: "Signing secret", onSelect: () => onSecret(e) },
            canManage
              ? { icon: Power, label: e.active ? "Disable" : "Enable", onSelect: () => onToggle(e) }
              : null,
            canManage ? { separator: true } : null,
            canManage ? { icon: Trash2, label: "Delete", destructive: true, onSelect: () => onDelete(e) } : null,
          ]}
        />
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={endpoints}
      getRowKey={(e) => e.id}
      onRowClick={canManage ? onEdit : onViewDeliveries}
      empty={
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={Webhook}
            title="No webhook endpoints yet"
            description="Add a URL to get orders, refunds, registrations and check-ins pushed to your server as they happen."
            action={
              canManage ? (
                <Button variant="outline" size="sm" onClick={onAdd}>
                  <Plus className="size-3.5" />
                  Add endpoint
                </Button>
              ) : null
            }
          />
        </div>
      }
    />
  );
}
