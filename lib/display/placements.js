import {
  Building2,
  CircleDot,
  DoorOpen,
  Grid3x3,
  Presentation,
  RectangleVertical,
  Rows3,
  Shapes,
} from "lucide-react";

// Physical screens a board can be simulated on. Specs are typical industry
// figures (pitch, brightness, size) so a planner can sanity-check the content.
// `sway` is the idle pan in radians (default 0.3); a preset can override it.
export const PLACEMENTS = [
  {
    key: "center_hung",
    label: "Center-hung scoreboard",
    short: "Center-hung",
    icon: CircleDot,
    desc: "Four-sided video cube with LED halo rings, hung over the ring or court.",
    specs: ["4 faces · 16:9", "4–6 mm pitch", "~15 × 8.5 m / face", "Seen from 30–120 m"],
    tip: "Every seat reads one face, so keep type large — nothing under ~5% of screen height.",
    presets: [
      { key: "floor", label: "Floor seats", position: [0, 4.2, 21], target: [0, 15, 0] },
      { key: "upper", label: "Upper bowl", position: [-26, 20.6, 30], target: [0, 15, 0] },
      { key: "close", label: "Drone", position: [8, 17, 16], target: [0, 17.5, 0] },
    ],
  },
  {
    key: "ribbon",
    label: "Ribbon fascia boards",
    short: "Ribbon boards",
    icon: Rows3,
    desc: "360° LED bands on the balcony fascia, running tickers and sponsor loops.",
    specs: ["~1 m tall", "10 mm pitch", "Up to 300 m long", "Ticker content"],
    tip: "Ribbons scroll text, so they carry Now & Next as a ticker rather than full slides.",
    presets: [
      { key: "across", label: "Across the bowl", position: [0, 6.3, 24], target: [0, 9, 0] },
      // Off-centre target: any pan would carry the camera under the upper seats.
      { key: "along", label: "Upper deck", position: [0, 14.6, 34], target: [-20, 11, 8], sway: 0 },
      { key: "high", label: "From the rafters", position: [0, 32, 8], target: [0, 6, -10] },
    ],
  },
  {
    key: "stage",
    label: "Stage LED wall + IMAG",
    short: "Stage wall",
    icon: Presentation,
    desc: "Keynote stage with a main LED wall and portrait image-magnification screens.",
    specs: ["Main wall 12 × 6.75 m", "2.6–3.9 mm pitch", "IMAG side screens", "Seen from 8–60 m"],
    tip: "The main wall is scenery behind a speaker — the lower 20% is often blocked by the stage.",
    presets: [
      { key: "house", label: "Mid house", position: [0, 3.2, 24], target: [0, 4.5, 0] },
      { key: "front", label: "Front row", position: [-4, 2, 2.2], target: [0, 5, -6] },
      { key: "balcony", label: "Balcony", position: [16, 10, 30], target: [0, 4, 0] },
    ],
  },
  {
    key: "video_wall",
    label: "Concourse video wall",
    short: "Video wall",
    icon: Grid3x3,
    desc: "Tiled LED cabinets in a busy concourse — seams and calibration show up close.",
    specs: ["16 × 9 cabinets", "8 × 4.5 m", "2.5 mm pitch", "Seen from 2–15 m"],
    tip: "Walk-past viewing: people give it 3–5 seconds, so one message per slide.",
    presets: [
      { key: "walk", label: "Walking past", position: [-9, 1.7, 9], target: [0, 2.6, 0] },
      { key: "front", label: "Head on", position: [0, 1.7, 11], target: [0, 2.6, 0] },
      { key: "close", label: "Seams up close", position: [0.9, 2.7, 0.55], target: [0.6, 2.7, 0] },
    ],
  },
  {
    key: "totem",
    label: "Lobby digital totems",
    short: "Totems",
    icon: RectangleVertical,
    desc: "Freestanding 9:16 kiosks in the entrance lobby, re-laid out for portrait.",
    specs: ['55–75" portrait', "2,500+ nits", "9:16 layout", "Seen from 1–6 m"],
    tip: "Landscape slides are letterboxed on portrait panels — the top and bottom bands fill the gap.",
    presets: [
      { key: "entry", label: "Entrance", position: [0, 1.7, 6.5], target: [0, 1.4, 0] },
      { key: "side", label: "Side angle", position: [6, 1.9, 4], target: [0, 1.3, 0] },
      { key: "close", label: "At the kiosk", position: [0.4, 1.6, 2.4], target: [0, 1.4, 0] },
    ],
  },
  {
    key: "door_sign",
    label: "Room door signs",
    short: "Door signs",
    icon: DoorOpen,
    desc: "Wall-mounted screens beside each session room — built for Up next by room.",
    specs: ['32–55" landscape', "~500 nits", "Per-room content", "Seen from 1–4 m"],
    tip: "Pair these with the Up next by room slide filtered to that room.",
    // A 4 m corridor leaves no room for the idle pan.
    sway: 0.04,
    presets: [
      { key: "hall", label: "Down the hall", position: [1, 1.7, 12], target: [-1.2, 1.6, -6] },
      { key: "door", label: "At the door", position: [0.6, 1.65, 1.2], target: [-1.9, 1.6, -1.35] },
      { key: "far", label: "Hall end", position: [0, 2.2, 22], target: [0, 1.4, -6] },
    ],
  },
  {
    key: "marquee",
    label: "Exterior pylon marquee",
    short: "Marquee",
    icon: Building2,
    desc: "Outdoor double-sided pylon at the venue entrance, over a night-time plaza.",
    specs: ["10–16 mm pitch", "6,000–10,000 nits", "IP65 outdoor", "Seen from 20–200 m"],
    tip: "Drivers get ~2 seconds: title and date slides work, dense schedules don't.",
    presets: [
      { key: "street", label: "From the street", position: [-26, 2, 38], target: [0, 10, 0] },
      { key: "plaza", label: "Plaza", position: [12, 1.8, 18], target: [0, 11, 0] },
      { key: "aerial", label: "Aerial", position: [34, 30, 40], target: [0, 6, -6] },
    ],
  },
  {
    key: "anamorphic",
    label: "Anamorphic corner billboard",
    short: "Anamorphic",
    icon: Shapes,
    desc: "L-shaped corner screen whose forced-perspective 3D only resolves from one spot.",
    specs: ["Curved 90° corner", "~150 m² canvas", "One sweet spot", "Street-level viewing"],
    tip: "Stand on the marked sweet spot: the board lifts off the building. Walk away and it falls apart.",
    presets: [
      // Must match SWEET_SPOT / SWEET_TARGET in the anamorphic scene; hold stops auto-orbit drifting off it.
      { key: "sweet", label: "Sweet spot", position: [16, 1.7, 16], target: [-3.5, 11, -3.5], hold: true },
      { key: "off", label: "Off axis", position: [-6, 2, 26], target: [-3, 11, -3] },
      { key: "side", label: "Side street", position: [30, 3, -4], target: [-3, 11, -3] },
    ],
  },
];

export const DEFAULT_PLACEMENT = "center_hung";

export const placementEntry = (key) =>
  PLACEMENTS.find((p) => p.key === key) || PLACEMENTS[0];
