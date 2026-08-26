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
import { EventDatePicker, EventTimeSelect } from "./date_time_fields";
import {
  EMPTY_EARLYBIRD,
  normalizeEarlybird,
  earlybirdLabel,
} from "@/lib/events/earlybird";

const splitDateTime = (v) => {
  if (!v) return ["", ""];
  const [date, time = ""] = String(v).split("T");
  return [date || "", time];
};

const joinDateTime = (date, time) =>
  [date, time].filter(Boolean).join("T");

export function EventEarlybirdSection({ event, headerItem }) {
  const [cfg, setCfg, save] = useEventConfig(event, "earlybird", EMPTY_EARLYBIRD);

  const commit = (patch) =>
    save({ ...cfg, ...patch }, { successMsg: "Early-bird updated." });
  const draft = (key) => (value) => setCfg({ ...cfg, [key]: value });

  const norm = normalizeEarlybird(cfg);
  const configured = norm.mode === "flat" ? norm.amount > 0 : norm.percent > 0;
  const label = earlybirdLabel({ earlybird: cfg });

  const [startDate, startTime] = splitDateTime(cfg.startAt || "");
  const [endDate, endTime] = splitDateTime(cfg.endAt || "");

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Early-bird"}
        description={
          headerItem?.desc ||
          "Reward early buyers with a limited-time discount on every ticket."
        }
      />

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
            <Select
              value={norm.mode}
              onValueChange={(v) => commit({ mode: v })}
            >
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
                  onChange={(e) => draft("percent")(e.target.value)}
                  onBlur={() => commit({ percent: cfg.percent })}
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
                  onChange={(e) => draft("amount")(e.target.value)}
                  onBlur={() => commit({ amount: cfg.amount })}
                  className="tabular-nums"
                  placeholder="10"
                />
              </div>
            </Field>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starts" hint="Blank = open-ended">
            <div className="space-y-2">
              <EventDatePicker
                value={startDate}
                onChange={(date) => commit({ startAt: joinDateTime(date, startTime) })}
              />
              <EventTimeSelect
                value={startTime}
                onChange={(time) => commit({ startAt: joinDateTime(startDate, time) })}
              />
            </div>
          </Field>
          <Field label="Ends" hint="Blank = open-ended">
            <div className="space-y-2">
              <EventDatePicker
                value={endDate}
                onChange={(date) => commit({ endAt: joinDateTime(date, endTime) })}
              />
              <EventTimeSelect
                value={endTime}
                onChange={(time) => commit({ endAt: joinDateTime(endDate, time) })}
              />
            </div>
          </Field>
        </div>

        <Field label="Note" hint="Optional, for your team" htmlFor="eb-note">
          <Textarea
            id="eb-note"
            rows={2}
            value={cfg.note || ""}
            onChange={(e) => draft("note")(e.target.value)}
            onBlur={() => commit({ note: cfg.note })}
            placeholder="e.g. Runs until the venue is half full."
          />
        </Field>
      </div>

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
