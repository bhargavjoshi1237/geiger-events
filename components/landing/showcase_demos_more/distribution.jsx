"use client";

import { useState } from "react";
import { Bell, Heart, Megaphone, Newspaper } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  CARD,
  LABEL,
  META,
  PANEL,
  TITLE,
} from "@/components/landing/showcase_demos";
import { Chip } from "./shared";

/* ------------------------------------------------------------------ *
 * Distribution & growth — campaigns, advertising, discovery
 * ------------------------------------------------------------------ */

const CAMPAIGNS = [
  { id: "c1", kind: "Newsletter", name: "March lineup", meta: "8,400 recipients · 61% open", icon: Newspaper, active: true },
  { id: "c2", kind: "Ad campaign", name: "Retargeting — VIP", meta: "$1,200 budget · $0.34 / result", icon: Megaphone, active: true },
  { id: "c3", kind: "Auto reminder", name: "T-minus 7 days", meta: "12,400 delivered · 98.2%", icon: Bell, active: false },
];

// Campaigns & advertising — one place for the emails, reminders, and paid ads.
export function CampaignsAdvertisingDemo() {
  const [active, setActive] = useState(
    Object.fromEntries(CAMPAIGNS.map((item) => [item.id, item.active])),
  );

  const toggle = (id) => setActive((prev) => ({ ...prev, [id]: !prev[id] }));

  const liveCount = CAMPAIGNS.filter((item) => active[item.id]).length;
  const spend = active.c2 ? 2400 : 1200;

  return (
    <div className={PANEL}>
      <div className="mb-2 flex shrink-0 items-baseline justify-between">
        <span className={TITLE}>Campaigns & advertising</span>
        <span className={META}>{liveCount} live</span>
      </div>

      <div className="min-h-0 flex-1 space-y-1.5">
        {CAMPAIGNS.map((item) => {
          const Icon = item.icon;
          const on = active[item.id];
          return (
            <div key={item.id} className={cn(CARD, "flex items-center gap-2 px-3 py-2")}>
              <span
                className={cn(
                  "grid h-6 w-6 shrink-0 place-items-center rounded-md border",
                  on ? "border-indigo-400/30 bg-indigo-500/10 text-indigo-300" : "border-white/10 text-white/30",
                )}
              >
                <Icon className="h-3 w-3" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-medium text-white">
                  {item.name}
                </div>
                <div className="truncate text-[10px] text-white/40">
                  {item.kind} · {item.meta}
                </div>
              </div>
              <button
                type="button"
                onClick={() => toggle(item.id)}
                className={cn(
                  "relative h-4 w-7 shrink-0 rounded-full transition-colors",
                  on ? "bg-emerald-500/80" : "bg-white/15",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all",
                    on ? "left-3.5" : "left-0.5",
                  )}
                />
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-2 shrink-0">
        <div className="flex items-center justify-between text-[10px] text-white/40">
          <span>Ad budget · this month</span>
          <span className="tabular-nums">
            ${spend.toLocaleString("en-US")} / $3,000
          </span>
        </div>
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-indigo-400/70"
            style={{ width: `${Math.min(100, (spend / 3000) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

const WALL_EVENTS = [
  { id: "w1", name: "Nightshift 2026", date: "Sat 14 Mar", status: "Selling" },
  { id: "w2", name: "Nightshift Day", date: "Sun 15 Mar", status: "Apply" },
  { id: "w3", name: "Nightshift Open Labs", date: "Fri 20 Mar", status: "Selling" },
];

// Discovery — an organizer profile and public wall buyers can follow.
export function DiscoveryDemo() {
  const [following, setFollowing] = useState(false);
  const followers = 4200 + (following ? 1 : 0);

  return (
    <div className={PANEL}>
      <div className="mb-2 flex shrink-0 items-center justify-between">
        <span className={TITLE}>Discovery & distribution</span>
        <button
          type="button"
          onClick={() => setFollowing((value) => !value)}
          className={cn(
            "flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors",
            following
              ? "border-white/25 bg-white/10 text-white"
              : "bg-white text-zinc-950 hover:bg-white/90",
          )}
        >
          <Heart className={cn("h-3 w-3", following && "fill-red-400 text-red-400")} />
          {following ? "Following" : "Follow"}
        </button>
      </div>

      <div className={cn(CARD, "mb-2 flex shrink-0 items-center gap-2.5 px-3 py-2")}>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-500/40 to-[#2b2b2b] text-[10px] font-semibold text-white">
          NS
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-medium text-white">
            Nightshift Live
          </div>
          <div className={META}>
            {followers.toLocaleString("en-US")} followers · geiger.events/w/nightshift
          </div>
        </div>
      </div>

      <div className={cn(LABEL, "shrink-0")}>Upcoming on the wall</div>
      <div className="mt-1.5 min-h-0 flex-1 space-y-1.5">
        {WALL_EVENTS.map((event) => (
          <div key={event.id} className={cn(CARD, "flex items-center gap-2 px-3 py-2")}>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-medium text-white">
                {event.name}
              </div>
              <div className="truncate text-[10px] text-white/40">{event.date}</div>
            </div>
            <Chip tone={event.status === "Selling" ? "live" : "muted"}>{event.status}</Chip>
          </div>
        ))}
      </div>
    </div>
  );
}
