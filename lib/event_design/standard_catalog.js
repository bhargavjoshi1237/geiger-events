// The standard object catalog — the source of the global `events.design_objects` seed (same fixed ids), and the fallback when it isn't seeded.

const FT = 0.3048;
const IN = 0.0254;
const r3 = (n) => Math.round(n * 1000) / 1000;

// Fixed, valid uuids so placed instances keep resolving to the seeded rows in every environment.
const sid = (n) => `e0d00000-0000-4000-a000-${String(n).padStart(12, "0")}`;

// Quarter ring (serpentine) outline in unit box coords (-0.5..0.5).
function serpentinePoints(outer = 1, ringWidth = 0.42, steps = 8) {
  const inner = outer - ringWidth;
  const pts = [];
  for (let i = 0; i <= steps; i += 1) {
    const a = (-90 + (90 * i) / steps) * (Math.PI / 180);
    pts.push([outer * Math.cos(a), outer * Math.sin(a)]);
  }
  for (let i = steps; i >= 0; i -= 1) {
    const a = (-90 + (90 * i) / steps) * (Math.PI / 180);
    pts.push([inner * Math.cos(a), inner * Math.sin(a)]);
  }
  return pts.map(([x, y]) => [r3(x / outer - 0.5), r3(y / outer + 0.5)]);
}

// L-shaped corner bar outline in unit box coords: arms along the top and left edges.
function cornerPoints(armRatio = 0.3125) {
  const a = armRatio - 0.5;
  return [
    [-0.5, -0.5],
    [0.5, -0.5],
    [0.5, a],
    [a, a],
    [a, 0.5],
    [-0.5, 0.5],
  ];
}

const row = (n, key, name, category, shape, width, depth, height, seats, mode, extra = {}) => ({
  id: sid(n),
  projectId: null,
  key,
  name,
  category,
  shape,
  widthM: r3(width),
  depthM: r3(depth),
  heightM: height === null ? null : r3(height),
  seats,
  chairLayout: { mode, ...(extra.ends ? { ends: true } : {}) },
  color: "",
  icon: "",
  sortOrder: n,
  config: {
    ...(extra.layer ? { layer: extra.layer } : {}),
    ...(extra.symbol ? { symbol: extra.symbol } : {}),
    ...(extra.points ? { points: extra.points } : {}),
  },
  description: extra.description || "",
  isStandard: true,
});

export const STANDARD_CATALOG = [
  // Tables
  row(1, "round-48", '48" round table', "tables", "round", 48 * IN, 48 * IN, 0.76, 6, "around", { description: "Seats 6 comfortably." }),
  row(2, "round-60", '60" round table', "tables", "round", 60 * IN, 60 * IN, 0.76, 8, "around", { description: "The banquet standard — 8, or 10 tight." }),
  row(3, "round-72", '72" round table', "tables", "round", 72 * IN, 72 * IN, 0.76, 10, "around", { description: "Seats 10, or 12 tight." }),
  row(4, "banquet-5ft", "Banquet table 5 ft", "tables", "rect", 5 * FT, 30 * IN, 0.76, 4, "sides"),
  row(5, "banquet-6ft", "Banquet table 6 ft", "tables", "rect", 6 * FT, 30 * IN, 0.76, 6, "sides"),
  row(6, "banquet-8ft", "Banquet table 8 ft", "tables", "rect", 8 * FT, 30 * IN, 0.76, 8, "sides"),
  row(7, "classroom-6ft", "Classroom table 6 ft", "tables", "rect", 6 * FT, 18 * IN, 0.76, 3, "one_side", { description: "18\" deep, everyone facing front." }),
  row(8, "classroom-8ft", "Classroom table 8 ft", "tables", "rect", 8 * FT, 18 * IN, 0.76, 4, "one_side"),
  row(9, "cocktail-30", 'Cocktail highboy 30"', "tables", "round", 30 * IN, 30 * IN, 1.07, 0, "none", { description: "Standing-height poseur table." }),
  row(10, "serpentine", "Serpentine table", "tables", "custom", 6 * FT, 6 * FT, 0.76, 0, "none", { points: serpentinePoints(), description: "Quarter-ring — buffets, bars and curved head tables." }),
  row(11, "boardroom-12ft", "Boardroom table 12 ft", "tables", "rect", 12 * FT, 4 * FT, 0.76, 12, "sides", { ends: true }),
  row(12, "registration-desk", "Registration desk", "tables", "rect", 6 * FT, 30 * IN, 0.76, 2, "one_side"),

  // Seating
  row(13, "chair-banquet", "Banquet chair", "seating", "rect", 0.45, 0.45, 0.9, 1, "integral"),
  row(14, "chair-theatre", "Theatre chair", "seating", "rect", 0.5, 0.5, 0.85, 1, "integral"),
  row(15, "armchair", "Lounge armchair", "seating", "rect", 0.85, 0.85, 0.8, 1, "integral"),
  row(16, "sofa-3", "Sofa (3-seat)", "seating", "rect", 2.0, 0.9, 0.85, 3, "integral"),
  row(17, "lounge-set", "Lounge set", "seating", "rect", 3.0, 2.4, 0.85, 5, "integral", { description: "Sofa, two armchairs and a coffee table." }),

  // Staging
  row(18, "stage-8x4", "Stage riser 8×4 ft", "staging", "rect", 8 * FT, 4 * FT, 16 * IN, 0, "none"),
  row(19, "stage-8x8", "Stage riser 8×8 ft", "staging", "rect", 8 * FT, 8 * FT, 16 * IN, 0, "none"),
  row(20, "stage-steps", "Stage steps", "staging", "rect", 4 * FT, 2 * FT, 16 * IN, 0, "none"),
  row(21, "podium", "Podium / lectern", "staging", "rect", 0.6, 0.5, 1.2, 0, "none", { layer: "furniture" }),

  // Bars & catering
  row(22, "bar-straight", "Bar 8 ft (straight)", "bars_catering", "rect", 8 * FT, 30 * IN, 1.07, 0, "none"),
  row(23, "bar-corner", "Corner bar (L-shape)", "bars_catering", "custom", 8 * FT, 8 * FT, 1.07, 0, "none", { points: cornerPoints() }),
  row(24, "buffet-station", "Buffet station 8 ft", "bars_catering", "rect", 8 * FT, 30 * IN, 0.76, 0, "none"),
  row(25, "beverage-station", "Beverage station 6 ft", "bars_catering", "rect", 6 * FT, 30 * IN, 0.76, 0, "none"),

  // Dance & entertainment
  row(26, "dance-panel-3ft", "Dance floor panel 3×3 ft", "dance_entertainment", "rect", 3 * FT, 3 * FT, 0.02, 0, "none", { symbol: "dance" }),
  row(27, "dance-floor-12ft", "Dance floor 12×12 ft", "dance_entertainment", "rect", 12 * FT, 12 * FT, 0.02, 0, "none", { symbol: "dance", description: "Sixteen 3 ft panels." }),
  row(28, "dj-booth", "DJ booth", "dance_entertainment", "rect", 2.0, 0.9, 1.1, 0, "none", { layer: "furniture" }),

  // AV
  row(29, "projection-screen", "Projection screen 10 ft", "av", "rect", 10 * FT, 0.6, 2.6, 0, "none", { symbol: "screen" }),
  row(30, "tv-stand", 'TV on stand (65")', "av", "rect", 1.5, 0.6, 1.8, 0, "none", { symbol: "screen" }),
  row(31, "speaker", "Speaker on stand", "av", "round", 0.6, 0.6, 1.8, 0, "none"),
  row(32, "foh-desk", "AV / FOH desk", "av", "rect", 6 * FT, 30 * IN, 0.76, 2, "one_side"),

  // Decor
  row(33, "pipe-drape-10ft", "Pipe & drape 10 ft", "decor", "rect", 10 * FT, 0.3, 8 * FT, 0, "none"),
  row(34, "plant", "Plant / floral", "decor", "round", 0.6, 0.6, 1.2, 0, "none"),
  row(35, "sign-easel", "Sign easel", "decor", "rect", 0.6, 0.5, 1.6, 0, "none"),

  // Fixtures & structure
  row(36, "pillar", "Pillar", "structure", "rect", 0.6, 0.6, null, 0, "none"),
  row(37, "door", "Door", "structure", "rect", 3 * FT, 0.15, 2.1, 0, "none", { symbol: "door" }),
  row(38, "door-double", "Double door", "structure", "rect", 6 * FT, 0.15, 2.1, 0, "none", { symbol: "door_double" }),
  row(39, "emergency-exit", "Emergency exit", "structure", "rect", 1.2, 0.15, 2.1, 0, "none", { symbol: "exit" }),
  row(40, "power-drop", "Power drop", "structure", "rect", 0.3, 0.3, null, 0, "none", { symbol: "power" }),
];
