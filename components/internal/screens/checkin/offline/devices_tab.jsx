"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Pencil, Smartphone, Trash2 } from "lucide-react";

import { DataTable, EmptyState, Field, StatusPill } from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { ActionMenu } from "@geiger/ui/action-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { cn } from "@/lib/utils";
import { shortDeviceId } from "@/lib/checkin/offline/device";
import { updateCheckinDevice } from "@/lib/supabase/checkin_offline";
import { DEVICE_STATUS_MAP, ROUTE_LABELS, deviceStatus, relativeTime } from "./shared";

function RenameDialog({ device, onOpenChange, onSaved }) {
  const [label, setLabel] = useState(device?.label || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const saved = await updateCheckinDevice(device.id, { label: label.trim() });
    setSaving(false);
    if (!saved) {
      toast.error("Couldn't rename the device.");
      return;
    }
    toast.success("Device renamed.");
    onSaved(saved);
  };

  return (
    <Dialog open={!!device} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Name this device</DialogTitle>
          <DialogDescription>
            Staff see its id ({shortDeviceId(device?.deviceId)}) in the scanner&apos;s status bar, so you can tell which device is which.
          </DialogDescription>
        </DialogHeader>
        <Field label="Name">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), save())}
            placeholder="e.g. North gate iPad"
            autoFocus
          />
        </Field>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={save} disabled={saving}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DevicesTab({ devices, now, refreshMinutes, onChange, onOpenScanner }) {
  const [renaming, setRenaming] = useState(null);

  const remove = async (device) => {
    const saved = await updateCheckinDevice(device.id, { removed: true });
    if (!saved) {
      toast.error("Couldn't remove the device.");
      return;
    }
    toast.success("Device removed. It reappears if it checks in again.");
    onChange(devices.filter((d) => d.id !== device.id));
  };

  // A guest list older than twice the refresh interval means the device hasn't been able to refresh it.
  const staleListMs = Math.max(2, refreshMinutes * 2) * 60000;

  const columns = [
    {
      key: "device",
      header: "Device",
      render: (d) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-muted-foreground">
            <Smartphone className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{d.label || d.userAgent || "Unnamed device"}</p>
            <p className="truncate text-xs text-text-secondary">
              <span className="font-mono">{shortDeviceId(d.deviceId)}</span> · {ROUTE_LABELS[d.route] || d.route}
              {d.roleName ? ` · ${d.roleName}` : ""}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      className: "whitespace-nowrap",
      render: (d) => <StatusPill status={deviceStatus(d, now)} map={DEVICE_STATUS_MAP} />,
    },
    {
      key: "seen",
      header: "Last seen",
      className: "whitespace-nowrap text-sm text-text-secondary",
      render: (d) => relativeTime(d.lastSeenAt, now),
    },
    {
      key: "sync",
      header: "Last sync",
      className: "whitespace-nowrap text-sm text-text-secondary",
      render: (d) => relativeTime(d.lastSyncAt, now),
    },
    {
      key: "list",
      header: "Guest list",
      className: "whitespace-nowrap text-sm",
      render: (d) => {
        const age = d.lastSnapshotAt ? now - new Date(d.lastSnapshotAt).getTime() : Infinity;
        const stale = age > staleListMs;
        return (
          <span className={cn("tabular-nums", stale ? "text-amber-700 dark:text-amber-300" : "text-text-secondary")}>
            {d.snapshotCount.toLocaleString("en-US")} · {relativeTime(d.lastSnapshotAt, now)}
          </span>
        );
      },
    },
    {
      key: "queued",
      header: "Queued",
      align: "right",
      className: "text-right tabular-nums",
      render: (d) => (
        <span className={d.queuedCount > 0 ? "font-semibold text-amber-700 dark:text-amber-300" : "text-text-tertiary"}>
          {d.queuedCount.toLocaleString("en-US")}
        </span>
      ),
    },
    {
      key: "conflicts",
      header: "Conflicts",
      align: "right",
      className: "text-right tabular-nums text-text-secondary",
      render: (d) => d.conflictsTotal.toLocaleString("en-US"),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (d) => (
        <ActionMenu
          label="Device actions"
          items={[
            { icon: Pencil, label: "Rename", onSelect: () => setRenaming(d) },
            { separator: true },
            { icon: Trash2, label: "Remove", variant: "destructive", onSelect: () => remove(d) },
          ]}
        />
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={devices}
        getRowKey={(d) => d.id}
        empty={
          <div className="rounded-xl border border-border bg-surface-subtle">
            <EmptyState
              icon={Smartphone}
              title="No devices yet"
              description="Open the scanner on each phone or tablet while connected. It caches the guest list and shows up here."
              action={
                onOpenScanner ? (
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={onOpenScanner}>
                    <ExternalLink className="h-4 w-4" /> Open scanner
                  </Button>
                ) : null
              }
            />
          </div>
        }
      />
      {renaming ? (
        <RenameDialog
          key={renaming.id}
          device={renaming}
          onOpenChange={(open) => !open && setRenaming(null)}
          onSaved={(saved) => {
            onChange(devices.map((d) => (d.id === saved.id ? saved : d)));
            setRenaming(null);
          }}
        />
      ) : null}
    </>
  );
}

export default DevicesTab;
