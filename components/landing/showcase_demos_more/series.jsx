"use client";

import { useState } from "react";
import {
  Check,
  Compass,
  Heart,
  LayoutGrid,
  Layers,
  LayoutTemplate,
  Plus,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { HEADER, META, TITLE, WELL } from "@/components/landing/showcase_demos";
import { Chip } from "./shared";

/* ------------------------------------------------------------------ *
 * Run many events — templates, series, and the public wall
 * ------------------------------------------------------------------ */

const TEMPLATES = [
  { id: "conf", name: "Conference", meta: "used by 12 events", icon: LayoutTemplate },
  { id: "summit", name: "Summit", meta: "used by 7 events", icon: LayoutGrid },
  { id: "launch", name: "Product launch", meta: "used by 9 events", icon: Zap },
];

const SERIES_EVENTS = [
  { date: "Sat 14 Mar", venue: "The Foundry", status: "Selling" },
  { date: "Sun 15 Mar", venue: "The Foundry", status: "Selling" },
  { date: "Fri 20 Mar", venue: "The Mill", status: "Planned" },
  { date: "Sat 21 Mar", venue: "The Mill", status: "Planned" },
];

// Templates, series, and the event wall — the second event is the first one
// reused, not rebuilt.
export function RunManyEventsDemo() {
  const [view, setView] = useState("Series");
  const [template, setTemplate] = useState("conf");

  const active = TEMPLATES.find((item) => item.id === template);

  return (
    <div className={WELL}>
      <div className={HEADER}>
        <div className="flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-white/60" />
          <span className={TITLE}>Run Events</span>
        </div>
        <div className="flex items-center gap-1">
          {["Templates", "Series", "Wall"].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setView(item)}
              className={cn(
                "rounded px-2 py-0.5 text-[10px] transition-colors",
                view === item ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70",
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {view === "Templates" && (
        <div className="flex min-h-0 flex-1 gap-2.5 p-3">
          <div className="flex min-h-0 flex-1 flex-col gap-1.5">
            {TEMPLATES.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTemplate(item.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-md border px-2.5 py-2 text-left transition-colors",
                    template === item.id
                      ? "border-white/25 bg-[#242424]"
                      : "border-white/5 hover:border-white/15",
                  )}
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-indigo-400/30 bg-indigo-500/10 text-indigo-300">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-medium text-white">
                      {item.name}
                    </span>
                    <span className="block truncate text-[10px] text-white/40">
                      {item.meta}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex min-h-0 flex-[2] flex-col gap-2">
            <div className="flex h-9 items-center justify-center rounded-md border border-dashed border-white/10 text-[11px] text-white/35">
              New event from template
            </div>
            <div className="flex h-9 items-center justify-center rounded-md border border-white/[0.07] bg-[#212121] px-2.5 text-[11px] text-white">
              {active.name} · Sat 14 Mar
            </div>
            <div className="flex h-9 items-center justify-center rounded-md border border-white/[0.07] bg-[#212121] px-2.5 text-[11px] text-white/60">
              The Foundry · 1,800 cap
            </div>
            <button
              type="button"
              className="flex h-8 items-center justify-center gap-1.5 rounded-md bg-white text-[11px] font-medium text-zinc-950 transition-colors hover:bg-white/90"
            >
              <Plus className="h-3 w-3" />
              Create event
            </button>
          </div>
        </div>
      )}

      {view === "Series" && (
        <div className="flex min-h-0 flex-1 flex-col p-3">
          <div className="flex shrink-0 items-center justify-between">
            <div>
              <div className="text-[13px] font-medium text-white">
                Nightshift 2026 · series of 4
              </div>
              <div className={META}>Template: Conference · runs Fri → Sat</div>
            </div>
            <Chip tone="live">Live</Chip>
          </div>
          <div className="mt-3 min-h-0 flex-1 space-y-1.5">
            {SERIES_EVENTS.map((event, index) => (
              <div
                key={`${event.date}-${event.venue}`}
                className="flex shrink-0 items-center gap-2 rounded-md border border-white/[0.07] bg-[#212121] px-3 py-2"
              >
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-white/10 text-[9px] tabular-nums text-white/40">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-medium text-white">
                    {event.date}
                  </div>
                  <div className="truncate text-[10px] text-white/40">{event.venue}</div>
                </div>
                <Chip tone={event.status === "Selling" ? "live" : "muted"}>{event.status}</Chip>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === "Wall" && (
        <div className="flex min-h-0 flex-1 flex-col p-3">
          <div className="flex shrink-0 items-center justify-between">
            <div>
              <div className="text-[13px] font-medium text-white">Public event wall</div>
              <div className={META}>geiger.events/w/nightshift · 4,201 followers</div>
            </div>
            <Compass className="h-3.5 w-3.5 text-white/40" />
          </div>
          <div className="mt-3 grid min-h-0 flex-1 grid-cols-3 gap-2">
            {SERIES_EVENTS.slice(0, 3).map((event, index) => (
              <div
                key={`${event.date}-wall`}
                className="flex flex-col justify-between rounded-md border border-white/[0.07] bg-gradient-to-br from-indigo-500/10 to-[#212121] p-2.5"
              >
                <div>
                  <div className="text-[10px] tabular-nums text-white/40">{event.date}</div>
                  <div className="mt-0.5 text-[11px] font-medium leading-tight text-white">
                    Nightshift {index + 1}
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[9px] text-white/40">{event.venue}</span>
                  <span className="grid h-5 w-5 place-items-center rounded-full border border-white/15 text-white/40">
                    <Heart className="h-2.5 w-2.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex shrink-0 items-center justify-between border-t border-white/5 px-3 py-2 text-[10px] text-white/30">
        <span>Nightshift 2026 · created from the Conference template</span>
        <span className="flex items-center gap-1">
          <Check className="h-3 w-3 text-emerald-400" />
          Saved
        </span>
      </div>
    </div>
  );
}
