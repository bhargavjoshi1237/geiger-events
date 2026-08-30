"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Inbox,
  Loader2,
  SlidersHorizontal,
  Trash2,
  Users,
} from "lucide-react";

import {
  SectionCard,
  SettingsList,
  SettingRow,
  StatusPill,
  EmptyState,
} from "@/components/internal/shared/screen_kit";
import { ActionMenu } from "@geiger/ui/action-menu";
import { useProject } from "@/context/project-context";
import {
  listGroupPurchases,
  updateGroupPurchase,
  softDeleteGroupPurchase,
} from "@/lib/supabase/group_purchases";

import { SettingsScreen } from "./settings_kit";
import { NumField as Num } from "./controls";
import {
  currency,
  formatDate,
  defaultGroupPurchaseConfig,
  GROUP_STATUS_MAP,
} from "./constants";

const NEXT_STATUS = ["Pending", "Confirmed", "Cancelled"];

// Group purchases logged across the project's events. Rendered as a section
// body, so its hooks are its own.
function GroupPurchasesList() {
  const { projectId } = useProject();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    listGroupPurchases(projectId).then((res) => {
      if (!alive) return;
      setRows(res ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const setStatus = (row, status) => {
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status } : r)));
    updateGroupPurchase(row.id, { status }).then((res) => {
      if (res === false) toast.error("Couldn't update on the server.");
      else toast.success(`Marked ${status.toLowerCase()}.`);
    });
  };

  const remove = (row) => {
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    toast.success("Group purchase removed.");
    softDeleteGroupPurchase(row.id).then((ok) => {
      if (ok === false) toast.error("Couldn't remove on the server.");
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-text-secondary">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading group purchases…
      </div>
    );
  }

  if (!rows.length) {
    return (
      <EmptyState
        icon={Users}
        title="No group purchases yet"
        description="Bulk orders placed on your events will appear here."
      />
    );
  }

  return (
    <SectionCard bare>
      <div className="divide-y divide-border">
        {rows.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-medium text-foreground">
                  {r.organizerName || r.organizerEmail || "Group order"}
                </span>
                <StatusPill status={r.status} map={GROUP_STATUS_MAP} />
              </div>
              <p className="mt-0.5 truncate text-xs text-text-secondary">
                {r.seats} seats · {currency(r.total)}
                {r.code ? ` · ${r.code}` : ""} · {formatDate(r.createdAt)}
              </p>
            </div>
            <ActionMenu
              label="Group request actions"
              items={[
                ...NEXT_STATUS.filter((s) => s !== r.status).map((s) => ({
                  key: s,
                  label: `Mark ${s.toLowerCase()}`,
                  onSelect: () => setStatus(r, s),
                })),
                { separator: true },
                {
                  icon: Trash2,
                  label: "Remove",
                  variant: "destructive",
                  onSelect: () => remove(r),
                },
              ]}
            />
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

// --- Edit sections -----------------------------------------------------------
// settings_kit renders each as an element, never calls it.

function GroupPurchasingSection({ config, set }) {
  return (
    <SectionCard bare>
      <SettingsList>
        <SettingRow
          icon={Users}
          title="Enable group purchasing"
          description="Offer bulk/group orders across this project's events."
          checked={!!config.enabled}
          onCheckedChange={(v) => set({ enabled: v })}
        />
        <SettingRow
          title="Require approval"
          description="Review each group order before it's confirmed."
          checked={!!config.requireApproval}
          onCheckedChange={(v) => set({ requireApproval: v })}
        />
      </SettingsList>
    </SectionCard>
  );
}

function GroupDefaultsSection({ config, set }) {
  return (
    <SectionCard bare>
      <div className="grid gap-4 sm:grid-cols-2">
        <Num
          label="Minimum seats"
          hint="Smallest order that counts as a group."
          value={config.minSeats ?? 5}
          onChange={(v) => set({ minSeats: v })}
          unit="seats"
        />
        <Num
          label="Group discount"
          value={config.defaultDiscountPercent ?? 10}
          onChange={(v) => set({ defaultDiscountPercent: v })}
          unit="%"
        />
      </div>
    </SectionCard>
  );
}

const SECTIONS = [
  {
    key: "settings",
    label: "Group purchasing",
    icon: Users,
    desc: "Let buyers book a block of tickets at a discount. Turn it on per event from its edit page.",
    render: GroupPurchasingSection,
  },
  {
    key: "defaults",
    label: "Defaults",
    icon: SlidersHorizontal,
    desc: "Starting values events inherit — each event can override them.",
    render: GroupDefaultsSection,
  },
  {
    key: "requests",
    label: "Group purchases",
    icon: Inbox,
    desc: "Bulk orders placed across your events.",
    render: GroupPurchasesList,
  },
];

export function GroupPurchasingScreen() {
  return (
    <SettingsScreen
      module="group_purchase"
      title="Group Purchasing"
      description="Enable and configure group/bulk orders, and review the group purchases placed across your events."
      defaultConfig={defaultGroupPurchaseConfig}
      sections={SECTIONS}
    />
  );
}

export default GroupPurchasingScreen;
