"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarCheck, Handshake, Inbox, Loader2, Send, Users } from "lucide-react";

import { EmptyState, SearchInput } from "@/components/internal/shared/screen_kit";
import { Badge } from "@geiger/ui/badge";
import { Button } from "@geiger/ui/button";
import { Textarea } from "@geiger/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@geiger/ui/dialog";
import { LogoLoading } from "@geiger/ui";
import { cn } from "@/lib/utils";
import { MAX_PROPOSED_SLOTS } from "@/lib/meetings/settings";
import { tzAbbrev } from "@/lib/meetings/time";
import { Card } from "../portal_kit";
import { PersonAvatar, SlotChips, TagList, getJson, postJson, roleLine } from "./meetings_kit";

const RELATION = {
  meeting: { label: "Meeting booked", variant: "success" },
  requested: { label: "Request sent", variant: "info" },
  incoming: { label: "Wants to meet you", variant: "warning" },
};

function PersonCard({ person, onOpen }) {
  const rel = RELATION[person.relation];
  return (
    <Card onClick={() => onOpen(person)} className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <PersonAvatar person={person} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{person.name}</p>
          <p className="truncate text-xs text-text-secondary">{roleLine(person) || "Attendee"}</p>
        </div>
        {person.role === "exhibitor" ? <Badge variant="purple">Exhibitor</Badge> : null}
      </div>
      <TagList tags={person.interests} max={3} />
      {rel ? (
        <Badge variant={rel.variant} className="self-start">
          {rel.label}
        </Badge>
      ) : null}
    </Card>
  );
}

// Pick up to three mutually free times and send a request (or book instantly when acceptance is off).
function RequestDialog({ eventId, person, settings, tz, windowOpen, onClose, onSent }) {
  const [slots, setSlots] = useState(null);
  const [picked, setPicked] = useState([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [prevId, setPrevId] = useState(null);
  if ((person?.memberId || null) !== prevId) {
    setPrevId(person?.memberId || null);
    setSlots(null);
    setPicked([]);
    setMessage("");
  }

  useEffect(() => {
    if (!person) return undefined;
    let alive = true;
    getJson(`/api/portal/meetings/${eventId}/slots?with=${person.memberId}`).then(({ ok, data }) => {
      if (!alive) return;
      if (!ok) toast.error(data.error || "Couldn't load free times.");
      setSlots(ok ? data.slots || [] : []);
    });
    return () => {
      alive = false;
    };
  }, [eventId, person]);

  const selected = useMemo(() => new Set(picked.map((s) => s.start)), [picked]);
  const instant = !settings.requireAcceptance;
  const max = instant ? 1 : MAX_PROPOSED_SLOTS;

  const toggle = (slot) =>
    setPicked((cur) => {
      if (cur.some((s) => s.start === slot.start)) return cur.filter((s) => s.start !== slot.start);
      if (max === 1) return [slot];
      return cur.length >= max ? cur : [...cur, slot];
    });

  const send = async () => {
    setBusy(true);
    const { ok, data } = await postJson(`/api/portal/meetings/${eventId}/requests`, {
      toMemberId: person.memberId,
      slots: picked.map((s) => ({ start: s.start, end: s.end })),
      message: message.trim(),
    });
    setBusy(false);
    if (!ok) {
      toast.error(data.error || "Couldn't send your request.");
      return;
    }
    toast.success(data.booked ? `Meeting booked with ${person.name}.` : `Request sent to ${person.name}.`);
    onSent();
  };

  return (
    <Dialog open={Boolean(person)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        {person ? (
          <>
            <DialogHeader>
              <DialogTitle>Meet {person.name}</DialogTitle>
              <DialogDescription>
                {instant
                  ? "Pick a time — it's booked straight away."
                  : `Suggest up to ${MAX_PROPOSED_SLOTS} times. ${person.name.split(" ")[0]} picks one to confirm.`}{" "}
                Times in {tzAbbrev(tz)}.
              </DialogDescription>
            </DialogHeader>

            {slots === null ? (
              <div className="flex justify-center py-8">
                <LogoLoading size={36} />
              </div>
            ) : (
              <div className="max-h-[40vh] overflow-y-auto pr-1">
                <SlotChips
                  slots={slots}
                  tz={tz}
                  selected={selected}
                  onToggle={toggle}
                  emptyText="No time is free for both of you right now."
                />
              </div>
            )}

            {settings.messageMaxLength > 0 ? (
              <div className="space-y-1">
                <Textarea
                  rows={3}
                  value={message}
                  maxLength={settings.messageMaxLength}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Say why you'd like to meet (optional)…"
                />
                <p className="text-right text-[11px] text-text-tertiary">
                  {message.length}/{settings.messageMaxLength}
                </p>
              </div>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button
                disabled={!picked.length || busy || !windowOpen}
                onClick={send}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : instant ? (
                  <CalendarCheck className="h-4 w-4" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {instant ? "Book meeting" : "Send request"}
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function PersonDialog({ person, windowOpen, onClose, onRequest, onGoRequests }) {
  if (!person) return null;
  const rel = person.relation;
  return (
    <Dialog open={Boolean(person)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader className="items-center text-center">
          <PersonAvatar person={person} className="h-16 w-16 text-base" />
          <DialogTitle className="mt-2">{person.name}</DialogTitle>
          <DialogDescription>{roleLine(person) || "Attendee"}</DialogDescription>
          {person.role === "exhibitor" ? <Badge variant="purple">Exhibitor</Badge> : null}
        </DialogHeader>
        {person.bio ? <p className="whitespace-pre-wrap text-sm text-muted-foreground">{person.bio}</p> : null}
        {person.interests?.length ? (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-text-secondary">Interests</p>
            <TagList tags={person.interests} />
          </div>
        ) : null}
        {person.lookingFor?.length ? (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-text-secondary">Looking for</p>
            <TagList tags={person.lookingFor} />
          </div>
        ) : null}
        <div className="pt-1">
          {rel === "meeting" ? (
            <Button disabled className="w-full">
              <CalendarCheck className="h-4 w-4" /> You&apos;re already meeting
            </Button>
          ) : rel === "requested" ? (
            <Button disabled className="w-full">
              <Send className="h-4 w-4" /> Request sent
            </Button>
          ) : rel === "incoming" ? (
            <Button onClick={onGoRequests} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
              <Inbox className="h-4 w-4" /> They asked to meet you — answer
            </Button>
          ) : (
            <Button
              disabled={!windowOpen}
              onClick={() => onRequest(person)}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Handshake className="h-4 w-4" /> Request a meeting
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PeopleTab({ eventId, state, tz, onChanged, onGoProfile, onGoRequests }) {
  const [people, setPeople] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState("");
  const [interest, setInterest] = useState("");
  const [openId, setOpenId] = useState(null);
  const [requesting, setRequesting] = useState(null);
  const windowOpen = state.window === "open";

  useEffect(() => {
    if (!state.canNetwork) return undefined;
    let alive = true;
    getJson(`/api/portal/meetings/${eventId}/people`).then(({ ok, data }) => {
      if (!alive) return;
      if (!ok) toast.error(data.error || "Couldn't load the directory.");
      setPeople(ok ? data.people || [] : []);
    });
    return () => {
      alive = false;
    };
  }, [eventId, state.canNetwork, reloadKey]);

  const topInterests = useMemo(() => {
    const counts = new Map();
    for (const p of people || []) for (const t of p.interests || []) counts.set(t, (counts.get(t) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([t]) => t);
  }, [people]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (people || []).filter((p) => {
      if (interest && !(p.interests || []).includes(interest)) return false;
      if (!q) return true;
      return `${p.name} ${p.title} ${p.company} ${(p.interests || []).join(" ")} ${(p.lookingFor || []).join(" ")}`
        .toLowerCase()
        .includes(q);
    });
  }, [people, search, interest]);

  if (!state.canNetwork) {
    return (
      <div className="rounded-xl border border-border bg-surface-subtle">
        <EmptyState
          icon={Users}
          title={state.profile.hidden ? "Your networking profile is paused" : "Join networking to see who's here"}
          description={
            state.profile.hidden
              ? "The organiser has paused your profile. Contact them if you think this is a mistake."
              : "Create your profile so other attendees can find you — then browse everyone who's open to meeting."
          }
          action={
            state.profile.hidden ? null : (
              <Button onClick={onGoProfile} className="bg-primary text-primary-foreground hover:bg-primary/90">
                Set up my profile
              </Button>
            )
          }
        />
      </div>
    );
  }

  const openPerson = (people || []).find((p) => p.memberId === openId) || null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-text-secondary">
          {people === null ? "Loading people…" : `${people.length} ${people.length === 1 ? "person" : "people"} open to meeting`}
        </p>
        <SearchInput value={search} onChange={setSearch} placeholder="Search names, companies, interests…" />
      </div>

      {topInterests.length ? (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {topInterests.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setInterest((cur) => (cur === t ? "" : t))}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-xs transition-colors",
                interest === t
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-border bg-surface-card text-text-secondary hover:text-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      ) : null}

      {people === null ? (
        <div className="flex justify-center py-16">
          <LogoLoading size={44} />
        </div>
      ) : filtered.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <PersonCard key={p.memberId} person={p} onOpen={(x) => setOpenId(x.memberId)} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={Users}
            title={people.length ? "Nobody matches" : "No one else has joined yet"}
            description={
              people.length
                ? "Try a different search or interest."
                : "As other attendees opt in to networking, they'll show up here."
            }
          />
        </div>
      )}

      <PersonDialog
        person={openPerson}
        windowOpen={windowOpen}
        onClose={() => setOpenId(null)}
        onGoRequests={() => {
          setOpenId(null);
          onGoRequests();
        }}
        onRequest={(p) => {
          setOpenId(null);
          setRequesting(p);
        }}
      />

      <RequestDialog
        eventId={eventId}
        person={requesting}
        settings={state.settings}
        tz={tz}
        windowOpen={windowOpen}
        onClose={() => setRequesting(null)}
        onSent={() => {
          setRequesting(null);
          setReloadKey((k) => k + 1);
          onChanged();
        }}
      />
    </div>
  );
}

export default PeopleTab;
