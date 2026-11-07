"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, Layers, ListOrdered, Plus, Trash2, Wand2 } from "lucide-react";

import { DataTable, EmptyState, StatusPill } from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { ActionMenu } from "@geiger/ui/action-menu";
import { LogoLoading } from "@geiger/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { deleteBatch } from "@/lib/supabase/smart_badges";
import { BATCH_SOURCE_MAP, formatDateTime, plural } from "./constants";
import { exportOrderSheetCsv, exportPrinterCsv } from "./export";

export function BatchesTab({ batches, badges, batchesById, rosterByKey, loading, eventName, onAdd, onAssign, onChanged }) {
  const [deleteTarget, setDeleteTarget] = useState(null);

  const rows = useMemo(() => {
    const counts = new Map();
    for (const b of badges) {
      if (!b.batchId) continue;
      if (!counts.has(b.batchId)) counts.set(b.batchId, { total: 0, bound: 0, spare: 0, pending: 0, dead: 0, list: [] });
      const c = counts.get(b.batchId);
      c.total += 1;
      c.list.push(b);
      if (b.status === "unassigned") c.spare += 1;
      else if (b.status === "active") c.bound += 1;
      else c.dead += 1;
      if (!b.uid) c.pending += 1;
    }
    return batches.map((batch) => ({
      ...batch,
      counts: counts.get(batch.id) || { total: 0, bound: 0, spare: 0, pending: 0, dead: 0, list: [] },
    }));
  }, [batches, badges]);

  const remove = async () => {
    const target = deleteTarget;
    setDeleteTarget(null);
    const ok = await deleteBatch(target.id);
    if (!ok) {
      toast.error("Couldn't delete the batch.");
      return;
    }
    toast.success(`Deleted "${target.name}".`);
    onChanged();
  };

  const columns = [
    {
      key: "name",
      header: "Batch",
      className: "w-full",
      headClassName: "w-full",
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{r.name}</p>
          <p className="truncate text-xs text-text-secondary">
            {formatDateTime(r.createdAt)}
            {r.source === "generated" && r.serialStart != null
              ? ` · ${r.serialPrefix}${String(r.serialStart).padStart(r.serialDigits || 0, "0")} onwards`
              : ""}
          </p>
        </div>
      ),
    },
    {
      key: "source",
      header: "Source",
      className: "whitespace-nowrap",
      headClassName: "whitespace-nowrap",
      render: (r) => <StatusPill status={r.source} map={BATCH_SOURCE_MAP} />,
    },
    {
      key: "total",
      header: "Badges",
      align: "right",
      className: "whitespace-nowrap text-right tabular-nums font-semibold text-foreground",
      headClassName: "whitespace-nowrap",
      render: (r) => r.counts.total,
    },
    {
      key: "bound",
      header: "Bound",
      align: "right",
      className: "whitespace-nowrap text-right tabular-nums text-text-secondary",
      headClassName: "whitespace-nowrap",
      render: (r) => r.counts.bound,
    },
    {
      key: "spare",
      header: "Spare",
      align: "right",
      className: "whitespace-nowrap text-right tabular-nums text-text-secondary",
      headClassName: "whitespace-nowrap",
      render: (r) => r.counts.spare,
    },
    {
      key: "pending",
      header: "UID pending",
      align: "right",
      className: "whitespace-nowrap text-right tabular-nums text-text-secondary",
      headClassName: "whitespace-nowrap",
      render: (r) => (r.counts.pending ? r.counts.pending : "—"),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (r) => (
        <ActionMenu
          label={`Actions for ${r.name}`}
          items={[
            r.counts.spare > 0 && { icon: Wand2, label: "Auto-assign to attendees", onSelect: () => onAssign(r.id) },
            {
              icon: Download,
              label: "Export for printer",
              disabled: !r.counts.total,
              onSelect: () => {
                const n = exportPrinterCsv(r.counts.list, { rosterByKey, batchesById, eventName: `${eventName} ${r.name}` });
                toast.success(`Exported ${plural(n, "badge")}.`);
              },
            },
            {
              icon: ListOrdered,
              label: "Download serial list",
              disabled: !r.counts.total,
              onSelect: () => {
                const n = exportOrderSheetCsv(r.counts.list, { batchName: r.name });
                toast.success(`Exported ${plural(n, "serial")}.`);
              },
            },
            { separator: true },
            {
              icon: Trash2,
              label: "Delete batch",
              variant: "destructive",
              disabled: r.counts.total - r.counts.spare > 0,
              onSelect: () => setDeleteTarget(r),
            },
          ]}
        />
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
        <LogoLoading size={48} label="Loading batches" />
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4">
      <DataTable
        columns={columns}
        data={rows}
        getRowKey={(r) => r.id}
        empty={
          <div className="rounded-xl border border-border bg-surface-subtle">
            <EmptyState
              icon={Layers}
              title="No batches yet"
              description="A batch is one delivery of badges — a vendor's UID file or a serial range you number up front."
              action={
                <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90" onClick={onAdd}>
                  <Plus className="h-4 w-4" /> Add badges
                </Button>
              }
            />
          </div>
        }
      />
      <p className="text-xs text-text-tertiary">
        A batch can be deleted while all its badges are still spare. Bound badges keep working either way.
      </p>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete batch</DialogTitle>
            <DialogDescription>
              Delete <span className="font-medium text-foreground">{deleteTarget?.name}</span> and its{" "}
              {plural(deleteTarget?.counts.spare || 0, "spare badge")}? Their chips stop resolving at readers.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button className="bg-red-500/90 text-white hover:bg-red-500" onClick={remove}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default BatchesTab;
