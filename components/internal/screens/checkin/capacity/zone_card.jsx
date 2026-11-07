"use client";

import React, { useState } from "react";
import { AlertTriangle, Loader2, Pencil } from "lucide-react";

import { Field, StatusPill } from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { cn } from "@/lib/utils";
import { RowSelect } from "../checkin_kit";
import { FlowSparkline } from "./flow_sparkline";

export const LEVEL_MAP = {
  none: { label: "No cap", variant: "neutral", dotClass: "bg-zinc-400" },
  ok: { label: "Open", variant: "success", dotClass: "bg-emerald-400" },
  warn: { label: "Near capacity", variant: "warning", dotClass: "bg-amber-400" },
  full: { label: "Full", variant: "danger", dotClass: "bg-red-400" },
  over: { label: "Over capacity", variant: "danger", dotClass: "bg-red-500" },
};

const BAR = { none: "bg-zinc-400", ok: "bg-emerald-400", warn: "bg-amber-400", full: "bg-red-500", over: "bg-red-500" };

const REENTRY_LABELS = { once: "Single entry", multi: "Re-entry allowed" };

function CapEditor({ card, defaultReentry, onSave, onCancel, eventCapacity }) {
  const [hardCap, setHardCap] = useState(card.cap === null ? "" : String(card.cap));
  const [warnPct, setWarnPct] = useState(String(card.warnPct || 85));
  const [reentry, setReentry] = useState(card.reentry || "inherit");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const ok = await onSave(card, { hardCap: hardCap.trim() === "" ? null : Number(hardCap), warnPct: Number(warnPct) || 85, reentry });
    setSaving(false);
    if (ok) onCancel();
  };

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface-card p-3">
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Hard cap"
          hint={card.venue && eventCapacity ? `Ticket capacity is ${Number(eventCapacity).toLocaleString("en-US")}.` : "Blank = no cap."}
        >
          <Input type="number" min={0} inputMode="numeric" value={hardCap} onChange={(e) => setHardCap(e.target.value)} placeholder="No cap" />
        </Field>
        <Field label="Warn at %" hint="Turns amber from here.">
          <Input type="number" min={1} max={100} inputMode="numeric" value={warnPct} onChange={(e) => setWarnPct(e.target.value)} />
        </Field>
      </div>
      <Field label="Re-entry">
        <RowSelect
          value={reentry}
          onChange={setReentry}
          className="h-9 w-full bg-surface-card"
          options={[
            { value: "inherit", label: `Project default (${REENTRY_LABELS[defaultReentry] || "Single entry"})` },
            { value: "once", label: "Single entry — no re-entry after exit" },
            { value: "multi", label: "Re-entry allowed after exit" },
          ]}
        />
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save
        </Button>
      </div>
    </div>
  );
}

export function ZoneCard({ card, series, bucketMinutes, defaultReentry, eventCapacity, onSave, large = false }) {
  const [editing, setEditing] = useState(false);
  const capped = card.cap !== null;
  const width = capped ? Math.min(100, card.cap > 0 ? (card.occupancy / card.cap) * 100 : 100) : 0;
  const reentry = card.reentry === "inherit" ? defaultReentry : card.reentry;

  return (
    <div className={cn("flex flex-col gap-4 rounded-xl border border-border bg-surface-subtle", large ? "p-6" : "p-5")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn("truncate font-semibold text-foreground", large ? "text-xl" : "text-base")}>{card.name}</p>
          <p className="truncate text-xs text-text-secondary">
            {card.venue ? "Door admissions, no zone or session" : card.unlisted ? "Scanned into, not in the event's zone list" : "Zone"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <StatusPill status={card.level} map={LEVEL_MAP} />
          {onSave && !large ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-text-secondary hover:text-foreground"
              aria-label={`Edit ${card.name} cap`}
              onClick={() => setEditing((v) => !v)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex items-end justify-between gap-3">
        <p className="tabular-nums">
          <span className={cn("font-bold text-foreground dark:text-white", large ? "text-6xl" : "text-3xl")}>
            {card.occupancy.toLocaleString("en-US")}
          </span>
          <span className={cn("text-text-tertiary", large ? "text-2xl" : "text-base")}>
            {" "}/ {capped ? card.cap.toLocaleString("en-US") : "no cap"}
          </span>
        </p>
        {card.pct !== null ? (
          <span className={cn("tabular-nums text-text-secondary", large ? "text-2xl" : "text-sm")}>{card.pct}%</span>
        ) : null}
      </div>

      <div className="relative h-2 overflow-hidden rounded-full bg-surface-strong">
        {capped ? (
          <>
            <div className={cn("h-full rounded-full transition-all", BAR[card.level])} style={{ width: `${width}%` }} />
            <div className="absolute inset-y-0 w-px bg-foreground/30" style={{ left: `${Math.min(100, card.warnPct)}%` }} aria-hidden="true" />
          </>
        ) : null}
      </div>

      <FlowSparkline series={series} bucketMinutes={bucketMinutes} height={large ? 72 : 56} />

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-secondary">
        <span className="tabular-nums">In {card.admitted.toLocaleString("en-US")}</span>
        <span className="tabular-nums">Out {card.exited.toLocaleString("en-US")}</span>
        <span>{REENTRY_LABELS[reentry] || "Single entry"}</span>
        {capped ? <span>Warns at {card.warnPct}%</span> : null}
      </div>

      {card.overCapacityAdmits > 0 ? (
        <p className="flex items-start gap-1.5 text-xs text-red-700 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {card.overCapacityAdmits} offline {card.overCapacityAdmits === 1 ? "admit" : "admits"} went past the cap on sync — review under Offline Check-in.
        </p>
      ) : null}

      {editing ? (
        <CapEditor
          card={card}
          defaultReentry={defaultReentry}
          eventCapacity={eventCapacity}
          onSave={onSave}
          onCancel={() => setEditing(false)}
        />
      ) : null}
    </div>
  );
}

export default ZoneCard;
