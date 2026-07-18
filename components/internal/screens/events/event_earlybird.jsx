"use client";

import React from "react";
import { Timer } from "lucide-react";

import { EditorSectionHeader, Field, SectionCard } from "@/components/internal/shared/screen_kit";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEventConfig } from "@/lib/events/use-event-config";
import {
  EMPTY_EARLYBIRD,
  normalizeEarlybird,
  earlybirdLabel,
} from "@/lib/events/earlybird";

// Early-bird pricing editor. The config lives in the event metadata bag
// (metadata.earlybird) and is re-derived server-side by the buy_ticket RPC — this
// tab only edits the window + reduction. See lib/events/earlybird.js for the shape.

export function EventEarlybirdSection({ event, headerItem }) {
  const [cfg, , save] = useEventConfig(event, "earlybird", EMPTY_EARLYBIRD);

  // Persist a single field, keeping the rest of the draft intact.
  const set = (key) => (value) =>
    save({ ...cfg, [key]: value }, { successMsg: "Early-bird updated." });

  const norm = normalizeEarlybird(cfg);
  const configured = norm.mode === "flat" ? norm.amount > 0 : norm.percent > 0;
  const label = earlybirdLabel({ earlybird: cfg });

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Early-bird"}
        description={
          headerItem?.desc ||
          "Reward early buyers with a limited-time discount on every ticket."
        }
      />

      {/* Master early-bird config. */}
      <div className="space-y-5 rounded-xl border border-border bg-surface-card p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-subtle text-muted-foreground">
            <Timer className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">Early-bird discount</p>
            <p className="mt-0.5 text-xs text-text-secondary">
              {configured
                ? `Buyers save ${label} while the window is open.`
                : "Set a discount to reward buyers who book early."}
            </p>
          </div>
        </div>

        <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
          <Field label="Discount type">
            <Select value={norm.mode} onValueChange={(v) => set("mode")(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percent">Percent off</SelectItem>
                <SelectItem value="flat">Flat amount</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {norm.mode === "percent" ? (
            <Field label="Discount %" hint="Percent off each ticket price" htmlFor="eb-percent">
              <div className="flex items-center gap-1">
                <Input
                  id="eb-percent"
                  type="number"
                  min={0}
                  max={100}
                  inputMode="numeric"
                  value={cfg.percent ?? ""}
                  onChange={(e) => set("percent")(e.target.value)}
                  className="tabular-nums"
                  placeholder="15"
                />
                <span className="text-sm text-text-secondary">%</span>
              </div>
            </Field>
          ) : (
            <Field label="Amount off" hint="Flat amount off each ticket" htmlFor="eb-amount">
              <div className="flex items-center gap-1">
                <span className="text-sm text-text-secondary">$</span>
                <Input
                  id="eb-amount"
                  type="number"
                  min={0}
                  inputMode="decimal"
                  value={cfg.amount ?? ""}
                  onChange={(e) => set("amount")(e.target.value)}
                  className="tabular-nums"
                  placeholder="10"
                />
              </div>
            </Field>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starts" hint="Blank = open-ended" htmlFor="eb-start">
            <Input
              id="eb-start"
              type="datetime-local"
              value={cfg.startAt || ""}
              onChange={(e) => set("startAt")(e.target.value)}
            />
          </Field>
          <Field label="Ends" hint="Blank = open-ended" htmlFor="eb-end">
            <Input
              id="eb-end"
              type="datetime-local"
              value={cfg.endAt || ""}
              onChange={(e) => set("endAt")(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Note" hint="Optional, for your team" htmlFor="eb-note">
          <Textarea
            id="eb-note"
            rows={2}
            value={cfg.note || ""}
            onChange={(e) => save({ ...cfg, note: e.target.value })}
            onBlur={() => save({ ...cfg }, { successMsg: "Early-bird updated." })}
            placeholder="e.g. Runs until the venue is half full."
          />
        </Field>
      </div>

      {/* Live preview. */}
      <SectionCard bare title="Preview" description="How the discount reads to buyers.">
        <p className="text-sm text-text-secondary">
          {configured
            ? `Buyers save ${label} while the window is open.`
            : "No discount configured yet."}
        </p>
      </SectionCard>
    </div>
  );
}

export default EventEarlybirdSection;
