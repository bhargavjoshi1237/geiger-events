"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, CircleSlash, Cpu, UserRound, X } from "lucide-react";

import { SectionCard } from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { Switch } from "@geiger/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import { bindBadge } from "@/lib/supabase/smart_badges";
import { holderPayload } from "@/lib/smart_badges/roster";
import { AttendeePicker } from "./attendee_picker";
import { UidCapture } from "./uid_capture";
import { BIND_ERRORS, badgeTitle, formatDateTime } from "./constants";

function ToggleRow({ title, description, checked, onCheckedChange }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface-card px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm text-foreground">{title}</p>
        {description ? <p className="mt-0.5 text-xs text-text-secondary">{description}</p> : null}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

// Desk flow: pick the person, then tap their badge on a USB reader or an Android phone. Unknown chips become new
// badges; spare chips are bound; anything already in use is refused with the reason.
export function BindingDesk({ eventId, roster, batches, liveByHolder, onChanged }) {
  const [person, setPerson] = useState(null);
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [autoNext, setAutoNext] = useState(false);
  const [deskBatch, setDeskBatch] = useState("none");
  const [busy, setBusy] = useState(false);
  const [focusKey, setFocusKey] = useState(0);
  const [log, setLog] = useState([]);
  const [boundHere, setBoundHere] = useState(() => new Set());

  const ordered = useMemo(() => [...(roster || [])].sort((a, b) => a.name.localeCompare(b.name)), [roster]);
  const live = person ? liveByHolder.get(person.key) || [] : [];

  const pick = (p) => {
    setPerson(p);
    setFocusKey((k) => k + 1);
  };

  const nextAfter = (current, skip) => {
    const start = ordered.findIndex((p) => p.key === current.key);
    for (let i = start + 1; i < ordered.length; i += 1) {
      const p = ordered[i];
      if (!skip.has(p.key) && !liveByHolder.has(p.key)) return p;
    }
    return null;
  };

  const capture = async (uid) => {
    if (!person) {
      toast.error("Pick who this badge is for first.");
      return;
    }
    setBusy(true);
    const res = await bindBadge({
      eventId,
      uid,
      attendee: holderPayload(person),
      replace: live.length ? replaceExisting : false,
      batchId: deskBatch === "none" ? null : deskBatch,
    });
    setBusy(false);
    const at = new Date().toISOString();
    if (!res?.ok) {
      const message =
        res?.reason === "UID_TAKEN" && res.holder
          ? `Already bound to ${res.holder}.`
          : BIND_ERRORS[res?.reason] || "Couldn't bind that badge.";
      toast.error(message);
      setLog((prev) => [{ id: `${at}-${uid}`, at, uid, name: person.name, ok: false, message }, ...prev].slice(0, 30));
      setFocusKey((k) => k + 1);
      return;
    }
    if (res.already) {
      toast.success(`${uid} is already ${person.name}'s badge.`);
      setFocusKey((k) => k + 1);
      return;
    }
    const replaced = Array.isArray(res.replaced) ? res.replaced.length : 0;
    const message = `${res.created ? "New badge" : "Spare badge"} bound${replaced ? ` · ${replaced} old badge replaced` : ""}`;
    toast.success(`${uid} bound to ${person.name}.`);
    setLog((prev) => [{ id: `${at}-${uid}`, at, uid, name: person.name, ok: true, message }, ...prev].slice(0, 30));
    const skip = new Set(boundHere).add(person.key);
    setBoundHere(skip);
    onChanged();
    if (autoNext) {
      const next = nextAfter(person, skip);
      setPerson(next);
      if (!next) toast.success("Everyone after this person already has a badge.");
    } else {
      setPerson(null);
    }
    setFocusKey((k) => k + 1);
  };

  return (
    <div className="min-w-0 space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Who is it for" description="Search the roster — attendees, guests, speakers, sponsors, exhibitors and team.">
          <AttendeePicker
            roster={roster}
            liveByHolder={liveByHolder}
            selectedKey={person?.key}
            onSelect={pick}
            limit={10}
          />
        </SectionCard>

        <SectionCard title="Tap the badge" description="The chip UID is read straight off the badge — no typing needed with a reader.">
          <div className="space-y-4">
            {person ? (
              <div className="flex items-start gap-3 rounded-lg border border-border bg-surface-card px-4 py-3">
                <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{person.name}</p>
                  <p className="truncate text-xs text-text-secondary">
                    {[person.role !== "Attendee" ? person.role : null, person.tier, person.email, person.code]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {live.length ? (
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                      Already holds {live.map(badgeTitle).join(", ")}.
                    </p>
                  ) : null}
                </div>
                <Button variant="ghost" size="sm" onClick={() => setPerson(null)} aria-label="Clear selection">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-surface-subtle px-4 py-5 text-sm text-text-secondary">
                <Cpu className="h-4 w-4 shrink-0 text-text-tertiary" />
                Pick someone on the left, then tap their badge.
              </div>
            )}

            <UidCapture onCapture={capture} busy={busy} disabled={!person} focusKey={focusKey} />

            {live.length ? (
              <ToggleRow
                title="Replace their current badge"
                description="The old badge is marked replaced and refused at readers."
                checked={replaceExisting}
                onCheckedChange={setReplaceExisting}
              />
            ) : null}
            <ToggleRow
              title="Move to the next person automatically"
              description="For a queue in guest-list order — skips anyone who already has a badge."
              checked={autoNext}
              onCheckedChange={setAutoNext}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-text-secondary">New chips go into</span>
              <Select value={deskBatch} onValueChange={setDeskBatch}>
                <SelectTrigger className="h-9 w-full bg-surface-card sm:w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No batch</SelectItem>
                  {batches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="This session" description="Binds made at this desk since the page opened.">
        {log.length ? (
          <div className="divide-y divide-border rounded-lg border border-border bg-surface-card">
            {log.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3 px-3 py-2.5">
                {entry.ok ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <CircleSlash className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                )}
                <span className="w-28 shrink-0 truncate font-mono text-xs text-foreground">{entry.uid}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{entry.name}</p>
                  <p className="truncate text-xs text-text-secondary">{entry.message}</p>
                </div>
                <span className="shrink-0 text-xs text-text-tertiary">{formatDateTime(entry.at)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-secondary">Nothing bound at this desk yet.</p>
        )}
      </SectionCard>
    </div>
  );
}

export default BindingDesk;
