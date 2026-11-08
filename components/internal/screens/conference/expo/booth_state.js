"use client";

import { getEventExpo, listBoothAssignments } from "@/lib/supabase/expo";
import { formatArea, formatDimensions } from "@/lib/event_design";

// Per-event booth state for the Expo Booths list and edit page: sold / assigned (comp) / blocked come from
// booth_assignments, held from live checkout holds, everything else is available.

export const BOOTH_STATE_MAP = {
  available: { label: "Available", variant: "neutral", dotClass: "bg-zinc-400" },
  held: { label: "Held", variant: "warning", dotClass: "bg-amber-400" },
  sold: { label: "Sold", variant: "success", dotClass: "bg-emerald-400" },
  comp: { label: "Assigned", variant: "info", dotClass: "bg-sky-400" },
  blocked: { label: "Blocked", variant: "neutral", dotClass: "bg-violet-400" },
};

export const BOOTH_STATE_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  ...Object.entries(BOOTH_STATE_MAP).map(([value, s]) => ({ value, label: s.label })),
];

// { byBooth: Map(boothId → live assignment), taken: Set(boothId) } for one event, or null when it can't load.
export async function loadEventBoothState(eventId) {
  if (!eventId) return null;
  const [expo, assignments] = await Promise.all([getEventExpo(eventId), listBoothAssignments(eventId)]);
  if (assignments === null) return null;
  return {
    byBooth: new Map((assignments || []).map((a) => [a.boothId, a])),
    taken: expo?.taken instanceof Set ? expo.taken : new Set(),
  };
}

export function boothStateOf(boothId, state) {
  const a = state?.byBooth.get(boothId);
  if (a) return { key: a.status === "blocked" ? "blocked" : a.status === "comp" ? "comp" : "sold", assignment: a };
  if (state?.taken.has(boothId)) return { key: "held", assignment: null };
  return { key: "available", assignment: null };
}

// "3 × 3 m · 9 m²", or "" for a legacy booth with no real size yet.
export function boothFootprint(booth) {
  if (!(booth?.widthM > 0) || !(booth?.depthM > 0)) return "";
  return `${formatDimensions(booth.widthM, booth.depthM, booth.unit)} · ${formatArea(booth.widthM * booth.depthM, booth.unit)}`;
}
