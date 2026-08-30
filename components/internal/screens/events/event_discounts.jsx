"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Percent, Plus, Ticket, ShoppingCart, Loader2 } from "lucide-react";

import {
  EditorSectionHeader,
  Field,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { Switch } from "@geiger/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import { cn } from "@/lib/utils";
import { useEventConfig } from "@/lib/events/use-event-config";
import { useProject } from "@/context/project-context";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { listRecords } from "@/lib/supabase/ticketing";
import { DiscountStub } from "@/components/internal/screens/tickets/discount_stub";
import { ticketDiscountIds } from "@/lib/events/discount_rules";

const DEFAULT_SETTINGS = { enabled: true, appliesTo: "order" };

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

  // Codes redeem per TICKET, so the useful thing to surface here is how many of
  // this event's tickets actually accept each one. `selected` only curates the
  // picker on the Tickets tab — it no longer decides redemption.
  const tickets = Array.isArray(event?.tickets) ? event.tickets : [];
  const onTicketCount = new Map();
  for (const t of tickets) {
    for (const id of ticketDiscountIds(t)) {
      onTicketCount.set(id, (onTicketCount.get(id) || 0) + 1);
    }
  }

  const scopeLabelFor = (id) => {
    const n = onTicketCount.get(String(id)) || 0;
    if (!n) return "Not on any ticket";
    return n === tickets.length
      ? `On all ${tickets.length} ticket${tickets.length > 1 ? "s" : ""}`
      : `On ${n} of ${tickets.length} tickets`;
  };

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Discounts"}
        description={
          headerItem?.desc ||
          "Let buyers redeem discount codes at checkout. Codes are switched on per TICKET — add them from the Tickets tab, and a code only ever works on the tickets you put it on."
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

      {enabled ? (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              Codes for this event
              {selected.length ? (
                <span className="ml-2 text-xs font-normal text-text-secondary">
                  {selected.length} in the ticket picker
                </span>
              ) : null}
            </p>
            <p className="mt-0.5 text-xs text-text-secondary">
              Switching a code on here makes it appear in each ticket&apos;s
              discount picker. A buyer can only redeem it on tickets that have
              it ticked.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-10 text-sm text-text-secondary">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading codes…
            </div>
          ) : coupons.length ? (
            <div className="space-y-3">
              {coupons.map((r) => (
                <DiscountStub
                  key={r.id}
                  code={r.config?.code}
                  discountType={r.config?.discountType}
                  value={r.config?.value}
                  usageLimit={r.config?.usageLimit}
                  rules={r.config?.rules}
                  active={r.active}
                  attached={selected.includes(r.id)}
                  scopeLabel={scopeLabelFor(r.id)}
                  onToggle={() => toggleCoupon(r.id)}
                  control={
                    <Switch
                      checked={selected.includes(r.id)}
                      onCheckedChange={() => toggleCoupon(r.id)}
                      aria-label={selected.includes(r.id) ? "Detach code" : "Attach code"}
                    />
                  }
                />
              ))}
            </div>
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
