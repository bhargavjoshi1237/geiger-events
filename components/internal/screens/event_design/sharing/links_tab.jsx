"use client";

import React, { useMemo, useState } from "react";
import { Copy, Link2, Plus } from "lucide-react";

import { ActionMenu, Button } from "@geiger/ui";
import { DataTable, EmptyState, SearchInput, Toolbar } from "@/components/internal/shared/screen_kit";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { formatAgo, formatExpiry, shareState } from "@/lib/event_design";
import { PermissionBadge, ShareStatus } from "./share_links";

// Every share link across the project's plans: who it's for, access, views, expiry, status and actions.

const STATUS_OPTIONS = [
  { value: "all", label: "All links" },
  { value: "active", label: "Active" },
  { value: "expired", label: "Expired" },
  { value: "revoked", label: "Revoked" },
];

export function LinksTab({ tabs, shares, plansById, placeOf, now, actions, onNew, onOpenPlan }) {
  const [status, setStatus] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [search, setSearch] = useState("");

  const planOptions = useMemo(() => {
    const used = [...new Set(shares.map((s) => s.planId))].filter((id) => plansById.has(id));
    return [
      { value: "all", label: "All plans" },
      ...used.map((id) => ({ value: id, label: plansById.get(id).name || "Untitled plan" })),
    ];
  }, [shares, plansById]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return shares.filter((s) => {
      if (status !== "all" && shareState(s, now || undefined) !== status) return false;
      if (planFilter !== "all" && s.planId !== planFilter) return false;
      if (q && !`${s.label} ${plansById.get(s.planId)?.name || ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [shares, status, planFilter, search, plansById, now]);

  const columns = [
    {
      key: "link",
      header: "Link",
      render: (s) => {
        const plan = plansById.get(s.planId);
        return (
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate font-medium text-foreground">{s.label || "Untitled link"}</span>
            <button
              type="button"
              className="truncate text-left text-xs text-text-secondary hover:text-foreground hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                if (plan) onOpenPlan(plan.id);
              }}
            >
              {[plan?.name || "Deleted plan", placeOf(plan)].filter(Boolean).join(" · ")}
            </button>
          </div>
        );
      },
    },
    { key: "access", header: "Access", render: (s) => <PermissionBadge permission={s.permission} /> },
    {
      key: "views",
      header: "Views",
      render: (s) => (
        <div className="flex flex-col gap-0.5">
          <span className="tabular-nums text-foreground">{s.viewCount.toLocaleString()}</span>
          <span className="text-xs text-text-tertiary" suppressHydrationWarning>
            {s.lastViewedAt ? `Last ${formatAgo(s.lastViewedAt, now || undefined)}` : "Not opened yet"}
          </span>
        </div>
      ),
    },
    {
      key: "expires",
      header: "Expires",
      render: (s) => <span className="text-sm text-text-secondary">{formatExpiry(s.expiresAt)}</span>,
    },
    { key: "status", header: "Status", render: (s) => <ShareStatus share={s} now={now} /> },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (s) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()} role="presentation">
          {shareState(s, now || undefined) !== "revoked" ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={() => actions.copy(s)}
            >
              <Copy className="h-4 w-4" /> Copy
            </Button>
          ) : null}
          <ActionMenu label={`Actions for ${s.label || "link"}`} items={actions.menuItems(s)} />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <Toolbar>
        {tabs}
        <div className="flex min-w-0 flex-wrap items-center gap-2 max-sm:w-full sm:justify-end">
          <FilterDropdown value={status} onValueChange={setStatus} options={STATUS_OPTIONS} height="h-9" />
          <FilterDropdown value={planFilter} onValueChange={setPlanFilter} options={planOptions} height="h-9" />
          <SearchInput value={search} onChange={setSearch} placeholder="Search links…" />
        </div>
      </Toolbar>

      <DataTable
        columns={columns}
        data={filtered}
        getRowKey={(s) => s.id}
        empty={
          <div className="rounded-xl border border-border bg-surface-subtle">
            <EmptyState
              icon={Link2}
              title={shares.length ? "No links match your filters" : "No share links yet"}
              description={
                shares.length
                  ? "Try a different status, plan or search."
                  : "Send a plan to your caterer, venue or client — they open it in 2D and 3D without an account, and can comment if you allow it."
              }
              action={
                shares.length ? null : (
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={onNew}>
                    <Plus className="h-4 w-4" /> New link
                  </Button>
                )
              }
            />
          </div>
        }
      />
    </div>
  );
}

export default LinksTab;
