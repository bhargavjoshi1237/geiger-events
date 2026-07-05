"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Package, Plus, Trash2 } from "lucide-react";

import { Field, SectionCard } from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProject } from "@/context/project-context";
import { listRecords } from "@/lib/supabase/ticketing";

import { RecordsScreen } from "./records_kit";
import { Segmented, NumField as Num } from "./controls";
import { currency, defaultBundleConfig } from "./constants";

const KINDS = [
  { value: "bundle", label: "Bundle", defaultConfig: defaultBundleConfig },
];

// List-card summary line: "3 items · $120" (or "sum of items" when unpriced).
function summarize(r) {
  const c = r.config || {};
  const items = Array.isArray(c.items) ? c.items : [];
  const count = items.reduce((n, it) => n + (Number(it.qty) || 0), 0);
  const noun = count === 1 ? "item" : "items";
  const price =
    c.pricingMode === "fixed" ? currency(c.price) : "sum of items";
  return `${count} ${noun} · ${price}`;
}

function BundleEditForm({ config, setConfig }) {
  const { projectId } = useProject();
  const [tickets, setTickets] = useState([]);
  const set = (patch) => setConfig({ ...config, ...patch });
  const items = Array.isArray(config.items) ? config.items : [];

  useEffect(() => {
    let alive = true;
    listRecords(projectId, "ticket_type").then((rows) => {
      if (alive) setTickets(rows ?? []);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const ticketName = useMemo(() => {
    const map = {};
    for (const t of tickets) map[t.id] = t.name;
    return map;
  }, [tickets]);

  const setItem = (idx, patch) =>
    set({ items: items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) });
  const addItem = () =>
    set({ items: [...items, { ticketTypeId: "", qty: 1 }] });
  const removeItem = (idx) =>
    set({ items: items.filter((_, i) => i !== idx) });

  return (
    <div className="space-y-4">
      <SectionCard
        title="Bundle items"
        description="The tickets sold together in this bundle. Manage the tickets themselves under Tickets → Ticket Types."
      >
        {items.length ? (
          <div className="space-y-3">
            {items.map((it, idx) => (
              <div
                key={idx}
                className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface-card p-3"
              >
                <Field label="Ticket" className="min-w-[12rem] flex-1">
                  <Select
                    value={it.ticketTypeId || ""}
                    onValueChange={(v) => setItem(idx, { ticketTypeId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pick a ticket…" />
                    </SelectTrigger>
                    <SelectContent>
                      {tickets.length ? (
                        tickets.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled>
                          No tickets yet
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </Field>
                <Num
                  label="Qty"
                  value={it.qty ?? 1}
                  onChange={(v) => setItem(idx, { qty: v })}
                  min={1}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${ticketName[it.ticketTypeId] || "item"}`}
                  onClick={() => removeItem(idx)}
                  className="mb-1 text-red-300 hover:bg-red-500/10 hover:text-red-300"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-secondary">
            No items yet — add the tickets this bundle includes.
          </p>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={addItem}
          className="mt-3 border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
        >
          <Plus className="h-4 w-4" /> Add item
        </Button>
      </SectionCard>

      <SectionCard
        title="Pricing"
        description="Charge one bundle price, or the sum of the included tickets."
      >
        <Field label="Pricing mode">
          <Segmented
            value={config.pricingMode || "fixed"}
            onChange={(v) => set({ pricingMode: v })}
            options={[
              { value: "fixed", label: "Fixed price" },
              { value: "sum", label: "Sum of items" },
            ]}
          />
        </Field>
        {config.pricingMode !== "sum" ? (
          <div className="mt-4">
            <Field label="Bundle price">
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-text-secondary">$</span>
                <Input
                  type="number"
                  min={0}
                  inputMode="decimal"
                  value={config.price ?? 0}
                  onChange={(e) => set({ price: Number(e.target.value) || 0 })}
                  className="w-32 tabular-nums"
                  placeholder="0"
                />
              </div>
            </Field>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title="Details">
        <Field
          label="Description"
          hint="Shown to buyers under the bundle name."
        >
          <Textarea
            rows={2}
            value={config.description || ""}
            onChange={(e) => set({ description: e.target.value })}
            placeholder="e.g. Weekend pass — entry to all three days plus the after-party."
          />
        </Field>
      </SectionCard>
    </div>
  );
}

export function BundlesScreen() {
  return (
    <RecordsScreen
      module="bundle"
      title="Bundles"
      description="Reusable bundles — several tickets sold together at one price. Create one here, then attach it to any event."
      singular="bundle"
      icon={Package}
      kinds={KINDS}
      summarize={summarize}
      EditForm={BundleEditForm}
    />
  );
}

export default BundlesScreen;
