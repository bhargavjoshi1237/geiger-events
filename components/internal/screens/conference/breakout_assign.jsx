"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Send, Shuffle, Square, Timer, Users } from "lucide-react";

import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui";
import { SectionCard } from "@/components/internal/shared/screen_kit";
import { useProject } from "@/context/project-context";
import { conferenceApi } from "@/lib/supabase/conference";
import { assignAttendees } from "@/lib/live/assign";
import { breakoutTimer, formatCountdown } from "@/lib/live/timer";

// Breakout orchestration for one round: place entitled attendees across the
// rooms that share a parent session, run one clock everybody agrees on, and
// broadcast a message to every room at once. The roster comes from entitlements
// (/api/live/roster), never from who happens to be watching.

const MODES = [
  { value: "balanced", label: "Balanced — spread evenly" },
  { value: "sequential", label: "Sequential — fill each room in turn" },
];
const DURATIONS = [5, 10, 15, 25];

export function BreakoutAssign({ record }) {
  const { projectId } = useProject();
  const parentId = record?.config?.parentSessionId || "";

  const [siblings, setSiblings] = useState([]);
  const [parent, setParent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState("balanced");
  const [minutes, setMinutes] = useState("10");
  const [broadcast, setBroadcast] = useState("");
  const [busy, setBusy] = useState("");
  const [unassigned, setUnassigned] = useState([]);
  const [now, setNow] = useState(() => Date.now());

  // Every breakout room hanging off the same parent session, this one included.
  useEffect(() => {
    if (!parentId) return undefined;
    let alive = true;
    Promise.all([
      conferenceApi.list(projectId, "breakout"),
      conferenceApi.get(parentId),
    ]).then(([rows, parentRow]) => {
      if (!alive) return;
      setSiblings((rows ?? []).filter((r) => r.config?.parentSessionId === parentId));
      setParent(parentRow ?? null);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId, parentId]);

  // One second tick so the countdown moves without re-fetching the parent.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const timer = useMemo(() => breakoutTimer(parent, now), [parent, now]);
  const seats = useMemo(
    () => siblings.reduce((s, r) => s + (Number(r.config?.capacity) || 0), 0),
    [siblings],
  );
  const placed = useMemo(
    () => siblings.reduce((s, r) => s + (r.config?.assigned?.length || 0), 0),
    [siblings],
  );

  // Persist a config patch on one record, keeping local state in step.
  const patchRecord = async (row, config) => {
    const saved = await conferenceApi.update(row.id, { config });
    return Boolean(saved);
  };

  const runAssign = async () => {
    setBusy("assign");
    try {
      const res = await fetch(`/api/live/roster?sessionId=${parentId}`);
      const data = res.ok ? await res.json() : { members: [] };
      const members = data.members ?? [];
      if (!members.length) {
        toast.error("No entitled attendees to place — check the session's access rules.");
        return;
      }
      const byId = Object.fromEntries(members.map((m) => [m.id, m]));
      const result = assignAttendees(
        members.map((m) => m.id),
        siblings.map((r) => ({ id: r.id, capacity: r.config?.capacity })),
        { mode },
      );

      const writes = await Promise.all(
        siblings.map((r) =>
          patchRecord(r, { ...(r.config || {}), assigned: result[r.id] || [] }),
        ),
      );
      if (writes.some((ok) => !ok)) {
        toast.error("Some rooms couldn't be saved — reload and try again.");
        return;
      }
      setSiblings((prev) =>
        prev.map((r) => ({
          ...r,
          config: { ...(r.config || {}), assigned: result[r.id] || [] },
        })),
      );
      setUnassigned((result.__unassigned || []).map((id) => byId[id]).filter(Boolean));
      const total = members.length - (result.__unassigned?.length || 0);
      toast.success(`Placed ${total} of ${members.length} attendees.`);
    } finally {
      setBusy("");
    }
  };

  // The clock lives on the parent session so every child room reads one value.
  const setTimer = async (endsAt) => {
    if (!parent) return;
    setBusy("timer");
    const config = { ...(parent.config || {}) };
    if (endsAt) config.timerEndsAt = endsAt;
    else delete config.timerEndsAt;
    const ok = await patchRecord(parent, config);
    setBusy("");
    if (!ok) {
      toast.error("Couldn't update the round clock.");
      return;
    }
    setParent((p) => ({ ...p, config }));
    toast.success(endsAt ? `Round started — ${minutes} minutes.` : "Round stopped.");
  };

  // Broadcasts are appended to the parent session so every room shows the same
  // feed; the portal reads them alongside the countdown.
  const sendBroadcast = async () => {
    const body = broadcast.trim();
    if (!body || !parent) return;
    setBusy("broadcast");
    const list = Array.isArray(parent.config?.broadcasts) ? parent.config.broadcasts : [];
    const config = {
      ...(parent.config || {}),
      broadcasts: [...list, { id: crypto.randomUUID(), body, at: new Date().toISOString() }].slice(-50),
    };
    const ok = await patchRecord(parent, config);
    setBusy("");
    if (!ok) {
      toast.error("Couldn't send the broadcast.");
      return;
    }
    setParent((p) => ({ ...p, config }));
    setBroadcast("");
    toast.success(`Broadcast sent to ${siblings.length} room${siblings.length === 1 ? "" : "s"}.`);
  };

  if (!parentId) {
    return (
      <SectionCard title="Rounds & roster" description="Link a parent session first.">
        <p className="text-sm text-text-secondary">
          Pick a parent session under <span className="text-foreground">Facilitator &amp; session</span>.
          Rooms sharing that session are assigned, timed and broadcast to together.
        </p>
      </SectionCard>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading rooms…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="Assignment"
        description={`${siblings.length} room${siblings.length === 1 ? "" : "s"} in this round · ${placed} of ${seats} seats filled.`}
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger className="w-full sm:w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODES.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={runAssign}
              disabled={busy === "assign" || !siblings.length}
            >
              {busy === "assign" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Shuffle className="h-4 w-4" />
              )}
              Assign attendees
            </Button>
          </div>

          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {siblings.map((r) => {
              const count = r.config?.assigned?.length || 0;
              const cap = Number(r.config?.capacity) || 0;
              return (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-3 bg-surface-card px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {r.name || "Untitled room"}
                      {r.id === record.id ? (
                        <span className="ml-2 text-xs text-text-tertiary">this room</span>
                      ) : null}
                    </p>
                    <p className="truncate text-xs text-text-secondary">
                      {r.config?.topic || r.config?.kind || "Breakout"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 text-sm text-text-secondary">
                    <Users className="h-3.5 w-3.5" />
                    {count} / {cap}
                  </div>
                </div>
              );
            })}
          </div>

          {unassigned.length ? (
            <p className="text-xs text-amber-400">
              {unassigned.length} attendee{unassigned.length === 1 ? "" : "s"} didn&apos;t fit:{" "}
              {unassigned.slice(0, 6).map((m) => m.name).join(", ")}
              {unassigned.length > 6 ? ` and ${unassigned.length - 6} more` : ""}. Add capacity or
              another room.
            </p>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard
        title="Round clock"
        description="One countdown shared by every room in this round."
        action={
          timer.running ? (
            <span className="font-mono text-lg font-semibold tabular-nums text-emerald-400">
              {formatCountdown(timer.secondsRemaining)}
            </span>
          ) : (
            <span className="text-sm text-text-tertiary">Not running</span>
          )
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Select value={minutes} onValueChange={setMinutes}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DURATIONS.map((d) => (
                <SelectItem key={d} value={String(d)}>
                  {d} minutes
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() =>
              setTimer(new Date(Date.now() + Number(minutes) * 60000).toISOString())
            }
            disabled={busy === "timer"}
          >
            <Timer className="h-4 w-4" /> Start round
          </Button>
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => setTimer("")}
            disabled={busy === "timer" || !timer.running}
          >
            <Square className="h-4 w-4" /> Stop
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        title="Broadcast"
        description="One message every room in this round sees straight away."
      >
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={broadcast}
            onChange={(e) => setBroadcast(e.target.value)}
            placeholder="e.g. Five minutes left — start wrapping up."
            className="flex-1 sm:min-w-64"
            onKeyDown={(e) => {
              if (e.key === "Enter") sendBroadcast();
            }}
          />
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={sendBroadcast}
            disabled={busy === "broadcast" || !broadcast.trim()}
          >
            {busy === "broadcast" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}

export default BreakoutAssign;
