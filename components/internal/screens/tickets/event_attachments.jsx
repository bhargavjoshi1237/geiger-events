"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Percent,
  CreditCard,
  Banknote,
  TrendingUp,
  ShoppingBag,
  FileText,
  Layers,
  Package,
  ShieldAlert,
  Coins,
  BadgeCheck,
  Loader2,
  Plus,
} from "lucide-react";

import {
  EditorSectionHeader,
  SectionCard,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEventConfig } from "@/lib/events/use-event-config";
import { useProject } from "@/context/project-context";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { listRecordsByModules } from "@/lib/supabase/ticketing";

// The modules whose global records can be attached to an event. `tab` is the
// sidebar destination that manages that module (for the "create one" link).
const ATTACH_MODULES = [
  { module: "discount", label: "Discounts & Codes", icon: Percent, tab: "Discounts & Codes" },
  { module: "tier", label: "Ticket Tiers", icon: Layers, tab: "Ticket Tiers" },
  { module: "bundle", label: "Bundles", icon: Package, tab: "Bundles" },
  { module: "payment_method", label: "Payments & Methods", icon: CreditCard, tab: "Payments & Methods" },
  { module: "payout", label: "Payouts", icon: Banknote, tab: "Payouts" },
  { module: "pricing_rule", label: "Dynamic Pricing", icon: TrendingUp, tab: "Dynamic Pricing" },
  { module: "currency", label: "Multi-currency", icon: Coins, tab: "Multi-currency" },
  { module: "resale_rule", label: "Anti-scalping & Resale", icon: ShieldAlert, tab: "Anti-scalping & Resale" },
  { module: "membership", label: "Memberships", icon: BadgeCheck, tab: "Membership Plans" },
  { module: "order_policy", label: "Orders & Attendees", icon: ShoppingBag, tab: "Orders & Attendees" },
  { module: "invoice_profile", label: "Invoices & Receipts", icon: FileText, tab: "Invoices & Receipts" },
];

const MODULE_KEYS = ATTACH_MODULES.map((m) => m.module);

// Event-editor section: attach reusable Tickets records (coupons, methods,
// policies…) to this event. Attachments are stored as a per-module id map under
// the event's metadata bag (metadata.attached), so one record applies to many
// events without duplication.
export function TicketAttachmentsSection({ event, headerItem }) {
  const { projectId } = useProject();
  const { setTab } = useWorkspaceUrl();
  const [attached, , save] = useEventConfig(event, "attached", {});
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    listRecordsByModules(projectId, MODULE_KEYS).then((rows) => {
      if (!alive) return;
      setRecords(rows ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const byModule = useMemo(() => {
    const map = {};
    for (const m of MODULE_KEYS) map[m] = [];
    for (const r of records) if (map[r.module]) map[r.module].push(r);
    return map;
  }, [records]);

  const toggle = (module, id) => {
    const current = Array.isArray(attached[module]) ? attached[module] : [];
    const next = current.includes(id)
      ? current.filter((x) => x !== id)
      : [...current, id];
    save({ ...attached, [module]: next });
  };

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Ticketing"}
        description={
          headerItem?.desc ||
          "Attach reusable coupons, methods, and policies to this event. Manage the records themselves under the Tickets sidebar."
        }
      />

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-12 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading records…
        </div>
      ) : (
        ATTACH_MODULES.map((m) => {
          const list = byModule[m.module] || [];
          const selected = Array.isArray(attached[m.module])
            ? attached[m.module]
            : [];
          const Icon = m.icon;
          return (
            <SectionCard
              key={m.module}
              title={m.label}
              description={
                selected.length
                  ? `${selected.length} attached`
                  : "None attached to this event."
              }
              action={<Icon className="h-4 w-4 text-text-tertiary" />}
            >
              {list.length ? (
                <div className="flex flex-wrap gap-2">
                  {list.map((r) => {
                    const on = selected.includes(r.id);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => toggle(m.module, r.id)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                          on
                            ? "border-white bg-white text-[#161616]"
                            : "border-border bg-surface-card text-muted-foreground hover:bg-surface-active",
                          !r.active && !on ? "opacity-60" : "",
                        )}
                      >
                        {r.name}
                        {!r.active ? " · inactive" : ""}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-start gap-2">
                  <p className="text-sm text-text-secondary">
                    No {m.label.toLowerCase()} records yet.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setTab(m.tab)}
                    className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                  >
                    <Plus className="h-4 w-4" /> Create one
                  </Button>
                </div>
              )}
            </SectionCard>
          );
        })
      )}
    </div>
  );
}

export default TicketAttachmentsSection;
