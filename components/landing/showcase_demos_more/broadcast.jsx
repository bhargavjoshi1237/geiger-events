"use client";

import { useState } from "react";
import { Captions, CirclePlay, Download, Play } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  CARD,
  META,
  PANEL,
  TITLE,
  useVisibleInterval,
} from "@/components/landing/showcase_demos";
import { Chip } from "./shared";

/* ------------------------------------------------------------------ *
 * Broadcast & On-demand — "Hybrid without a second vendor"
 * ------------------------------------------------------------------ */

const CHAT_LINES = [
  { who: "Lena", text: "Captions on, thanks crew" },
  { who: "Jonas", text: "Slide 14 is from the talk this morning?" },
  { who: "Sofia", text: "Livestream is crisp in the sponsor room too" },
];

// Livestream rooms — a live room with presence, chat, and caption control.
export function LivestreamDemo() {
  const [viewers, setViewers] = useState(1214);
  const [captions, setCaptions] = useState(true);
  const ref = useVisibleInterval(() => setViewers((value) => value + 1), 2500);

  return (
    <div className={PANEL} ref={ref}>
      <div className="mb-2 flex shrink-0 items-center justify-between">
        <span className={TITLE}>Livestream · Main stage</span>
        <Chip tone="live">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          {viewers.toLocaleString("en-US")} watching
        </Chip>
      </div>

      <div className="relative h-[104px] shrink-0 overflow-hidden rounded-lg border border-white/[0.07] bg-gradient-to-br from-indigo-500/15 via-[#1c1c1c] to-[#141414]">
        <span className="absolute left-2.5 top-2 flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
          Live now
        </span>
        <div className="absolute inset-x-3 bottom-2.5 flex h-6 items-end gap-[3px]">
          {[6, 12, 18, 26, 20, 32, 24, 14, 30, 18, 26, 12].map((height, index) => (
            <span
              key={index}
              className="w-[3px] rounded-[2px] bg-white/25"
              style={{ height: `${height}px` }}
            />
          ))}
        </div>
      </div>

      {captions && (
        <div className="mt-1.5 shrink-0 rounded-md border border-white/[0.07] bg-[#212121] px-2.5 py-1.5 text-[11px] italic text-white/70">
          “…and that is exactly how a two-day event stays hybrid without a second vendor.”
        </div>
      )}

      <div className="mt-1.5 min-h-0 flex-1 space-y-1">
        {CHAT_LINES.map((line) => (
          <div key={`${line.who}-${line.text}`} className="flex items-baseline gap-1.5 text-[10px]">
            <span className="shrink-0 font-medium text-white/60">{line.who}</span>
            <span className="min-w-0 truncate text-white/40">{line.text}</span>
          </div>
        ))}
      </div>

      <div className="mt-2 flex shrink-0 items-center justify-between border-t border-white/5 pt-2">
        <div className="flex items-center gap-1.5 text-[10px] text-white/40">
          <Captions className="h-3 w-3" />
          <button
            type="button"
            onClick={() => setCaptions((value) => !value)}
            className={cn(
              "rounded px-1.5 py-0.5 transition-colors",
              captions ? "bg-white/10 text-white" : "hover:bg-white/5",
            )}
          >
            Captions {captions ? "on" : "off"}
          </button>
        </div>
        <span className="text-[10px] text-white/30">English · auto</span>
      </div>
    </div>
  );
}

const REPLAYS = [
  { id: "r1", title: "Opening keynote", who: "Ada Chen", dur: "48 min", views: "1,204" },
  { id: "r2", title: "Scaling live ops", who: "Marco Silva", dur: "36 min", views: "892" },
  { id: "r3", title: "Sponsor showcase", who: "12 exhibitors", dur: "22 min", views: "441" },
];

// On-demand library — every session stays available after the room empties.
export function OnDemandDemo() {
  const [playing, setPlaying] = useState(null);

  const active = REPLAYS.find((item) => item.id === playing);

  return (
    <div className={PANEL}>
      <div className="mb-2 flex shrink-0 items-baseline justify-between">
        <span className={TITLE}>On-demand library</span>
        <span className={META}>42 sessions</span>
      </div>

      <div className="min-h-0 flex-1 space-y-1.5">
        {REPLAYS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setPlaying(item.id)}
            className={cn(
              CARD,
              "flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors",
              playing === item.id && "border-indigo-400/40 bg-[#2a2a2a]",
            )}
          >
            <span className="grid h-7 w-10 shrink-0 place-items-center rounded-md bg-gradient-to-br from-indigo-500/25 to-[#232323] text-white/70">
              <Play className="h-3 w-3" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-medium text-white">
                {item.title}
              </span>
              <span className="block truncate text-[10px] text-white/40">
                {item.who} · {item.dur} · {item.views} views
              </span>
            </span>
            {playing === item.id && (
              <CirclePlay className="h-3.5 w-3.5 shrink-0 text-indigo-300" />
            )}
          </button>
        ))}
      </div>

      {active ? (
        <div className="mt-2 shrink-0">
          <div className="flex items-center justify-between text-[10px] text-white/40">
            <span className="truncate">Now playing · {active.title}</span>
            <span className="shrink-0 tabular-nums">12:34 / 48:00</span>
          </div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-[26%] rounded-full bg-indigo-400/70" />
          </div>
        </div>
      ) : (
        <div className="mt-2 flex shrink-0 items-center justify-between rounded-lg border border-dashed border-white/10 px-2.5 py-1.5 text-[10px] text-white/35">
          <span>Replay is gated until the livestream ends</span>
          <span className="text-white/50">Browse all 42</span>
        </div>
      )}
    </div>
  );
}

const TRANSCRIPT = [
  { time: "00:12", who: "Ada Chen", text: "So the door isn't the whole event — it's where the content starts." },
  { time: "00:24", who: "Ada Chen", text: "We measured engagement against the agenda, and the afterparty won." },
  { time: "00:41", who: "Marco Silva", text: "And that changed how we schedule the second day entirely." },
  { time: "00:58", who: "Ada Chen", text: "Thank you — let's take questions from the room." },
];

// Captions & transcription — the talk becomes searchable the moment it's spoken.
export function CaptionsDemo() {
  const [captions, setCaptions] = useState(true);
  const [active, setActive] = useState(1);

  return (
    <div className={PANEL}>
      <div className="mb-2 flex shrink-0 items-center justify-between">
        <span className={TITLE}>Captions & transcription</span>
        <button
          type="button"
          onClick={() => setCaptions((value) => !value)}
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] transition-colors",
            captions
              ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
              : "border-white/10 text-white/40",
          )}
        >
          <Captions className="h-3 w-3" />
          {captions ? "On" : "Off"}
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-1 overflow-hidden">
        {TRANSCRIPT.map((line, index) => (
          <button
            key={line.time}
            type="button"
            onClick={() => setActive(index)}
            className={cn(
              "w-full rounded-md px-2.5 py-1.5 text-left transition-colors",
              active === index ? "bg-white/[0.07]" : "hover:bg-white/[0.03]",
            )}
          >
            <span className="flex items-center gap-2 text-[10px]">
              <span className="shrink-0 tabular-nums text-white/30">{line.time}</span>
              <span className="shrink-0 font-medium text-white/55">{line.who}</span>
            </span>
            <span className="mt-0.5 block text-[11px] leading-snug text-white/80">
              {line.text}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-2 flex shrink-0 items-center justify-between border-t border-white/5 pt-2 text-[10px] text-white/35">
        <span>98.7% accuracy · English</span>
        <span className="flex items-center gap-1 font-medium text-white/60">
          <Download className="h-3 w-3" />
          Export .vtt
        </span>
      </div>
    </div>
  );
}
