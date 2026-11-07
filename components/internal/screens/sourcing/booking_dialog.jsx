"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { CalendarCheck, CheckCircle2, Clock, Loader2, TriangleAlert } from "lucide-react";

import { Field } from "@/components/internal/shared/screen_kit";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
  cn,
} from "@geiger/ui";
import { EventDatePicker, EventTimeField } from "@/components/internal/screens/events/date_time_fields";
import { bookVenueSpace } from "@/lib/supabase/venue_bookings";
import { checkSlot } from "@/lib/venue_booking/availability";
import { describeItem, formatMoney } from "@/lib/venue_booking/pricing";
import { SETUP_STYLES } from "@/lib/venue_booking/styles";
import { formatRange, safeTimeZone, zoneAbbreviation, zonedInstant } from "@/lib/venue_booking/time";

import { HOLD_OPTIONS, formatHours } from "./instant_book_constants";

const NONE = "none";

export function QuoteBreakdown({ quote, className }) {
  if (!quote) return null;
  return (
    <div className={cn("rounded-xl border border-border bg-surface-subtle p-4", className)}>
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-text-secondary">Price</p>
      <div className="divide-y divide-border">
        {quote.lines.map((line) => (
          <div key={line.date} className="flex items-start justify-between gap-3 py-2 text-sm">
            <div className="min-w-0">
              <p className="text-foreground">
                {line.date} · {formatHours(line.hours)}
              </p>
              <p className="text-xs text-text-secondary">
                {line.items.length ? line.items.map((it) => describeItem(it, quote.currency)).join(" + ") : "No charge"}
              </p>
            </div>
            <span className="shrink-0 tabular-nums text-foreground">{formatMoney(line.amount, quote.currency)}</span>
          </div>
        ))}
      </div>
      <div className="mt-1 flex items-center justify-between border-t border-border-strong pt-2 text-sm">
        <span className="text-foreground">Total</span>
        <span className="font-semibold tabular-nums text-foreground dark:text-white">{formatMoney(quote.total, quote.currency)}</span>
      </div>
      {quote.priced === false ? (
        <p className="mt-2 text-xs text-text-secondary">This space has no published rate, so it books at no charge.</p>
      ) : null}
    </div>
  );
}

function BookingForm({ seed, spaces, venueById, events, bookings, now, user, onDone, onBooked }) {
  const [form, setForm] = useState(() => ({
    spaceId: seed.spaceId || spaces[0]?.id || "",
    date: seed.date || "",
    startTime: seed.startTime || "09:00",
    endDate: seed.endDate || seed.date || "",
    endTime: seed.endTime || "17:00",
    setupStyle: seed.setupStyle || NONE,
    attendees: seed.attendees ? String(seed.attendees) : "",
    title: "",
    eventId: NONE,
    contactName: user?.name || "",
    contactEmail: user?.email || "",
    contactPhone: "",
    notes: "",
    holdHours: "48",
    notify: true,
  }));
  const [pending, setPending] = useState(null);
  const set = (partial) => setForm((f) => ({ ...f, ...partial }));

  const space = spaces.find((s) => s.id === form.spaceId) || null;
  const venue = space ? venueById.get(space.venueId) : null;
  const tz = safeTimeZone(venue?.timezone);
  const startsAt = zonedInstant(form.date, form.startTime, tz);
  const endsAt = zonedInstant(form.endDate || form.date, form.endTime, tz);
  const style = form.setupStyle === NONE ? "" : form.setupStyle;
  const event = events.find((e) => e.id === form.eventId) || null;

  const check = !space
    ? { ok: false, message: "Pick a space." }
    : !startsAt || !endsAt
      ? { ok: false, message: "Pick a start and end time." }
      : checkSlot({ space, timeZone: tz, startsAt, endsAt, bookings, setupStyle: style, attendees: form.attendees, now });

  const submit = async (status) => {
    if (!check.ok) {
      toast.error(check.message || "That slot can't be booked.");
      return;
    }
    if (form.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail.trim())) {
      toast.error("That contact email doesn't look right.");
      return;
    }
    setPending(status);
    const res = await bookVenueSpace({
      spaceId: space.id,
      startsAt,
      endsAt,
      status,
      holdHours: Number(form.holdHours),
      eventId: event?.id || null,
      title: form.title.trim() || event?.name || `${space.name} booking`,
      setupStyle: style,
      attendees: form.attendees,
      contactName: form.contactName.trim(),
      contactEmail: form.contactEmail.trim(),
      contactPhone: form.contactPhone.trim(),
      notes: form.notes,
    });
    setPending(null);
    if (!res.ok) {
      toast.error(res.message || "Couldn't book that slot.");
      return;
    }
    onBooked(res.booking, { notify: form.notify });
    onDone();
  };

  const onStartDate = (date) => set({ date, endDate: !form.endDate || form.endDate < date ? date : form.endDate });

  return (
    <>
      <div className="grid max-h-[65vh] gap-4 overflow-y-auto p-5">
        <Field label="Space">
          <Select value={form.spaceId} onValueChange={(v) => set({ spaceId: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Pick a space" />
            </SelectTrigger>
            <SelectContent>
              {spaces.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} · {venueById.get(s.venueId)?.name || "Venue"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starts">
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <EventDatePicker value={form.date} onChange={onStartDate} />
              <EventTimeField value={form.startTime} onChange={(v) => set({ startTime: v })} className="w-28" />
            </div>
          </Field>
          <Field label="Ends">
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <EventDatePicker value={form.endDate} onChange={(v) => set({ endDate: v })} />
              <EventTimeField value={form.endTime} onChange={(v) => set({ endTime: v })} className="w-28" />
            </div>
          </Field>
        </div>

        <div
          className={cn(
            "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
            check.ok
              ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
          )}
        >
          {check.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>
            {check.ok
              ? `Available · ${formatRange(startsAt, endsAt, tz)} (${zoneAbbreviation(startsAt, tz)})`
              : check.clash
                ? `${check.message} ${check.clash.reference} runs ${formatRange(check.clash.startsAt, check.clash.endsAt, tz)}.`
                : check.message}
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Setup">
            <Select value={form.setupStyle} onValueChange={(v) => set({ setupStyle: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No specific setup</SelectItem>
                {SETUP_STYLES.map((s) => {
                  const cap = Number(space?.capacities?.[s.key]) || 0;
                  return (
                    <SelectItem key={s.key} value={s.key}>
                      {s.label}
                      {cap ? ` (up to ${cap})` : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Attendees">
            <Input type="number" min={0} value={form.attendees} onChange={(e) => set({ attendees: e.target.value })} placeholder="e.g. 120" />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Linked event" hint="Optional — shown on the booking.">
            <Select value={form.eventId} onValueChange={(v) => set({ eventId: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No event</SelectItem>
                {events.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name || "Untitled event"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Booking title">
            <Input
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder={event?.name || (space ? `${space.name} booking` : "e.g. Product launch day")}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Contact name">
            <Input value={form.contactName} onChange={(e) => set({ contactName: e.target.value })} placeholder="Who's running it" />
          </Field>
          <Field label="Contact email">
            <Input type="email" value={form.contactEmail} onChange={(e) => set({ contactEmail: e.target.value })} placeholder="name@company.com" />
          </Field>
          <Field label="Contact phone">
            <Input value={form.contactPhone} onChange={(e) => set({ contactPhone: e.target.value })} placeholder="Optional" />
          </Field>
        </div>

        <Field label="Notes for the venue">
          <Textarea
            rows={2}
            value={form.notes}
            onChange={(e) => set({ notes: e.target.value })}
            placeholder="Access times, AV, catering, load-in…"
          />
        </Field>

        <QuoteBreakdown quote={check.quote} />

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Email the venue and contact</p>
            <p className="text-xs text-text-secondary">
              {venue?.contactEmail ? `Venue contact: ${venue.contactEmail}` : "This venue has no contact email yet."}
            </p>
          </div>
          <Switch checked={form.notify} onCheckedChange={(v) => set({ notify: v })} aria-label="Send emails" />
        </div>
      </div>

      <DialogFooter className="flex-col gap-2 border-t border-border bg-surface-subtle/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-text-tertiary" />
          <Select value={form.holdHours} onValueChange={(v) => set({ holdHours: v })}>
            <SelectTrigger className="h-9 w-32" aria-label="Hold length">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HOLD_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  Hold {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            disabled={!!pending || !check.ok}
            onClick={() => submit("hold")}
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
          >
            {pending === "hold" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Place hold
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={!!pending || !check.ok}
            onClick={() => submit("confirmed")}
          >
            {pending === "confirmed" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-4 w-4" />}
            Book now{check.quote?.priced ? ` · ${formatMoney(check.quote.total, check.quote.currency)}` : ""}
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}

export function BookingDialog({ open, onOpenChange, seed, spaces, venueById, events, bookings, now, user, onBooked }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 overflow-hidden bg-background p-0">
        <DialogHeader className="flex-row items-center gap-3 space-y-0 border-b border-border p-5 text-left">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-subtle text-foreground">
            <CalendarCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0 space-y-0.5">
            <DialogTitle className="text-base">Book a space</DialogTitle>
            <DialogDescription className="text-xs">
              Priced from the venue&apos;s published rates. Times are the venue&apos;s local time.
            </DialogDescription>
          </div>
        </DialogHeader>
        {open && seed ? (
          <BookingForm
            key={seed.key}
            seed={seed}
            spaces={spaces}
            venueById={venueById}
            events={events}
            bookings={bookings}
            now={now}
            user={user}
            onBooked={onBooked}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export default BookingDialog;
