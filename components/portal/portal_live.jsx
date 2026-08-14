"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BadgeCheck, Radio, Timer, Users, VideoOff, Megaphone } from "lucide-react";

import { EmptyState, ScreenHeader } from "@/components/internal/shared/screen_kit";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { cn } from "@geiger/ui";
import { toEmbed } from "@/lib/video-embed";
import { breakoutTimer, formatCountdown } from "@/lib/live/timer";
import { usePresenceHeartbeat } from "@/lib/hooks/use-presence-heartbeat";
import { portalFetch } from "@/lib/portal/portal_fetch";

// The member's Live tab — the rooms their entitlements unlock, and the room view
// itself. Opening a room starts a presence heartbeat: one write every 30s that
// every organiser-side metric rolls up from. The heartbeat fails open, so a
// metric problem can never interrupt playback.

const ROUND_POLL_MS = 5000;

const STATE_STYLES = {
  Live: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
  "Opening soon": "border-amber-500/20 bg-amber-500/10 text-amber-400",
  Scheduled: "border-border bg-surface-card text-text-secondary",
  Manual: "border-border bg-surface-card text-text-secondary",
};

// Seconds until start as "in 2h 15m" / "in 4m".
function untilLabel(seconds) {
  if (!seconds || seconds <= 0) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h ? `in ${h}h ${m}m` : `in ${Math.max(1, m)}m`;
}

function StatePill({ state }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium",
        STATE_STYLES[state] || STATE_STYLES.Scheduled,
      )}
    >
      {state === "Live" ? (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
      ) : null}
      {state}
    </span>
  );
}

function Player({ url }) {
  const embed = toEmbed(url);
  if (embed.type === "none") {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle text-text-secondary">
        <VideoOff className="h-8 w-8" />
        <p className="text-sm">The organiser hasn&apos;t added a stream yet.</p>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-black">
      {embed.type === "iframe" ? (
        <iframe
          src={embed.src}
          title="Live room"
          className="aspect-video w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <video src={embed.src} controls className="aspect-video w-full bg-black" />
      )}
    </div>
  );
}

function RoomCard({ room, onOpen }) {
  const meta = [room.eventName, untilLabel(room.secondsUntilStart)].filter(Boolean).join(" · ");
  return (
    <button
      type="button"
      onClick={() => onOpen(room)}
      disabled={!room.openNow}
      className={cn(
        "flex w-full flex-col gap-2 rounded-xl border border-border bg-surface-card p-4 text-left transition-colors",
        room.openNow
          ? "hover:border-border-strong hover:bg-surface-hover"
          : "cursor-not-allowed opacity-70",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-semibold text-foreground">{room.name}</p>
        <StatePill state={room.state} />
      </div>
      {meta ? <p className="truncate text-xs text-text-secondary">{meta}</p> : null}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5 text-[11px] text-text-tertiary">
        {room.planName ? (
          <span className="inline-flex items-center gap-1">
            <BadgeCheck className="h-3 w-3" /> {room.planName}
          </span>
        ) : null}
        {room.liveNow ? (
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3" /> {room.liveNow} watching
          </span>
        ) : null}
        {!room.openNow ? <span>Opens closer to the start time</span> : null}
      </div>
    </button>
  );
}

// The shared round clock and broadcasts live on the breakout's parent session,
// so every room in a round shows the same countdown and the same messages.
function RoundRail({ parentSessionId }) {
  const [parent, setParent] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!parentSessionId) return undefined;
    let alive = true;
    const pull = () => {
      portalFetch(`/api/portal/live/round?sessionId=${parentSessionId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => alive && d && setParent(d.session || null))
        .catch(() => {});
    };
    const poll = setInterval(pull, ROUND_POLL_MS);
    const tick = setInterval(() => alive && setNow(Date.now()), 1000);
    pull();
    return () => {
      alive = false;
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [parentSessionId]);

  const timer = useMemo(() => breakoutTimer(parent, now), [parent, now]);
  const broadcasts = Array.isArray(parent?.config?.broadcasts)
    ? [...parent.config.broadcasts].reverse()
    : [];

  if (!parentSessionId) return null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-surface-card p-4">
        <div className="flex items-center gap-2 text-xs text-text-tertiary">
          <Timer className="h-3.5 w-3.5" /> Round clock
        </div>
        <p
          className={cn(
            "mt-1 font-mono text-3xl font-semibold tabular-nums",
            timer.running ? "text-emerald-400" : "text-text-tertiary",
          )}
        >
          {formatCountdown(timer.secondsRemaining)}
        </p>
      </div>

      {broadcasts.length ? (
        <div className="rounded-xl border border-border bg-surface-card p-4">
          <div className="flex items-center gap-2 text-xs text-text-tertiary">
            <Megaphone className="h-3.5 w-3.5" /> From the host
          </div>
          <ul className="mt-2 space-y-2">
            {broadcasts.slice(0, 8).map((b) => (
              <li key={b.id} className="text-sm leading-relaxed text-foreground">
                {b.body}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function RoomView({ room, onBack }) {
  usePresenceHeartbeat(room?.id);
  const isBreakout = room.kind === "breakout";

  return (
    <MainScreenWrapper>
      <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Live
          </button>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              {room.name}
            </h1>
            <StatePill state={room.state} />
          </div>
          {room.eventName ? (
            <p className="mt-1 text-sm text-text-secondary">{room.eventName}</p>
          ) : null}
        </div>
      </div>

      <div
        className={cn(
          "grid gap-6",
          isBreakout ? "lg:grid-cols-[1fr_300px]" : "grid-cols-1",
        )}
      >
        <div className="min-w-0 space-y-4">
          <Player url={room.watchUrl || room.joinUrl} />
          {room.description ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {room.description}
            </p>
          ) : null}
        </div>
        {isBreakout ? <RoundRail parentSessionId={room.parentSessionId} /> : null}
      </div>
    </MainScreenWrapper>
  );
}

export function PortalLive() {
  const [rooms, setRooms] = useState(null);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    let alive = true;
    portalFetch("/api/portal/live")
      .then((r) => (r.ok ? r.json() : { rooms: [] }))
      .then((d) => alive && setRooms(d.rooms ?? []))
      .catch(() => alive && setRooms([]));
    return () => {
      alive = false;
    };
  }, []);

  const openRoom = useMemo(
    () => (openId ? (rooms || []).find((r) => r.id === openId) || null : null),
    [openId, rooms],
  );

  if (openRoom) {
    return <RoomView room={openRoom} onBack={() => setOpenId(null)} />;
  }

  const loading = rooms === null;

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Live"
        description="Rooms, webinars and breakouts happening now or coming up — open one when it goes live."
      />

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Radio className="h-4 w-4 animate-pulse" /> Looking for live rooms…
        </div>
      ) : rooms.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <RoomCard key={room.id} room={room} onOpen={(r) => setOpenId(r.id)} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Radio}
          title="No live rooms right now"
          description="When a room you have access to is scheduled or goes live, it'll show up here."
        />
      )}
    </MainScreenWrapper>
  );
}

export default PortalLive;
