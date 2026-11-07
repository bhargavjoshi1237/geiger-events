"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { CalendarClock, CalendarPlus, Loader2, MapPin, XCircle } from "lucide-react";

import { EmptyState, StatusPill } from "@/components/internal/shared/screen_kit";
import { Badge } from "@geiger/ui/badge";
import { Button } from "@geiger/ui/button";
import { Textarea } from "@geiger/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@geiger/ui/dialog";
import { downloadMeetingIcs } from "@/lib/meetings/ics";
import { dateToWall, fmtDayLabel, fmtRange, fmtSlot, tzAbbrev } from "@/lib/meetings/time";
import { Card, SectionTitle } from "../portal_kit";
import { MEETING_STATUS, PersonAvatar, postJson, roleLine } from "./meetings_kit";

const ended = (m) => Date.parse(m.endsAt) <= Date.now();

function MeetingCard({ meeting, event, tz, onCancel }) {
  const upcoming = meeting.status === "scheduled" && !ended(meeting);
  const names = meeting.others.map((o) => o.name).join(" & ");
  const where = meeting.locationName || [event.venue, event.city].filter(Boolean).join(", ");

  const addToCalendar = () =>
    downloadMeetingIcs({
      id: meeting.id,
      startsAt: meeting.startsAt,
      endsAt: meeting.endsAt,
      status: meeting.status,
      title: `Meeting: ${names} · ${event.name}`,
      location: [meeting.locationName, event.venue, event.city].filter(Boolean).join(", "),
      description: `1:1 meeting at ${event.name}.`,
    });

  return (
    <Card className={upcoming ? "space-y-3" : "space-y-3 opacity-75"}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold tabular-nums text-foreground">{fmtRange(meeting.startsAt, meeting.endsAt, tz)}</p>
          {where ? (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-text-secondary">
              <MapPin className="h-3.5 w-3.5" /> {where}
            </p>
          ) : null}
        </div>
        {meeting.status !== "scheduled" ? (
          <StatusPill status={meeting.status} map={MEETING_STATUS} />
        ) : meeting.bookedByOrganiser ? (
          <Badge variant="info">Booked by the organiser</Badge>
        ) : null}
      </div>

      <div className="space-y-2">
        {meeting.others.map((o) => (
          <div key={o.memberId} className="flex items-center gap-3">
            <PersonAvatar person={o} className="h-9 w-9" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{o.name}</p>
              <p className="truncate text-xs text-text-secondary">{roleLine(o) || "Attendee"}</p>
            </div>
          </div>
        ))}
      </div>

      {meeting.status === "cancelled" && meeting.cancelReason ? (
        <p className="text-xs text-text-tertiary">“{meeting.cancelReason}”</p>
      ) : null}

      {upcoming ? (
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={addToCalendar}
            className="border-border bg-surface-card text-foreground hover:bg-surface-hover"
          >
            <CalendarPlus className="h-4 w-4" /> Add to calendar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onCancel(meeting)}
            className="border-border bg-surface-card text-foreground hover:bg-surface-hover"
          >
            <XCircle className="h-4 w-4" /> Cancel
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

function CancelDialog({ eventId, meeting, tz, onClose, onDone }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [prevId, setPrevId] = useState(null);
  if ((meeting?.id || null) !== prevId) {
    setPrevId(meeting?.id || null);
    setReason("");
  }

  const cancel = async () => {
    setBusy(true);
    const { ok, data } = await postJson(`/api/portal/meetings/${eventId}/meetings/${meeting.id}`, {
      action: "cancel",
      reason: reason.trim(),
    });
    setBusy(false);
    if (!ok) {
      toast.error(data.error || "Couldn't cancel the meeting.");
      return;
    }
    toast.success("Meeting cancelled. We've let them know.");
    onDone();
  };

  return (
    <Dialog open={Boolean(meeting)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        {meeting ? (
          <>
            <DialogHeader>
              <DialogTitle>Cancel this meeting?</DialogTitle>
              <DialogDescription>
                {meeting.others.map((o) => o.name).join(" & ")} · {fmtSlot(meeting.startsAt, meeting.endsAt, tz)}
              </DialogDescription>
            </DialogHeader>
            <Textarea
              rows={3}
              value={reason}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Let them know why (optional)…"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>
                Keep it
              </Button>
              <Button disabled={busy} onClick={cancel} className="bg-red-500/90 text-white hover:bg-red-500">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                Cancel meeting
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function MyMeetingsTab({ eventId, state, tz, onChanged }) {
  const [cancelling, setCancelling] = useState(null);
  const upcoming = state.meetings.filter((m) => m.status === "scheduled" && !ended(m));
  const rest = state.meetings
    .filter((m) => !upcoming.includes(m))
    .sort((a, b) => String(b.startsAt).localeCompare(String(a.startsAt)));

  const byDay = [];
  for (const m of upcoming) {
    const date = dateToWall(m.startsAt, tz)?.date || "";
    const group = byDay.find((g) => g.date === date);
    if (group) group.items.push(m);
    else byDay.push({ date, items: [m] });
  }

  if (!state.meetings.length) {
    return (
      <div className="rounded-xl border border-border bg-surface-subtle">
        <EmptyState
          icon={CalendarClock}
          title="No meetings yet"
          description="When someone accepts your request — or you accept theirs — the meeting appears here with its time and table."
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <p className="text-xs text-text-tertiary">Times in {tzAbbrev(tz)}</p>
      {byDay.map((g) => (
        <section key={g.date}>
          <SectionTitle>{fmtDayLabel(g.date, { long: true })}</SectionTitle>
          <div className="grid gap-3 lg:grid-cols-2">
            {g.items.map((m) => (
              <MeetingCard key={m.id} meeting={m} event={state.event} tz={tz} onCancel={setCancelling} />
            ))}
          </div>
        </section>
      ))}
      {rest.length ? (
        <section>
          <SectionTitle>Past & cancelled</SectionTitle>
          <div className="grid gap-3 lg:grid-cols-2">
            {rest.map((m) => (
              <MeetingCard key={m.id} meeting={m} event={state.event} tz={tz} onCancel={setCancelling} />
            ))}
          </div>
        </section>
      ) : null}

      <CancelDialog
        eventId={eventId}
        meeting={cancelling}
        tz={tz}
        onClose={() => setCancelling(null)}
        onDone={() => {
          setCancelling(null);
          onChanged();
        }}
      />
    </div>
  );
}

export default MyMeetingsTab;
