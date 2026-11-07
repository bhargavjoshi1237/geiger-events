"use client";

import React from "react";
import { ShieldAlert } from "lucide-react";

import { DataTable, EmptyState, SectionCard } from "@/components/internal/shared/screen_kit";
import { ListPagination, usePagination } from "@/components/internal/shared/pagination";

const when = (iso) =>
  iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";

// Every supervisor admit past a hard cap, with the reason given at the gate.
export function OverrideLog({ overrides, resetKey }) {
  const pager = usePagination(overrides, { pageSize: 10, resetKey });

  const columns = [
    { key: "time", header: "When", className: "whitespace-nowrap text-sm text-foreground", render: (o) => when(o.createdAt) },
    { key: "zone", header: "Area", className: "whitespace-nowrap text-sm text-text-secondary", render: (o) => o.zone || "Venue" },
    {
      key: "who",
      header: "Admitted",
      render: (o) => (
        <span className="text-sm text-foreground">
          {o.attendeeName || "Unnamed"}
          {o.partySize > 1 ? <span className="text-text-secondary"> · party of {o.partySize}</span> : null}
        </span>
      ),
    },
    {
      key: "count",
      header: "At",
      className: "whitespace-nowrap text-sm tabular-nums text-text-secondary",
      render: (o) => `${o.occupancy.toLocaleString("en-US")} / ${o.cap.toLocaleString("en-US")}`,
    },
    { key: "reason", header: "Reason", render: (o) => <span className="text-sm text-text-secondary">{o.reason || "—"}</span> },
    {
      key: "by",
      header: "By",
      className: "whitespace-nowrap text-sm text-text-secondary",
      render: (o) => [o.roleName, o.staff && o.staff !== o.roleName ? o.staff : ""].filter(Boolean).join(" · ") || "—",
    },
  ];

  return (
    <SectionCard title="Override log" description="Supervisors admitting past a hard cap, with their reason." bodyPadding={false}>
      {overrides.length ? (
        <div className="space-y-4 p-4">
          <DataTable columns={columns} data={pager.pageItems} getRowKey={(o) => o.id} />
          <ListPagination {...pager} itemLabel="overrides" />
        </div>
      ) : (
        <EmptyState
          icon={ShieldAlert}
          title="No overrides"
          description="When a supervisor admits someone into a full area, it's recorded here with their reason."
        />
      )}
    </SectionCard>
  );
}

export default OverrideLog;
