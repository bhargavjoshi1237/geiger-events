"use client";

import React from "react";
import { History } from "lucide-react";

import { DataTable, EmptyState } from "@/components/internal/shared/screen_kit";
import { ListPagination, usePagination } from "@/components/internal/shared/pagination";
import { clockTime, deviceName } from "./shared";

// How long the oldest scan in a batch waited on the device before reaching the server.
function waited(entry) {
  if (!entry.oldestScanAt || !entry.createdAt) return "—";
  const m = Math.round((new Date(entry.createdAt) - new Date(entry.oldestScanAt)) / 60000);
  if (m < 1) return "< 1m";
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

const num = (key, warn) => ({
  key,
  header: key === "exited" ? "Exits" : key.charAt(0).toUpperCase() + key.slice(1),
  align: "right",
  className: "text-right tabular-nums",
  render: (e) => (
    <span className={warn && e[key] > 0 ? "font-semibold text-amber-700 dark:text-amber-300" : "text-text-secondary"}>
      {e[key].toLocaleString("en-US")}
    </span>
  ),
});

export function SyncLogTab({ log, devicesById, resetKey }) {
  const pager = usePagination(log, { resetKey });

  const columns = [
    {
      key: "time",
      header: "Synced",
      className: "whitespace-nowrap",
      render: (e) => <span className="text-foreground">{clockTime(e.createdAt)}</span>,
    },
    {
      key: "device",
      header: "Device",
      render: (e) => <span className="text-sm text-text-secondary">{deviceName(devicesById, e.deviceId)}</span>,
    },
    {
      key: "waited",
      header: "Waited",
      className: "whitespace-nowrap text-sm text-text-secondary",
      render: waited,
    },
    num("items"),
    num("admitted"),
    num("exited"),
    num("duplicates", true),
    num("conflicts", true),
    num("rejected", true),
  ];

  return (
    <div className="space-y-5">
      <DataTable
        columns={columns}
        data={pager.pageItems}
        getRowKey={(e) => e.id}
        empty={
          <div className="rounded-xl border border-border bg-surface-subtle">
            <EmptyState
              icon={History}
              title="No offline syncs yet"
              description="Each time a device comes back online and sends its queued scans, the batch is logged here."
            />
          </div>
        }
      />
      <ListPagination {...pager} itemLabel="syncs" />
    </div>
  );
}

export default SyncLogTab;
