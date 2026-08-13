"use client";

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Radio, Square, RotateCcw, Users, Eye, Clock } from "lucide-react";

import { Button } from "@geiger/ui";
import { SectionCard, StatusPill } from "@/components/internal/shared/screen_kit";
import { resolveRoomState, OPENING_SOON_MS } from "@/lib/live/state";
import { LIVE_STATE_MAP } from "./constants";

// Organiser control for a live room: the state the schedule resolves to, the
// override buttons that beat it, and a measured presence readout. The override
// is a config key so it travels with the record; the readout polls the same
// rollup the portal writes into, so no number here is typed by hand.

const POLL_MS = 15000;
const EMPTY = { liveNow: 0, uniqueViewers: 0, secondsWatched: 0 };

// Seconds -> "2h 15m" / "15m" / "40s".
function duration(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

// The schedule in plain words, so the organiser sees what drives the state.
function scheduleWords(startsAt, endsAt) {
  if (!startsAt) return "No schedule set — this room only opens when you do.";
  const fmt = (ms) =>
    new Date(ms).toLocaleString("en-US", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  const opens = fmt(startsAt - OPENING_SOON_MS);
  return endsAt
    ? `Opens ${opens}, live ${fmt(startsAt)} until ${fmt(endsAt)}.`
    : `Opens ${opens}, live from ${fmt(startsAt)} until you end it.`;
}

export function LiveControl({ record, commit }) {
  const [stats, setStats] = useState(EMPTY);
  // A ticking clock rather than Date.now() in render, so the resolved state
  // (and the "Opening soon" flip) stays live without an impure read.
  const [now, setNow] = useState(() => Date.now());
  const roomId = record?.id;
  const forced = record?.config?.manualState || "";
  const resolved = resolveRoomState(record, now);

  const load = useCallback(() => {
    if (!roomId) return;
    // Fail open on metrics: a failed read leaves the last numbers in place.
    fetch(`/api/live/stats?roomId=${roomId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setStats({ ...EMPTY, ...d }))
      .catch(() => {});
  }, [roomId]);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(load, POLL_MS);
    load();
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [load]);

  const setOverride = (manualState) => {
    const config = { ...(record.config || {}) };
    if (manualState) config.manualState = manualState;
    else delete config.manualState;
    // commit patches and persists; the records screen toasts if the write fails.
    commit({ config });
    toast.success(
      manualState ? `Room forced to ${manualState}.` : "Override cleared — back on schedule.",
    );
  };

  const readout = [
    { icon: Users, label: "Watching now", value: String(stats.liveNow) },
    { icon: Eye, label: "Unique viewers", value: String(stats.uniqueViewers) },
    { icon: Clock, label: "Watch time", value: duration(stats.secondsWatched) },
  ];

  return (
    <div className="space-y-6">
      <SectionCard
        bare
        title="Room state"
        description="Attendees see this state in their Live tab."
        action={<StatusPill status={resolved.state} map={LIVE_STATE_MAP} />}
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            {scheduleWords(resolved.startsAt, resolved.endsAt)}
          </p>
          {forced ? (
            <p className="text-sm text-amber-400">
              Overridden to <span className="font-medium">{forced}</span> — the schedule is ignored
              until you clear it.
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => setOverride("Live")}
              disabled={forced === "Live"}
            >
              <Radio className="h-4 w-4" /> Go live
            </Button>
            <Button
              variant="outline"
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={() => setOverride("Ended")}
              disabled={forced === "Ended"}
            >
              <Square className="h-4 w-4" /> End room
            </Button>
            <Button
              variant="ghost"
              className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={() => setOverride("")}
              disabled={!forced}
            >
              <RotateCcw className="h-4 w-4" /> Clear override
            </Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        bare
        title="Who's in the room"
        description="Measured from attendee heartbeats — refreshes every 15 seconds."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {readout.map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="rounded-xl border border-border bg-surface-card px-4 py-3"
            >
              <div className="flex items-center gap-2 text-xs text-text-tertiary">
                <Icon className="h-3.5 w-3.5" />
                {label}
              </div>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                {value}
              </p>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

export default LiveControl;
