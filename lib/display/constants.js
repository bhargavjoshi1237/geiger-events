import {
  Clock,
  DoorOpen,
  Image as ImageIcon,
  LayoutGrid,
  MessageSquare,
  Type,
} from "lucide-react";


export const BOARD_W = 1920;
export const BOARD_H = 1080;

export const THEMES = {
  midnight: {
    label: "Midnight",
    bg: "#0e0e10",
    panel: "#17171a",
    line: "#2a2a2f",
    fg: "#f4f4f5",
    muted: "#a1a1aa",
    dim: "#71717a",
    accent: "#ee6b3b",
    live: "#34d399",
  },
  slate: {
    label: "Slate",
    bg: "#111b21",
    panel: "#17252d",
    line: "#263841",
    fg: "#eef4f7",
    muted: "#9db2bd",
    dim: "#6b8391",
    accent: "#38bdf8",
    live: "#4ade80",
  },
  paper: {
    label: "Paper",
    bg: "#f6f5f2",
    panel: "#ffffff",
    line: "#e2e0da",
    fg: "#1c1b19",
    muted: "#57544d",
    dim: "#8a867c",
    accent: "#c2410c",
    live: "#15803d",
  },
  ink: {
    label: "Ink",
    bg: "#000000",
    panel: "#0d0d0d",
    line: "#242424",
    fg: "#ffffff",
    muted: "#b4b4b4",
    dim: "#7a7a7a",
    accent: "#ffffff",
    live: "#ffffff",
  },
};

export const THEME_OPTIONS = Object.entries(THEMES).map(([value, t]) => ({
  value,
  label: t.label,
}));

export const DEFAULT_THEME = "midnight";

export const TRACK_COLORS = [
  "#ee6b3b",
  "#38bdf8",
  "#a78bfa",
  "#34d399",
  "#fbbf24",
  "#f472b6",
];

export const trackColor = (index) =>
  TRACK_COLORS[((index % TRACK_COLORS.length) + TRACK_COLORS.length) % TRACK_COLORS.length];

export const SLIDE_CATALOG = [
  {
    key: "title",
    label: "Title card",
    icon: Type,
    group: "Branding",
    desc: "The event's name, date, and venue over its cover image.",
    duration: 8,
    config: { heading: "", subheading: "", showCover: true },
  },
  {
    key: "now_next",
    label: "Now & Next",
    icon: Clock,
    group: "Schedule",
    desc: "What's running right now, and what follows it.",
    duration: 12,
    config: { heading: "Happening now", day: "", upcoming: 4 },
  },
  {
    key: "day_grid",
    label: "Full day grid",
    icon: LayoutGrid,
    group: "Schedule",
    desc: "A whole day's tracks and times on one slide.",
    duration: 15,
    config: { heading: "", day: "" },
  },
  {
    key: "room_next",
    label: "Up next by room",
    icon: DoorOpen,
    group: "Schedule",
    desc: "One room's upcoming sessions — for the screen outside its door.",
    duration: 12,
    config: { heading: "", room: "", day: "", upcoming: 5 },
  },
  {
    key: "message",
    label: "Message",
    icon: MessageSquare,
    group: "Branding",
    desc: "A free-text announcement between schedule slides.",
    duration: 8,
    config: { heading: "", body: "" },
  },
  {
    key: "image",
    label: "Image",
    icon: ImageIcon,
    group: "Branding",
    desc: "A sponsor board, map, or any full-bleed image.",
    duration: 8,
    config: { url: "", fit: "cover", caption: "" },
  },
];

export const catalogEntry = (type) =>
  SLIDE_CATALOG.find((s) => s.key === type) || null;

export const slideLabel = (type) => catalogEntry(type)?.label || "Slide";

export const defaultConfig = (type) => ({ ...(catalogEntry(type)?.config || {}) });

export const defaultDuration = (type) => catalogEntry(type)?.duration ?? 10;

export function groupedCatalog() {
  const groups = [];
  for (const entry of SLIDE_CATALOG) {
    let group = groups.find((g) => g.group === entry.group);
    if (!group) {
      group = { group: entry.group, items: [] };
      groups.push(group);
    }
    group.items.push(entry);
  }
  return groups;
}

export function summarizeSlide(slide) {
  const config = slide?.config || {};
  switch (slide?.type) {
    case "title":
      return config.heading?.trim() || "The event's own name and date";
    case "now_next":
      return [config.day?.trim() || "All days", `next ${config.upcoming || 4}`].join(" · ");
    case "day_grid":
      return config.day?.trim() || "All scheduled sessions";
    case "room_next":
      return config.room?.trim() || "Every room";
    case "message":
      return config.heading?.trim() || config.body?.trim() || "Empty message";
    case "image":
      return config.caption?.trim() || (config.url ? "Image set" : "No image yet");
    default:
      return "";
  }
}

export const FIT_OPTIONS = [
  { value: "cover", label: "Fill the screen" },
  { value: "contain", label: "Fit inside" },
];

export const SPEED_OPTIONS = [
  { value: "0.5", label: "Fast (½×)" },
  { value: "1", label: "Normal" },
  { value: "1.5", label: "Relaxed (1½×)" },
  { value: "2", label: "Slow (2×)" },
];

export const BOARD_STATUS_MAP = {
  Draft: { label: "Draft", variant: "muted", dotClass: "bg-zinc-400" },
  Published: { label: "Published", variant: "success", dotClass: "bg-emerald-400" },
};
