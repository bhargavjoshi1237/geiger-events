"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Users, Loader2, MoreHorizontal, Trash2 } from "lucide-react";

import {
  SectionCard,
  SettingsList,
  SettingRow,
  StatusPill,
  EmptyState,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

// Group purchases logged across the project's events.
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

  return (
    <SectionCard
      title="Group purchases"
      description="Bulk orders placed across your events."
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading group purchases…
        </div>
      ) : rows.length ? (
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
              <div onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-44 border-border bg-surface-card shadow-xl"
                  >
                    {NEXT_STATUS.filter((s) => s !== r.status).map((s) => (
                      <DropdownMenuItem
                        key={s}
                        className="cursor-pointer gap-2 text-muted-foreground focus:bg-surface-hover focus:text-foreground"
                        onClick={() => setStatus(r, s)}
                      >
                        Mark {s.toLowerCase()}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator className="bg-surface-strong" />
                    <DropdownMenuItem
                      className="cursor-pointer gap-2 text-red-300 focus:bg-red-500/10 focus:text-red-300"
                      onClick={() => remove(r)}
                    >
                      <Trash2 className="h-4 w-4 text-red-300" /> Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Users}
          title="No group purchases yet"
          description="Bulk orders placed on your events will appear here."
        />
      )}
    </SectionCard>
  );
}

function GroupPurchaseForm({ config, set }) {
  return (
    <div className="space-y-6">
      <SectionCard
        title="Group purchasing"
        description="Let buyers book a block of tickets at a discount. Enable it here; turn it on per event from its edit page."
      >
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

      <SectionCard title="Defaults">
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
    </div>
  );
}

export function GroupPurchasingScreen() {
  return (
    <SettingsScreen
      module="group_purchase"
      title="Group Purchasing"
      description="Enable and configure group/bulk orders, and review the group purchases placed across your events."
      defaultConfig={defaultGroupPurchaseConfig}
      Form={GroupPurchaseForm}
    >
      <GroupPurchasesList />
    </SettingsScreen>
  );
}

export default GroupPurchasingScreen;
