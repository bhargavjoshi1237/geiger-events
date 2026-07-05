"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { RotateCcw, Loader2, MoreHorizontal, Trash2 } from "lucide-react";

import {
  Field,
  SectionCard,
  SettingsList,
  SettingRow,
  StatusPill,
  EmptyState,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProject } from "@/context/project-context";
import {
  listRefundRequests,
  updateRefundRequest,
  softDeleteRefundRequest,
} from "@/lib/supabase/refunds";

import { SettingsScreen } from "./settings_kit";
import { NumField as Num } from "./controls";
import {
  currency,
  formatDate,
  defaultRefundConfig,
  REFUND_STATUS_MAP,
} from "./constants";

const NEXT_STATUS = ["Requested", "Approved", "Denied", "Refunded"];

// The refund request inbox — one row per buyer request, with status changes.
function RefundRequestsList() {
  const { projectId } = useProject();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    listRefundRequests(projectId).then((res) => {
      if (!alive) return;
      setRows(res ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const setStatus = (row, status) => {
    setRows((prev) =>
      prev.map((r) => (r.id === row.id ? { ...r, status } : r)),
    );
    updateRefundRequest(row.id, { status }).then((res) => {
      if (res === false) toast.error("Couldn't update on the server.");
      else toast.success(`Marked ${status.toLowerCase()}.`);
    });
  };

  const remove = (row) => {
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    toast.success("Request removed.");
    softDeleteRefundRequest(row.id).then((ok) => {
      if (ok === false) toast.error("Couldn't remove on the server.");
    });
  };

  return (
    <SectionCard
      title="Requested refunds"
      description="Refund requests from buyers. Approve, deny, or mark them refunded."
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading requests…
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
                    {r.buyerName || r.buyerEmail || "Unknown buyer"}
                  </span>
                  <StatusPill status={r.status} map={REFUND_STATUS_MAP} />
                </div>
                <p className="mt-0.5 truncate text-xs text-text-secondary">
                  {currency(r.amount)} · {r.reason || "No reason given"} ·{" "}
                  {formatDate(r.createdAt)}
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
          icon={RotateCcw}
          title="No refund requests"
          description="When buyers request a refund, they'll show up here to review."
        />
      )}
    </SectionCard>
  );
}

function RefundForm({ config, set }) {
  return (
    <div className="space-y-6">
      <SectionCard
        title="Refund policy"
        description="Whether and when buyers can get their money back. Events can tighten this from their ticket settings."
      >
        <SettingsList>
          <SettingRow
            icon={RotateCcw}
            title="Allow refunds"
            description="Let buyers request a refund before the cutoff."
            checked={!!config.enabled}
            onCheckedChange={(v) => set({ enabled: v })}
          />
          <SettingRow
            title="Auto-approve requests"
            description="Approve refund requests automatically instead of reviewing each."
            checked={!!config.autoApprove}
            onCheckedChange={(v) => set({ autoApprove: v })}
          />
        </SettingsList>
      </SectionCard>

      <SectionCard title="Terms">
        <div className="grid gap-4 sm:grid-cols-2">
          <Num
            label="Refund window"
            hint="Days before the event refunds close."
            value={config.windowDays ?? 7}
            onChange={(v) => set({ windowDays: v })}
            unit="days"
          />
          <Field label="Processing fees">
            <Select
              value={config.feeHandling || "absorb"}
              onValueChange={(v) => set({ feeHandling: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="absorb">Refund in full</SelectItem>
                <SelectItem value="deduct">Keep processing fees</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Policy text" hint="Shown to buyers on the event page.">
            <Textarea
              rows={2}
              value={config.policyText || ""}
              onChange={(e) => set({ policyText: e.target.value })}
              placeholder="e.g. Full refunds up to 7 days before the event."
            />
          </Field>
        </div>
      </SectionCard>
    </div>
  );
}

export function RefundsScreen() {
  return (
    <SettingsScreen
      module="refund"
      title="Refunds"
      description="Set your project's refund policy and review buyer refund requests."
      defaultConfig={defaultRefundConfig}
      Form={RefundForm}
    >
      <RefundRequestsList />
    </SettingsScreen>
  );
}

export default RefundsScreen;
