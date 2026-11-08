"use client";

import React, { useMemo, useState } from "react";
import { ArrowUpRight, Eye, History, PencilLine } from "lucide-react";

import { ActionMenu, Badge } from "@geiger/ui";
import { DataTable, EmptyState, SearchInput, Toolbar } from "@/components/internal/shared/screen_kit";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { formatAgo } from "@/lib/event_design";

// Recent saves across every plan, newest first, with preview and restore.

export function ActivityTab({ tabs, versions, plansById, placeOf, now, onPreview, onOpenPlan, onEditNote }) {
  const [planFilter, setPlanFilter] = useState("all");
  const [search, setSearch] = useState("");

  // Seat change against the previous loaded version of the same plan.
  const rows = useMemo(() => {
    const byPlan = new Map();
    for (const v of versions) {
      if (!byPlan.has(v.planId)) byPlan.set(v.planId, []);
      byPlan.get(v.planId).push(v);
    }
    const previous = new Map();
    for (const list of byPlan.values()) {
      const sorted = [...list].sort((a, b) => a.version - b.version);
      sorted.forEach((v, i) => previous.set(v.id, i > 0 ? sorted[i - 1] : null));
    }
    return versions.map((v) => ({ ...v, plan: plansById.get(v.planId) || null, previous: previous.get(v.id) }));
  }, [versions, plansById]);

  const planOptions = useMemo(() => {
    const used = [...new Set(versions.map((v) => v.planId))].filter((id) => plansById.has(id));
    return [
      { value: "all", label: "All plans" },
      ...used.map((id) => ({ value: id, label: plansById.get(id).name || "Untitled plan" })),
    ];
  }, [versions, plansById]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((v) => {
      if (!v.plan) return false;
      if (planFilter !== "all" && v.planId !== planFilter) return false;
      if (q && !`${v.plan.name} ${v.note} ${v.authorName}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, planFilter, search]);

  const columns = [
    {
      key: "plan",
      header: "Plan",
      render: (v) => (
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate font-medium text-foreground">{v.plan.name || "Untitled plan"}</span>
          <span className="truncate text-xs text-text-secondary">{placeOf(v.plan) || "No venue"}</span>
        </div>
      ),
    },
    {
      key: "version",
      header: "Version",
      render: (v) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold tabular-nums text-foreground">v{v.version}</span>
          {v.version === v.plan.version ? <Badge variant="success">Current</Badge> : null}
          {v.restoredFrom ? <Badge variant="info">Restored from v{v.restoredFrom}</Badge> : null}
        </div>
      ),
    },
    {
      key: "by",
      header: "By",
      render: (v) => <span className="text-sm text-text-secondary">{v.authorName || "Teammate"}</span>,
    },
    {
      key: "change",
      header: "Layout",
      render: (v) => {
        const delta = v.previous ? v.seatCount - v.previous.seatCount : 0;
        return (
          <div className="flex flex-col gap-0.5 text-sm tabular-nums">
            <span className="text-foreground">
              {v.seatCount.toLocaleString()} seats
              {delta ? (
                <span className={delta > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                  {" "}
                  ({delta > 0 ? "+" : ""}
                  {delta})
                </span>
              ) : null}
            </span>
            <span className="text-xs text-text-tertiary">{v.objectCount} objects</span>
          </div>
        );
      },
    },
    {
      key: "note",
      header: "Note",
      render: (v) => <span className="line-clamp-2 max-w-xs text-sm text-text-secondary">{v.note || "—"}</span>,
    },
    {
      key: "when",
      header: "Saved",
      align: "right",
      className: "text-right text-text-tertiary",
      render: (v) => (
        <span className="text-xs" suppressHydrationWarning>
          {formatAgo(v.createdAt, now || undefined)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (v) => (
        <div onClick={(e) => e.stopPropagation()} role="presentation">
          <ActionMenu
            label={`Actions for version ${v.version}`}
            items={[
              { icon: Eye, label: "Preview", onSelect: () => onPreview(v) },
              v.version !== v.plan.version && { icon: History, label: "Restore…", onSelect: () => onPreview(v) },
              { icon: PencilLine, label: v.note ? "Edit note" : "Add note", onSelect: () => onEditNote(v) },
              { separator: true },
              { icon: ArrowUpRight, label: "Open plan", onSelect: () => onOpenPlan(v.planId) },
            ]}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <Toolbar>
        {tabs}
        <div className="flex min-w-0 flex-wrap items-center gap-2 max-sm:w-full sm:justify-end">
          <FilterDropdown value={planFilter} onValueChange={setPlanFilter} options={planOptions} height="h-9" />
          <SearchInput value={search} onChange={setSearch} placeholder="Search notes or people…" />
        </div>
      </Toolbar>

      <DataTable
        columns={columns}
        data={filtered}
        getRowKey={(v) => v.id}
        onRowClick={(v) => onPreview(v)}
        empty={
          <div className="rounded-xl border border-border bg-surface-subtle">
            <EmptyState
              icon={History}
              title={versions.length ? "No versions match your filters" : "No saved versions yet"}
              description={
                versions.length
                  ? "Try a different plan or search."
                  : "Every save of a floor plan is kept as a version you can preview and restore."
              }
            />
          </div>
        }
      />
    </div>
  );
}

export default ActivityTab;
