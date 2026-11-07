"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { Ban, CalendarCheck, CalendarPlus, Download, Loader2, Mail, Save } from "lucide-react";

import { Field, StatusPill } from "@/components/internal/shared/screen_kit";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Switch,
  Textarea,
} from "@geiger/ui";
import { updateVenueBooking } from "@/lib/supabase/venue_bookings";
import { bookingDisplayStatus } from "@/lib/venue_booking/availability";
import { buildBookingIcs, googleCalendarUrl, icsFileName } from "@/lib/venue_booking/ics";
import { setupStyleLabel } from "@/lib/venue_booking/styles";
import { formatInZone, formatRange, hoursBetween, zoneAbbreviation } from "@/lib/venue_booking/time";

import { QuoteBreakdown } from "./booking_dialog";
import { BOOKING_STATUS_MAP, EMAIL_KIND_LABELS, formatHours } from "./instant_book_constants";

const NONE = "none";

const stamp = (iso, tz) =>
  iso ? formatInZone(iso, tz, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }) : "—";

function Info({ label, children }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">{label}</p>
      <div className="mt-1 text-sm text-foreground">{children}</div>
    </div>
  );
}

export function CancelBookingDialog({ booking, onOpenChange, onConfirm }) {
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(true);
  const [pending, setPending] = useState(false);

  const submit = async () => {
    setPending(true);
    await onConfirm(booking, { reason: reason.trim(), notify });
    setPending(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={!!booking} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel booking</DialogTitle>
          <DialogDescription>
            Cancel <span className="font-medium text-foreground">{booking?.reference}</span>? The time is released
            straight away. This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Reason" hint="Included in the cancellation email.">
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Event moved to a larger room." />
          </Field>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-foreground">Email the venue and contact</span>
            <Switch checked={notify} onCheckedChange={setNotify} aria-label="Send cancellation email" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Keep booking
          </Button>
          <Button className="bg-red-500/90 text-white hover:bg-red-500" disabled={pending} onClick={submit}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />} Cancel booking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DrawerBody({ booking, space, venue, events, now, onChanged, onConfirm, onResend, onCancel }) {
  const tz = booking.timezone || venue?.timezone || "UTC";
  const status = bookingDisplayStatus(booking, now);
  const event = events.find((e) => e.id === booking.eventId) || null;
  const [details, setDetails] = useState(() => ({
    title: booking.title,
    eventId: booking.eventId || NONE,
    contactName: booking.contactName,
    contactEmail: booking.contactEmail,
    contactPhone: booking.contactPhone,
    notes: booking.notes,
  }));
  const [busy, setBusy] = useState(null);
  const set = (partial) => setDetails((d) => ({ ...d, ...partial }));

  const dirty =
    details.title !== booking.title ||
    (details.eventId === NONE ? null : details.eventId) !== (booking.eventId || null) ||
    details.contactName !== booking.contactName ||
    details.contactEmail !== booking.contactEmail ||
    details.contactPhone !== booking.contactPhone ||
    details.notes !== booking.notes;

  const run = async (key, fn) => {
    setBusy(key);
    await fn();
    setBusy(null);
  };

  const saveDetails = () =>
    run("save", async () => {
      const saved = await updateVenueBooking(booking.id, {
        ...details,
        eventId: details.eventId === NONE ? null : details.eventId,
      });
      if (!saved) {
        toast.error("Couldn't save the booking details.");
        return;
      }
      onChanged(saved);
      toast.success("Booking updated.");
    });

  const calendar = { booking, spaceName: space?.name || "", venueName: venue?.name || "", eventName: event?.name || "" };

  const downloadIcs = () => {
    const blob = new Blob([buildBookingIcs(calendar)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = icsFileName(booking);
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const emails = Array.isArray(booking.metadata?.emails) ? booking.metadata.emails : [];
  const holdExpired = status === "Hold expired";
  const live = booking.status !== "cancelled";
  const quote = {
    lines: booking.priceBreakdown.lines,
    currency: booking.currency,
    total: booking.total,
    priced: booking.priceBreakdown.lines.some((l) => l.items?.length) || booking.total > 0,
  };

  return (
    <>
      <SheetHeader className="border-b border-border p-5">
        <div className="flex items-center gap-2">
          <SheetTitle className="text-base">{booking.reference}</SheetTitle>
          <StatusPill status={status} map={BOOKING_STATUS_MAP} />
        </div>
        <SheetDescription>
          {[space?.name, venue?.name].filter(Boolean).join(" · ") || "Venue space"}
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-6 p-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Info label="When">
              {formatRange(booking.startsAt, booking.endsAt, tz)}
              <span className="ml-1 text-xs text-text-secondary">{zoneAbbreviation(booking.startsAt, tz)}</span>
            </Info>
          </div>
          <Info label="Duration">{formatHours(hoursBetween(booking.startsAt, booking.endsAt))}</Info>
          <Info label="Setup">
            {booking.setupStyle ? setupStyleLabel(booking.setupStyle) : "Any"}
            {booking.attendees ? <span className="text-text-secondary"> · {booking.attendees} guests</span> : null}
          </Info>
          <Info label="Linked event">{event?.name || <span className="text-text-secondary">None</span>}</Info>
          <Info label="Booked">{stamp(booking.createdAt, tz)}</Info>
          {booking.status === "hold" ? (
            <div className="col-span-2">
              <Info label={holdExpired ? "Hold expired" : "Hold expires"}>
                {stamp(booking.holdExpiresAt, tz)}
                {holdExpired ? (
                  <p className="text-xs text-text-secondary">No longer blocks the space. Confirm it if the time is still free.</p>
                ) : null}
              </Info>
            </div>
          ) : null}
          {booking.status === "cancelled" ? (
            <div className="col-span-2">
              <Info label="Cancelled">
                {stamp(booking.cancelledAt, tz)}
                {booking.cancelReason ? <p className="text-xs text-text-secondary">{booking.cancelReason}</p> : null}
              </Info>
            </div>
          ) : null}
        </div>

        <QuoteBreakdown quote={quote} />

        <div className="flex flex-wrap gap-2">
          {booking.status === "hold" ? (
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={!!busy}
              onClick={() => run("confirm", () => onConfirm(booking))}
            >
              {busy === "confirm" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-4 w-4" />}
              Confirm booking
            </Button>
          ) : null}
          {live ? (
            <Button
              variant="outline"
              disabled={!!busy}
              onClick={() => run("resend", () => onResend(booking))}
              className="border-border bg-surface-card text-muted-foreground hover:bg-surface-active hover:text-foreground"
            >
              {busy === "resend" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Resend {booking.status === "hold" ? "hold notice" : "confirmation"}
            </Button>
          ) : null}
          <Button
            variant="outline"
            onClick={downloadIcs}
            className="border-border bg-surface-card text-muted-foreground hover:bg-surface-active hover:text-foreground"
          >
            <Download className="h-4 w-4" /> .ics
          </Button>
          {live ? (
            <Button
              asChild
              variant="outline"
              className="border-border bg-surface-card text-muted-foreground hover:bg-surface-active hover:text-foreground"
            >
              <a href={googleCalendarUrl(calendar)} target="_blank" rel="noreferrer">
                <CalendarPlus className="h-4 w-4" /> Google
              </a>
            </Button>
          ) : null}
          {live && status !== "Completed" ? (
            <Button
              variant="outline"
              onClick={() => onCancel(booking)}
              className="border-border bg-surface-card text-red-700 dark:text-red-300 hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-300"
            >
              <Ban className="h-4 w-4" /> Cancel
            </Button>
          ) : null}
        </div>

        <div className="space-y-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">Details</p>
          <Field label="Title">
            <Input value={details.title} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <Field label="Linked event">
            <Select value={details.eventId} onValueChange={(v) => set({ eventId: v })}>
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
          <div className="grid grid-cols-2 gap-4">
            <Field label="Contact name">
              <Input value={details.contactName} onChange={(e) => set({ contactName: e.target.value })} />
            </Field>
            <Field label="Contact phone">
              <Input value={details.contactPhone} onChange={(e) => set({ contactPhone: e.target.value })} />
            </Field>
          </div>
          <Field label="Contact email" hint="Gets the confirmation and cancellation emails.">
            <Input type="email" value={details.contactEmail} onChange={(e) => set({ contactEmail: e.target.value })} />
          </Field>
          <Field label="Notes">
            <Textarea rows={3} value={details.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Field>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={!dirty || !!busy}
            onClick={saveDetails}
          >
            {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save details
          </Button>
        </div>

        <div>
          <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-text-secondary">Emails</p>
          {emails.length ? (
            <ol className="space-y-3">
              {emails.map((e, i) => (
                <li key={`${e.at}-${e.to}-${i}`} className="flex gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-border-strong" />
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">
                      {EMAIL_KIND_LABELS[e.kind] || "Email"} to {e.role === "venue" ? "venue" : "contact"} ·{" "}
                      <span className={e.status === "sent" ? "" : "text-red-700 dark:text-red-300"}>
                        {e.status === "sent" ? "sent" : e.status === "off" ? "switched off" : "failed"}
                      </span>
                    </p>
                    <p className="truncate text-xs text-text-secondary">{e.to}</p>
                    <p className="text-xs text-text-tertiary">{stamp(e.at, tz)}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="flex items-center gap-2 text-sm text-text-secondary">
              <Mail className="h-4 w-4" /> No emails sent yet.
            </p>
          )}
        </div>
      </div>
    </>
  );
}

export function BookingDrawer({ booking, space, venue, events, now, onOpenChange, onChanged, onConfirm, onResend, onCancel }) {
  return (
    <Sheet open={!!booking} onOpenChange={(o) => !o && onOpenChange?.(false)}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
        {booking ? (
          <DrawerBody
            key={`${booking.id}-${booking.updatedAt}`}
            booking={booking}
            space={space}
            venue={venue}
            events={events}
            now={now}
            onChanged={onChanged}
            onConfirm={onConfirm}
            onResend={onResend}
            onCancel={onCancel}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export default BookingDrawer;
