"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { Ban, Cpu, Download, Loader2, PanelRightOpen, Plus, ShieldOff, Undo2, X } from "lucide-react";

import {
  DataTable,
  EmptyState,
  SearchInput,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { Checkbox } from "@geiger/ui/checkbox";
import { ActionMenu } from "@geiger/ui/action-menu";
import { LogoLoading } from "@geiger/ui";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { ListPagination, usePagination } from "@/components/internal/shared/pagination";
import { setBadgeStatus } from "@/lib/supabase/smart_badges";
import { compareSerial } from "@/lib/smart_badges/uid";
import { BADGE_STATUS_FILTER_OPTIONS, BADGE_STATUS_MAP, holderOf, plural, timeAgo } from "./constants";
import { exportPrinterCsv } from "./export";

const STATUS_ORDER = { active: 0, lost: 1, revoked: 2, unassigned: 3, replaced: 4 };

export function BadgesTab({
  badges,
  batches,
  batchesById,
  rosterByKey,
  tapSummary,
  loading,
  eventName,
  onOpen,
  onAdd,
  onChanged,
}) {
  const [status, setStatus] = useState("all");
  const [batch, setBatch] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const batchOptions = useMemo(
    () => [
      { value: "all", label: "All batches" },
      { value: "none", label: "No batch" },
      ...batches.map((b) => ({ value: b.id, label: b.name })),
    ],
    [batches],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const compact = q.replace(/[^0-9a-z]/g, "");
    return badges
      .filter((b) => {
        if (status === "uid_pending" ? !!b.uid : status !== "all" && b.status !== status) return false;
        if (batch === "none" ? !!b.batchId : batch !== "all" && b.batchId !== batch) return false;
        if (!q) return true;
        const holder = holderOf(b, rosterByKey);
        return (
          (compact && b.uid.toLowerCase().includes(compact)) ||
          b.serial.toLowerCase().includes(q) ||
          (holder?.name || "").toLowerCase().includes(q) ||
          (holder?.email || "").toLowerCase().includes(q) ||
          (holder?.company || "").toLowerCase().includes(q)
        );
      })
      .sort(
        (a, b) =>
          (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) ||
          compareSerial(a.serial, b.serial) ||
          compareSerial(a.uid, b.uid),
      );
  }, [badges, status, batch, search, rosterByKey]);

  const pager = usePagination(rows, { resetKey: `${status}|${batch}|${search}` });
  const visibleIds = useMemo(() => new Set(rows.map((r) => r.id)), [rows]);
  const chosen = useMemo(() => rows.filter((r) => selected.has(r.id)), [rows, selected]);
  const pageIds = pager.pageItems.map((r) => r.id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  const toggleOne = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const togglePage = () =>
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => visibleIds.has(id)));
      if (allOnPage) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });

  const exportRows = (list) => {
    if (!list.length) {
      toast.error("No badges to export.");
      return;
    }
    const n = exportPrinterCsv(list, { rosterByKey, batchesById, eventName });
    toast.success(`Exported ${plural(n, "badge")}.`);
  };

  const bulkStatus = async (next) => {
    const targets = chosen.filter((b) =>
      next === "active" ? b.status === "lost" || b.status === "revoked" : b.status === "active" || (next === "revoked" && b.status === "unassigned"),
    );
    if (!targets.length) {
      toast.error("None of the selected badges can change to that status.");
      return;
    }
    setBulkBusy(true);
    let done = 0;
    for (let i = 0; i < targets.length; i += 10) {
      const results = await Promise.all(
        targets.slice(i, i + 10).map((b) => setBadgeStatus(b.id, next, "Bulk update")),
      );
      done += results.filter((r) => r?.ok).length;
    }
    setBulkBusy(false);
    setSelected(new Set());
    if (done) toast.success(`${plural(done, "badge")} updated.`);
    if (done < targets.length) toast.error(`${targets.length - done} couldn't be updated.`);
    onChanged();
  };

  const singleStatus = async (badge, next) => {
    const res = await setBadgeStatus(badge.id, next, "");
    if (!res?.ok) {
      toast.error("Couldn't update the badge.");
      return;
    }
    toast.success(next === "active" ? "Badge reactivated." : next === "lost" ? "Badge marked lost." : "Badge revoked.");
    onChanged();
  };

  const columns = [
    {
      key: "select",
      header: <Checkbox checked={allOnPage} onCheckedChange={togglePage} aria-label="Select page" />,
      className: "w-10",
      headClassName: "w-10",
      render: (b) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={selected.has(b.id)}
            onCheckedChange={() => toggleOne(b.id)}
            aria-label={`Select ${b.serial || b.uid}`}
          />
        </div>
      ),
    },
    {
      key: "badge",
      header: "Badge",
      className: "whitespace-nowrap",
      headClassName: "whitespace-nowrap",
      render: (b) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-sm font-medium text-foreground">{b.serial || b.uid || "—"}</span>
          <span className="font-mono text-[11px] text-text-tertiary">
            {b.serial ? b.uid || "UID pending" : b.uid ? "No serial" : "UID pending"}
          </span>
        </div>
      ),
    },
    {
      key: "holder",
      header: "Holder",
      className: "w-full",
      headClassName: "w-full",
      render: (b) => {
        const holder = holderOf(b, rosterByKey);
        if (!holder) return <span className="text-sm text-text-tertiary">Spare</span>;
        return (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{holder.name}</p>
            <p className="truncate text-xs text-text-secondary">
              {[holder.role && holder.role !== "Attendee" ? holder.role : null, holder.tier, holder.email]
                .filter(Boolean)
                .join(" · ") || "—"}
            </p>
          </div>
        );
      },
    },
    {
      key: "batch",
      header: "Batch",
      className: "whitespace-nowrap text-sm text-text-secondary",
      headClassName: "whitespace-nowrap",
      render: (b) => batchesById.get(b.batchId)?.name || "—",
    },
    {
      key: "status",
      header: "Status",
      className: "whitespace-nowrap",
      headClassName: "whitespace-nowrap",
      render: (b) => <StatusPill status={b.status} map={BADGE_STATUS_MAP} />,
    },
    {
      key: "taps",
      header: "Taps",
      align: "right",
      className: "whitespace-nowrap text-right tabular-nums",
      headClassName: "whitespace-nowrap",
      render: (b) => tapSummary.get(b.id)?.taps || <span className="text-text-tertiary">0</span>,
    },
    {
      key: "last",
      header: "Last tap",
      align: "right",
      className: "whitespace-nowrap text-right text-xs text-text-secondary",
      headClassName: "whitespace-nowrap",
      render: (b) => timeAgo(tapSummary.get(b.id)?.lastTapAt) || "—",
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (b) => (
        <ActionMenu
          label={`Actions for ${b.serial || b.uid}`}
          items={[
            { icon: PanelRightOpen, label: "Open badge", onSelect: () => onOpen(b) },
            b.status === "active" && { icon: ShieldOff, label: "Mark lost", onSelect: () => singleStatus(b, "lost") },
            (b.status === "lost" || b.status === "revoked") && {
              icon: Undo2,
              label: "Reactivate",
              onSelect: () => singleStatus(b, "active"),
            },
            { separator: true },
            (b.status === "active" || b.status === "unassigned") && {
              icon: Ban,
              label: "Revoke",
              variant: "destructive",
              onSelect: () => singleStatus(b, "revoked"),
            },
          ]}
        />
      ),
    },
  ];

  const ghost = "border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground";

  return (
    <div className="min-w-0 space-y-4">
      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown value={status} onValueChange={setStatus} options={BADGE_STATUS_FILTER_OPTIONS} height="h-9" />
          <FilterDropdown value={batch} onValueChange={setBatch} options={batchOptions} height="h-9" />
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Search UID, serial or holder…" />
          <Button variant="outline" size="sm" className={`h-9 ${ghost}`} onClick={() => exportRows(rows)}>
            <Download className="h-4 w-4" /> Export
          </Button>
        </div>
      </Toolbar>

      {chosen.length ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface-subtle px-4 py-3">
          <span className="text-sm font-medium tabular-nums text-foreground">{chosen.length} selected</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" className={ghost} disabled={bulkBusy} onClick={() => exportRows(chosen)}>
              <Download className="h-4 w-4" /> Export for printer
            </Button>
            <Button size="sm" variant="outline" className={ghost} disabled={bulkBusy} onClick={() => bulkStatus("lost")}>
              {bulkBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />} Mark lost
            </Button>
            <Button size="sm" variant="outline" className={ghost} disabled={bulkBusy} onClick={() => bulkStatus("revoked")}>
              <Ban className="h-4 w-4" /> Revoke
            </Button>
            <Button size="sm" variant="outline" className={ghost} disabled={bulkBusy} onClick={() => bulkStatus("active")}>
              <Undo2 className="h-4 w-4" /> Reactivate
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
              disabled={bulkBusy}
              onClick={() => setSelected(new Set())}
            >
              <X className="h-4 w-4" /> Clear
            </Button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={48} label="Loading badges" />
        </div>
      ) : (
        <div className="space-y-5">
          <DataTable
            columns={columns}
            data={pager.pageItems}
            getRowKey={(b) => b.id}
            onRowClick={onOpen}
            empty={
              <div className="rounded-xl border border-border bg-surface-subtle">
                <EmptyState
                  icon={Cpu}
                  title={badges.length ? "No badges match" : "No smart badges yet"}
                  description={
                    badges.length
                      ? "Try a different status, batch or search."
                      : "Load the chip UIDs your vendor shipped, generate a serial range, or bind badges one by one at the binding desk."
                  }
                  action={
                    badges.length ? (
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setStatus("all");
                          setBatch("all");
                          setSearch("");
                        }}
                      >
                        Clear filters
                      </Button>
                    ) : (
                      <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90" onClick={onAdd}>
                        <Plus className="h-4 w-4" /> Add badges
                      </Button>
                    )
                  }
                />
              </div>
            }
          />
          {rows.length ? <ListPagination {...pager} itemLabel="badges" /> : null}
        </div>
      )}
    </div>
  );
}

export default BadgesTab;
