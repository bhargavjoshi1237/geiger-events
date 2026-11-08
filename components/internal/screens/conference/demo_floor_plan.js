import { planFromHallBooths } from "@/lib/event_design";

// Bundled sample expo hall for the landing playground (no session or DB there), used only behind the explicit `demo` prop.
// Built from hall_booths-shaped rows so it goes through the same projection a real legacy hall does.

const boothRow = (prefix, y, count, sizeClass, price) =>
  Array.from({ length: count }, (_, i) => ({
    id: `demo-${prefix}${i + 1}`,
    kind: "booth",
    code: `${prefix}${i + 1}`,
    hall: "Hall A",
    sizeClass,
    price,
    x: 8 + i * 14,
    y,
    width: 11,
    height: 9,
    rotation: 0,
  }));

const ROWS = [
  ...boothRow("A", 10, 6, "Premium", 4500),
  ...boothRow("B", 38, 6, "Standard", 1800),
  { id: "demo-I1", kind: "booth", code: "I1", hall: "Hall A", sizeClass: "Island", price: 9000, x: 42, y: 64, width: 18, height: 22, rotation: 0 },
  { id: "demo-cafe", kind: "feature", name: "Café", x: 8, y: 66, width: 22, height: 18, rotation: 0 },
  { id: "demo-entrance", kind: "feature", name: "Entrance", x: 72, y: 90, width: 18, height: 6, rotation: 0 },
];

export const DEMO_HALL = {
  id: "demo-hall",
  name: "Hall A — main expo floor",
  kind: "expo",
  status: "final",
  hallMapId: "demo-hall-map",
  venueId: null,
  venueSpaceId: null,
  version: 1,
  ...planFromHallBooths(ROWS, "4/3", 48),
};

// Per-booth state for the demo "Expo Booths" list.
export const DEMO_BOOTH_STATE = {
  "demo-A1": { status: "sold", exhibitorName: "Stripe" },
  "demo-A2": { status: "sold", exhibitorName: "Vercel" },
  "demo-A4": { status: "held" },
  "demo-B1": { status: "comp", exhibitorName: "Linear" },
  "demo-B3": { status: "sold", exhibitorName: "Supabase" },
  "demo-B6": { status: "blocked" },
  "demo-I1": { status: "sold", exhibitorName: "Figma" },
};
