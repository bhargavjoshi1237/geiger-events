"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Percent, Plus, Ticket, ShoppingCart, Loader2 } from "lucide-react";

import {
  EditorSectionHeader,
  Field,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useEventConfig } from "@/lib/events/use-event-config";
import { useProject } from "@/context/project-context";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { listRecords } from "@/lib/supabase/ticketing";

// Event-editor "Discounts" tab. Owns the per-event discount-code config:
//   metadata.discountSettings = { enabled: true, appliesTo: "order" | "tickets" }
// plus which coupon records are attached to this event
//   metadata.attached.discount = [recordId, …]   (shared with the Ticketing tab)
// The public checkout shows a code field only when enabled AND at least one
// coupon is attached, and validates typed codes against these attached records.

const DEFAULT_SETTINGS = { enabled: true, appliesTo: "order" };

// One-line summary of a coupon record's config.
function couponSummary(config) {
  const c = config || {};
  const off = c.discountType === "flat" ? `$${c.value} off` : `${c.value}% off`;
  const limit = Number(c.usageLimit) > 0 ? ` · limit ${c.usageLimit}` : "";
  return `${off}${limit}`;
}

export function EventDiscountsSection({ event, headerItem }) {
  const { projectId } = useProject();
  const { setTab } = useWorkspaceUrl();
  const [settings, , saveSettings] = useEventConfig(event, "discountSettings", DEFAULT_SETTINGS);
  const [attached, , saveAttached] = useEventConfig(event, "attached", {});
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    listRecords(projectId, "discount").then((rows) => {
      if (!alive) return;
      // Only code-based coupons are usable at checkout (group/earlybird/affiliate
      // are separate mechanisms).
      setCoupons((rows ?? []).filter((r) => r.kind === "coupon"));
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const cfg = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  const enabled = cfg.enabled !== false;
  const selected = useMemo(
    () => (Array.isArray(attached.discount) ? attached.discount : []),
    [attached.discount],
  );

  const patch = (p, opts) => saveSettings({ ...cfg, ...p }, opts);

  const toggleCoupon = (id) => {
    const next = selected.includes(id)
      ? selected.filter((x) => x !== id)
      : [...selected, id];
    saveAttached({ ...attached, discount: next });
  };

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Discounts"}
        description={
          headerItem?.desc ||
          "Let buyers redeem discount codes at checkout. Only the codes you attach here work on this event — create codes under Tickets → Discounts & Codes."
        }
        action={
          <Button
            size="sm"
            variant="outline"
            onClick={() => setTab("Discounts & Codes")}
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
          >
            <Plus className="h-4 w-4" /> Create codes
          </Button>
        }
      />

      {/* Master config. */}
      <div className="space-y-4 rounded-xl border border-border bg-surface-card p-4">
        <label className="flex items-start justify-between gap-4">
          <span>
            <span className="block text-sm font-medium text-foreground">Allow discount codes</span>
            <span className="mt-0.5 block text-xs text-text-secondary">
              Show a code field at checkout. On by default.
            </span>
          </span>
          <Switch
            checked={enabled}
            onCheckedChange={(v) =>
              patch({ enabled: v }, { successMsg: v ? "Discount codes on." : "Discount codes off." })
            }
          />
        </label>
        {enabled ? (
          <div className="border-t border-border pt-4">
            <Field label="Discount applies to" hint="What a code takes its percentage/amount off.">
              <Select value={cfg.appliesTo} onValueChange={(v) => patch({ appliesTo: v })}>
                <SelectTrigger className="max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="order">
                    <span className="flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4" /> Whole order (tickets + add-ons)
                    </span>
                  </SelectItem>
                  <SelectItem value="tickets">
                    <span className="flex items-center gap-2">
                      <Ticket className="h-4 w-4" /> Tickets only
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        ) : null}
      </div>

      {/* Attach coupons to this event. */}
      {enabled ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">
            Codes for this event
            {selected.length ? (
              <span className="ml-2 text-xs font-normal text-text-secondary">
                {selected.length} attached
              </span>
            ) : null}
          </p>

          {loading ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-10 text-sm text-text-secondary">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading codes…
            </div>
          ) : coupons.length ? (
            <SettingsList>
              {coupons.map((r) => (
                <SettingRow
                  key={r.id}
                  title={
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-sm text-foreground">
                        {r.config?.code || "NO CODE"}
                      </span>
                      {!r.active ? <Badge variant="neutral">Inactive</Badge> : null}
                    </span>
                  }
                  description={couponSummary(r.config)}
                  control={
                    <Switch
                      checked={selected.includes(r.id)}
                      onCheckedChange={() => toggleCoupon(r.id)}
                      aria-label={selected.includes(r.id) ? "Detach code" : "Attach code"}
                    />
                  }
                />
              ))}
            </SettingsList>
          ) : (
            <button
              type="button"
              onClick={() => setTab("Discounts & Codes")}
              className={cn(
                "flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-card py-10 text-text-secondary transition-colors",
                "hover:border-border-strong hover:text-muted-foreground",
              )}
            >
              <Percent className="h-6 w-6" />
              <p className="text-sm">No coupon codes yet — create one</p>
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default EventDiscountsSection;
