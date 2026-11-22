"use client";

import { useState } from "react";
import { Eye, Loader2, RefreshCw, RotateCcw, Send, Smartphone } from "lucide-react";

import { DataTable, EmptyState, StatusPill, Toolbar } from "@/components/internal/shared/screen_kit";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { LoadingArea } from "@geiger/ui";
import { ActionMenu } from "@geiger/ui/action-menu";
import { Button } from "@geiger/ui/button";
import {
  PUSH_STATUS_FILTER_OPTIONS,
  PUSH_STATUS_MAP,
  PUSH_TYPE_FILTER_OPTIONS,
  canRetry,
  categoryLabel,
  formatRelativeTime,
  formatUntil,
  skipReasonLabel,
  typeLabel,
} from "./constants";
import DeliveryDrawer from "./delivery_drawer";
import { LoadError, PausedBanner } from "./shared";

function StatusCell({ item }) {
  let note = null;
  if (item.status === "skipped") {
    note = <span className="text-[11px] text-text-tertiary">{skipReasonLabel(item.skipReason)}</span>;
  } else if (item.status === "failed" && item.lastError) {
    note = (
      <span className="line-clamp-1 max-w-[14rem] text-[11px] text-red-600 dark:text-red-400" title={item.lastError}>
        {item.lastError}
      </span>
    );
  } else if (item.status === "queued" && item.sendAfter) {
    note = <span className="text-[11px] text-text-tertiary">Sends {formatUntil(item.sendAfter)}</span>;
  }
  return (
    <div className="flex flex-col items-start gap-1">
      <StatusPill status={item.status} map={PUSH_STATUS_MAP} />
      {note}
    </div>
  );
}

export default function DeliveryTab({ log, paused, canManage, testing, onTest, onRetry }) {
  // Kept as a snapshot so the drawer stays open if a refresh drops the row from the first page.
  const [opened, setOpened] = useState(null);
  const openItem = opened ? log.items.find((item) => item.id === opened.id) || opened : null;
  const filtered = log.filters.status !== "all" || log.filters.type !== "all";

  const columns = [
    {
      key: "push",
      header: "Push",
      render: (item) => (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-medium text-foreground">{typeLabel(item.type)}</span>
          {item.category ? <span className="text-xs text-text-secondary">{categoryLabel(item.category)}</span> : null}
        </div>
      ),
    },
    {
      key: "recipient",
      header: "Recipient",
      render: (item) => (
        <div className="flex min-w-0 max-w-[14rem] flex-col gap-0.5">
          <span className="truncate text-sm text-foreground">{item.memberName || item.memberEmail || "Unknown member"}</span>
          {item.memberName && item.memberEmail ? (
            <span className="truncate text-xs text-text-secondary">{item.memberEmail}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: "message",
      header: "Message",
      render: (item) =>
        item.title || item.body ? (
          <div className="flex min-w-0 max-w-[18rem] flex-col gap-0.5">
            <span className="truncate text-sm text-foreground" title={item.title}>
              {item.title || "—"}
            </span>
            {item.body ? (
              <span className="truncate text-xs text-text-secondary" title={item.body}>
                {item.body}
              </span>
            ) : null}
          </div>
        ) : (
          <span className="text-sm text-text-tertiary">Written at send time</span>
        ),
    },
    { key: "status", header: "Status", render: (item) => <StatusCell item={item} /> },
    {
      key: "created",
      header: "Created",
      render: (item) => <span className="text-sm text-text-tertiary">{formatRelativeTime(item.createdAt)}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (item) => (
        <ActionMenu
          label={`Actions for ${typeLabel(item.type)} push`}
          items={[
            { icon: Eye, label: "View details", onSelect: () => setOpened(item) },
            canManage && canRetry(item) ? { icon: RotateCcw, label: "Retry", onSelect: () => onRetry(item) } : null,
          ]}
        />
      ),
    },
  ];

  let table;
  if (log.loading) {
    table = <LoadingArea size={48} panel label="Loading pushes" />;
  } else if (log.error) {
    table = <LoadError title="Couldn't load the push log" error={log.error} onRetry={log.refresh} />;
  } else {
    table = (
      <DataTable
        columns={columns}
        data={log.items}
        getRowKey={(item) => item.id}
        onRowClick={setOpened}
        empty={
          <div className="rounded-xl border border-border bg-surface-subtle">
            <EmptyState
              icon={Smartphone}
              title={filtered ? "No pushes match your filters" : "No pushes yet"}
              description={
                filtered
                  ? "Try a different status or type."
                  : "Every push this project queues shows up here with what happened to it. Send a test push to your own phone to try it."
              }
              action={
                filtered ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      log.setFilter("status", "all");
                      log.setFilter("type", "all");
                    }}
                  >
                    Clear filters
                  </Button>
                ) : canManage ? (
                  <Button variant="outline" size="sm" onClick={onTest} disabled={testing}>
                    {testing ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                    Send test push
                  </Button>
                ) : null
              }
            />
          </div>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      {paused ? (
        <PausedBanner>New pushes are skipped until you unpause push on the Push tab.</PausedBanner>
      ) : null}

      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown
            value={log.filters.status}
            onValueChange={(value) => log.setFilter("status", value)}
            options={PUSH_STATUS_FILTER_OPTIONS}
            height="h-9"
          />
          <FilterDropdown
            value={log.filters.type}
            onValueChange={(value) => log.setFilter("type", value)}
            options={PUSH_TYPE_FILTER_OPTIONS}
            height="h-9"
          />
          <Button variant="ghost" size="sm" className="h-9" onClick={log.refresh} aria-label="Refresh pushes">
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
        </div>
      </Toolbar>

      {table}

      {!log.loading && !log.error && log.hasMore ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={log.loadMore}
            disabled={log.loadingMore}
          >
            {log.loadingMore ? <Loader2 className="size-4 animate-spin" /> : null}
            Load more
          </Button>
        </div>
      ) : null}

      <DeliveryDrawer
        item={openItem}
        canManage={canManage}
        onOpenChange={(open) => !open && setOpened(null)}
        onRetry={onRetry}
      />
    </div>
  );
}
