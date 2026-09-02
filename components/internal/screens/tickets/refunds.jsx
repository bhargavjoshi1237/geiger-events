"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Inbox, RotateCcw, SlidersHorizontal, Trash2 } from "lucide-react";

import {
  Field,
  SectionCard,
  SettingsList,
  SettingRow,
  StatusPill,
  EmptyState,
} from "@/components/internal/shared/screen_kit";
import { Textarea } from "@geiger/ui/textarea";
import { ActionMenu } from "@geiger/ui/action-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
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
// Rendered as a section body, so its hooks are its own.
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

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-text-secondary">
        <RotateCcw className="h-4 w-4 animate-spin" /> Loading requests…
      </div>
    );
  }

  if (!rows.length) {
    return (
      <EmptyState
        icon={RotateCcw}
        title="No refund requests"
        description="When buyers Request A Refund, they'll show up here to review."
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
                  {r.buyerName || r.buyerEmail || "Unknown buyer"}
                </span>
                <StatusPill status={r.status} map={REFUND_STATUS_MAP} />
              </div>
              <p className="mt-0.5 truncate text-xs text-text-secondary">
                {currency(r.amount)} · {r.reason || "No reason given"} ·{" "}
                {formatDate(r.createdAt)}
              </p>
            </div>
            <ActionMenu
              label="Refund actions"
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

function RefundPolicySection({ config, set }) {
  return (
    <SectionCard bare>
      <SettingsList>
        <SettingRow
          icon={RotateCcw}
          title="Allow refunds"
          description="Let buyers Request A Refund before the cutoff."
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
  );
}

function RefundTermsSection({ config, set }) {
  return (
    <div className="space-y-6">
      <SectionCard bare>
        <div className="grid gap-4">
          <Num
            fullWidth
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
      </SectionCard>

      <SectionCard bare>
        <Field label="Policy text" hint="Shown to buyers on the event page.">
          <Textarea
            rows={3}
            value={config.policyText || ""}
            onChange={(e) => set({ policyText: e.target.value })}
            placeholder="e.g. Full refunds up to 7 days before the event."
          />
        </Field>
      </SectionCard>
    </div>
  );
}

const SECTIONS = [
  {
    key: "policy",
    label: "Refund policy",
    icon: RotateCcw,
    desc: "Whether and when buyers can get their money back. Events can tighten this from their ticket settings.",
    render: RefundPolicySection,
  },
  {
    key: "terms",
    label: "Terms",
    icon: SlidersHorizontal,
    desc: "The window, fee handling, and policy text shown to buyers.",
    render: RefundTermsSection,
  },
  {
    key: "requests",
    label: "Requests",
    icon: Inbox,
    desc: "Refund requests from buyers. Approve, deny, or mark them refunded.",
    render: RefundRequestsList,
  },
];

export function RefundsScreen() {
  return (
    <SettingsScreen
      module="refund"
      title="Refunds"
      description="Set your project's refund policy and review buyer refund requests."
      defaultConfig={defaultRefundConfig}
      sections={SECTIONS}
    />
  );
}

export default RefundsScreen;
