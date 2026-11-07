"use client";

import React from "react";
import { Lock, Plus, X } from "lucide-react";

import { Field, SettingRow, SettingsList } from "@/components/internal/shared/screen_kit";
import { EventDatePicker } from "@/components/internal/screens/events/date_time_fields";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Switch } from "@geiger/ui/switch";
import { Textarea } from "@geiger/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@geiger/ui/select";
import { CURRENCIES, dayCount, formatDeadline } from "@/lib/sourcing/rfp_model";

const NONE = "none";

const pad = (n) => String(n).padStart(2, "0");
// ISO <-> the value a datetime-local input wants, in the organiser's own timezone.
export function toLocalInput(iso) {
  const t = Date.parse(iso || "");
  if (!Number.isFinite(t)) return "";
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function fromLocalInput(value) {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

function LockNote({ status }) {
  return (
    <div className="mb-5 flex items-start gap-2 rounded-lg border border-border bg-surface-subtle px-3 py-2.5 text-sm text-text-secondary">
      <Lock className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        {status === "awarded" || status === "cancelled"
          ? "This RFP is finished, so the brief is read-only."
          : "Venues already have this brief, so it's locked to keep every bid comparable. You can still move the deadline and decision date."}
      </span>
    </div>
  );
}

export function BriefSection({ form, patch, locked, final, events }) {
  const days = dayCount(form.startDate, form.endDate);
  const alternates = form.alternateDates || [];
  const setAlt = (i, p) => patch({ alternateDates: alternates.map((d, j) => (j === i ? { ...d, ...p } : d)) });

  return (
    <div className="space-y-8">
      {locked ? <LockNote status={form.status} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" className="sm:col-span-2">
          <Input value={form.title} disabled={locked} onChange={(e) => patch({ title: e.target.value })} />
        </Field>
        <Field label="Event" hint="Awarding can set the winner as this event's venue.">
          <Select value={form.eventId || NONE} disabled={locked} onValueChange={(v) => patch({ eventId: v === NONE ? null : v })}>
            <SelectTrigger className="w-full bg-surface-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Not linked to an event</SelectItem>
              {events.map((ev) => (
                <SelectItem key={ev.id} value={ev.id}>
                  {ev.name || "Untitled event"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Location" hint="City or area — drives the suggested venues.">
          <Input
            value={form.location}
            disabled={locked}
            onChange={(e) => patch({ location: e.target.value })}
            placeholder="e.g. Berlin"
          />
        </Field>
        <Field label="Brief for venues" hint="Shown at the top of every venue's response page." className="sm:col-span-2">
          <Textarea
            rows={4}
            value={form.summary}
            disabled={locked}
            onChange={(e) => patch({ summary: e.target.value })}
            placeholder="What the event is, who's coming and what matters most to you."
          />
        </Field>
      </div>

      <section className="space-y-4">
        <h3 className="border-b border-border pb-3 text-base font-semibold text-foreground">Dates & size</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Start date">
            {locked ? (
              <Input value={form.startDate || "—"} disabled />
            ) : (
              <EventDatePicker value={form.startDate} onChange={(v) => patch({ startDate: v, endDate: form.endDate && form.endDate >= v ? form.endDate : v })} />
            )}
          </Field>
          <Field label="End date" hint={form.startDate ? `${days} day${days === 1 ? "" : "s"}` : undefined}>
            {locked ? (
              <Input value={form.endDate || "—"} disabled />
            ) : (
              <EventDatePicker value={form.endDate} onChange={(v) => patch({ endDate: v })} />
            )}
          </Field>
          <Field label="Expected attendees">
            <Input
              type="number"
              min="0"
              value={form.attendees || ""}
              disabled={locked}
              onChange={(e) => patch({ attendees: Number(e.target.value) || 0 })}
              className="tabular-nums"
            />
          </Field>
        </div>
        <SettingsList>
          <SettingRow
            title="Dates are flexible"
            description="Venues may propose other dates if these are taken."
            control={<Switch checked={form.datesFlexible} disabled={locked} onCheckedChange={(v) => patch({ datesFlexible: v })} />}
          />
        </SettingsList>
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Alternate dates</p>
          {alternates.length === 0 ? (
            <p className="text-xs text-text-tertiary">None — add a fallback window venues can quote against.</p>
          ) : null}
          {alternates.map((d, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
              <Input type="date" value={d.start} disabled={locked} onChange={(e) => setAlt(i, { start: e.target.value })} />
              <Input type="date" value={d.end} disabled={locked} onChange={(e) => setAlt(i, { end: e.target.value })} />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={locked}
                aria-label="Remove alternate dates"
                onClick={() => patch({ alternateDates: alternates.filter((_, j) => j !== i) })}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {!locked ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => patch({ alternateDates: [...alternates, { start: "", end: "" }] })}
            >
              <Plus className="h-4 w-4" /> Add alternate dates
            </Button>
          ) : null}
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="border-b border-border pb-3 text-base font-semibold text-foreground">Budget</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Currency" hint="Venues bid in this currency.">
            <Select value={form.currency} disabled={locked} onValueChange={(v) => patch({ currency: v })}>
              <SelectTrigger className="w-full bg-surface-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Budget from">
            <Input
              type="number"
              min="0"
              value={form.budgetMin ?? ""}
              disabled={locked}
              onChange={(e) => patch({ budgetMin: e.target.value === "" ? null : Number(e.target.value) })}
              className="tabular-nums"
            />
          </Field>
          <Field label="Budget up to" hint="Bids are measured against this.">
            <Input
              type="number"
              min="0"
              value={form.budgetMax ?? ""}
              disabled={locked}
              onChange={(e) => patch({ budgetMax: e.target.value === "" ? null : Number(e.target.value) })}
              className="tabular-nums"
            />
          </Field>
        </div>
        <SettingsList>
          <SettingRow
            title="Show the budget to venues"
            description="Off keeps it internal — used only for the comparison."
            control={<Switch checked={form.shareBudget} disabled={locked} onCheckedChange={(v) => patch({ shareBudget: v })} />}
          />
        </SettingsList>
      </section>

      <section className="space-y-4">
        <h3 className="border-b border-border pb-3 text-base font-semibold text-foreground">Timeline & contact</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Response deadline"
            hint={form.responseDeadline ? `Venues see ${formatDeadline(form.responseDeadline)}.` : "Bids are refused after this."}
          >
            <Input
              type="datetime-local"
              value={toLocalInput(form.responseDeadline)}
              disabled={final}
              onChange={(e) => patch({ responseDeadline: fromLocalInput(e.target.value) })}
            />
          </Field>
          <Field label="Decision date" hint="Bids that lapse before this are flagged.">
            {final ? (
              <Input value={form.decisionDate || "—"} disabled />
            ) : (
              <EventDatePicker value={form.decisionDate} onChange={(v) => patch({ decisionDate: v })} />
            )}
          </Field>
          <Field label="Contact name" hint="Who venues direct questions to.">
            <Input value={form.contactName} disabled={final} onChange={(e) => patch({ contactName: e.target.value })} />
          </Field>
          <Field label="Contact email">
            <Input
              type="email"
              value={form.contactEmail}
              disabled={final}
              onChange={(e) => patch({ contactEmail: e.target.value })}
            />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="border-b border-border pb-3 text-base font-semibold text-foreground">Internal notes</h3>
        <Textarea
          rows={4}
          value={form.notes}
          onChange={(e) => patch({ notes: e.target.value })}
          placeholder="Only your team sees these."
        />
      </section>
    </div>
  );
}

export default BriefSection;
