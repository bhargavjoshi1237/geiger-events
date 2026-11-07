import {
  Armchair,
  DoorOpen,
  Flower2,
  Music,
  Presentation,
  Speaker,
  UtensilsCrossed,
  Wine,
} from "lucide-react";

import { CATEGORIES, SETUP_STYLES } from "@/lib/event_design";

// UI-only constants for the Event Design screens (domain constants live in lib/event_design).

export const CATEGORY_ICONS = {
  tables: UtensilsCrossed,
  seating: Armchair,
  staging: Presentation,
  bars_catering: Wine,
  dance_entertainment: Music,
  av: Speaker,
  decor: Flower2,
  structure: DoorOpen,
};

export const PLAN_STATUS_MAP = {
  draft: { label: "Draft", variant: "neutral", dotClass: "bg-zinc-400" },
  final: { label: "Final", variant: "success", dotClass: "bg-emerald-400" },
};

export const PLAN_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "final", label: "Final" },
];

export const SETUP_STYLE_FILTER_OPTIONS = [
  { value: "all", label: "All setup styles" },
  ...SETUP_STYLES,
];

export const CATEGORY_FILTER_OPTIONS = [
  { value: "all", label: "All categories" },
  ...CATEGORIES.map((c) => ({ value: c.key, label: c.label })),
];

export const TEMPLATE_CATEGORIES = [
  "Wedding",
  "Gala dinner",
  "Conference",
  "Meeting",
  "Party",
  "Exhibition",
  "Other",
];

export const GALLERY_GRID = "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3";
