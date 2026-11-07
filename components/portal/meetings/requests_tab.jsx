"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarCheck, Check, Inbox, Loader2, Undo2, X } from "lucide-react";

import { EmptyState, StatusPill } from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { Textarea } from "@geiger/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@geiger/ui/dialog";
import { LogoLoading } from "@geiger/ui";
import { fmtSlot, tzAbbrev } from "@/lib/meetings/time";
import { Card, SectionTitle, fmtDateTime } from "../portal_kit";
import { PersonAvatar, REQUEST_STATUS, SlotChips, getJson, postJson, roleLine } from "./meetings_kit";

// Recipient picks one of the suggested times (or any other time free for both) to confirm.
function AcceptDialog({ eventId, request, tz, onClose, onDone }) {
  const [slots, setSlots] = useState(null);
  const [choice, setChoice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [prevId, setPrevId] = useState(null);
  if ((request?.id || null) !== prevId) {
    setPrevId(request?.id || null);
    setSlots(null);
    setChoice(null);
  }

  useEffect(() => {
    if (!request) return undefined;
    let alive = true;
    getJson(`/api/portal/meetings/${eventId}/slots?with=${request.other.memberId}`).then(({ ok, data }) => {
      if (!alive) return;
      if (!ok) toast.error(data.error || "Couldn't load free times.");
      setSlots(ok ? data.slots || [] : []);
    });
    return () => {
      alive = false;
    };
  }, [eventId, request]);

  const suggested = useMemo(
    () => new Set((request?.proposedSlots || []).map((s) => new Date(s.start).toISOString())),
    [request],
  );
  const proposedFree = useMemo(() => (slots || []).filter((s) => suggested.has(s.start)), [slots, suggested]);
  const others = useMemo(() => (slots || []).filter((s) => !suggested.has(s.start)), [slots, suggested]);
  const selected = useMemo(() => new Set(choice ? [choice.start] : []), [choice]);
  const toggle = (s) => setChoice((cur) => (cur?.start === s.start ? null : s));

  const accept = async () => {
    setBusy(true);
    const { ok, data } = await postJson(`/api/portal/meetings/${eventId}/requests/${request.id}`, {
      action: "accept",
      start: choice.start,
      end: choice.end,
    });
    setBusy(false);
    if (!ok) {
      toast.error(data.error || "Couldn't book the meeting.");
      return;
    }
    toast.success(`Meeting with ${request.other.name} confirmed.`);
    onDone();
  };

  return (
    <Dialog open={Boolean(request)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        {request ? (
          <>
            <DialogHeader>
              <DialogTitle>Meet {request.other.name}</DialogTitle>
              <DialogDescription>Pick the time that works. Times in {tzAbbrev(tz)}.</DialogDescription>
            </DialogHeader>
            {slots === null ? (
              <div className="flex justify-center py-8">
                <LogoLoading size={36} />
              </div>
            ) : (
              <div className="max-h-[50vh] space-y-5 overflow-y-auto pr-1">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Times they suggested</p>
                  <SlotChips
                    slots={proposedFree}
                    tz={tz}
                    selected={selected}
                    onToggle={toggle}
                    emptyText="None of the suggested times are free any more."
                  />
                </div>
                {others.length ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Other times you&apos;re both free</p>
                    <SlotChips slots={others} tz={tz} selected={selected} onToggle={toggle} />
                  </div>
                ) : null}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button
                disabled={!choice || busy}
                onClick={accept}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-4 w-4" />}
                Confirm meeting
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function RequestCard({ request, tz, windowOpen, onAccept, onDecline, onWithdraw }) {
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const incoming = request.direction === "incoming";
  const pending = request.status === "pending";

  const run = async (fn) => {
    setBusy(true);
    await fn();
    setBusy(false);
  };

  return (
    <Card className="space-y-3">
      <div className="flex items-start gap-3">
        <PersonAvatar person={request.other} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            {incoming ? request.other.name : `To ${request.other.name}`}
          </p>
          <p className="truncate text-xs text-text-secondary">{roleLine(request.other) || "Attendee"}</p>
        </div>
        {pending ? (
          <span className="shrink-0 text-xs text-text-tertiary">{fmtDateTime(request.createdAt)}</span>
        ) : (
          <StatusPill status={request.status} map={REQUEST_STATUS} />
        )}
      </div>

      {request.message ? (
        <p className="whitespace-pre-wrap rounded-lg border border-border bg-surface-subtle px-3 py-2 text-sm text-muted-foreground">
          {request.message}
        </p>
      ) : null}

      {request.proposedSlots.length && pending ? (
        <ul className="space-y-0.5 text-xs text-text-secondary">
          {request.proposedSlots.map((s) => (
            <li key={s.start}>{fmtSlot(s.start, s.end, tz)}</li>
          ))}
        </ul>
      ) : null}

      {request.declineNote && !incoming ? (
        <p className="text-xs text-text-tertiary">“{request.declineNote}”</p>
      ) : null}

      {pending && incoming ? (
        declining ? (
          <div className="space-y-2">
            <Textarea
              rows={2}
              value={note}
              maxLength={500}
              autoFocus
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a short note (optional)…"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setDeclining(false)}>
                Back
              </Button>
              <Button
                size="sm"
                disabled={busy}
                onClick={() => run(() => onDecline(request, note))}
                className="bg-red-500/90 text-white hover:bg-red-500"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                Decline
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeclining(true)}
              className="border-border bg-surface-card text-foreground hover:bg-surface-hover"
            >
              <X className="h-4 w-4" /> Decline
            </Button>
            <Button
              size="sm"
              disabled={!windowOpen}
              onClick={() => onAccept(request)}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Check className="h-4 w-4" /> Accept
            </Button>
          </div>
        )
      ) : null}

      {pending && !incoming ? (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => run(() => onWithdraw(request))}
            className="border-border bg-surface-card text-foreground hover:bg-surface-hover"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
            Withdraw
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

export function RequestsTab({ eventId, state, tz, onChanged }) {
  const [accepting, setAccepting] = useState(null);
  const windowOpen = state.window === "open";
  const incoming = state.requests.filter((r) => r.direction === "incoming" && r.status === "pending");
  const outgoing = state.requests.filter((r) => r.direction === "outgoing" && r.status === "pending");
  const history = state.requests.filter((r) => r.status !== "pending");

  const respond = async (request, body, success) => {
    const { ok, data } = await postJson(`/api/portal/meetings/${eventId}/requests/${request.id}`, body);
    if (!ok) {
      toast.error(data.error || "Something went wrong.");
      return;
    }
    toast.success(success);
    onChanged();
  };

  if (!state.requests.length) {
    return (
      <div className="rounded-xl border border-border bg-surface-subtle">
        <EmptyState
          icon={Inbox}
          title="No requests yet"
          description="Requests you send and receive show up here. Find someone in People to get started."
        />
      </div>
    );
  }

  const section = (title, list) =>
    list.length ? (
      <section>
        <SectionTitle>{title}</SectionTitle>
        <div className="grid gap-3 lg:grid-cols-2">
          {list.map((r) => (
            <RequestCard
              key={r.id}
              request={r}
              tz={tz}
              windowOpen={windowOpen}
              onAccept={setAccepting}
              onDecline={(req, note) => respond(req, { action: "decline", note }, "Request declined.")}
              onWithdraw={(req) => respond(req, { action: "cancel" }, "Request withdrawn.")}
            />
          ))}
        </div>
      </section>
    ) : null;

  return (
    <div className="space-y-8">
      {section("Waiting for you", incoming)}
      {section("Sent by you", outgoing)}
      {section("Earlier", history)}

      <AcceptDialog
        eventId={eventId}
        request={accepting}
        tz={tz}
        onClose={() => setAccepting(null)}
        onDone={() => {
          setAccepting(null);
          onChanged();
        }}
      />
    </div>
  );
}

export default RequestsTab;
