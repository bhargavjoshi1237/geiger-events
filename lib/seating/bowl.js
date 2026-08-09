// Pure bowl geometry. Lays a whole venue's sections out around a central field
// in one call, so an arena isn't dragged into existence one rectangle at a time.
// No DB, no React — it returns plain section drafts the editor persists.
//
// The convention that matters: generateSeats() puts row A at the TOP of a
// section box, so an unrotated section faces UP. Every rotation below exists to
// point that front edge at the field.

const TAU = Math.PI * 2;
const round2 = (n) => Math.round(n * 100) / 100;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export const BOWL_SHAPES = [
  { value: "oval", label: "Oval stadium", hint: "Sections ring an elliptical pitch." },
  { value: "rect", label: "Rectangular arena", hint: "Four straight sides around a court or rink." },
  { value: "horseshoe", label: "Theatre horseshoe", hint: "Seats fan around a stage at one end." },
  { value: "rounds", label: "Banquet rounds", hint: "Tables in a grid around a central floor." },
];

export const DEFAULT_FIELD = {
  shape: "pitch",
  x: 33,
  y: 36,
  width: 34,
  height: 28,
  rotation: 0,
  label: "Field",
};

const DEFAULT_LAYOUT = {
  rows: 12,
  seatsPerRow: 14,
  rowLabels: "alpha",
  rowLabelStart: "A",
  numbering: "continental",
  curve: 0,
  rake: 0,
  aisleAfter: [],
};

// Rotation that turns a section's front edge (its top) toward the bowl centre,
// for a section sitting at angle `phi` on the ring. Derived from generate.js's
// rotatePoint: rotating (0,-1) by t gives (sin t, -cos t), and we need that to
// equal (-cos phi, -sin phi).
export function facingRotation(phi) {
  const deg = (Math.atan2(-Math.cos(phi), Math.sin(phi)) * 180) / Math.PI;
  return round2((deg + 360) % 360);
}

// Tier 1 -> 101, 102 … tier 2 -> 201, 202 …
function sectionName(tierIndex, n) {
  return String((tierIndex + 1) * 100 + n);
}

function draft({ name, x, y, width, height, rotation, layout, sortOrder }) {
  return {
    name,
    kind: "seated",
    x: round2(clamp(x, 0, 100)),
    y: round2(clamp(y, 0, 100)),
    width: round2(clamp(width, 2, 100)),
    height: round2(clamp(height, 2, 100)),
    rotation,
    layout: { ...DEFAULT_LAYOUT, ...layout },
    sortOrder,
  };
}

// Sections spread around an ellipse. `sweep` lets the horseshoe leave a gap for
// the stage; a full oval sweeps the whole turn.
function ringSections({ tierIndex, count, cx, cy, rx, ry, depth, layout, sweep, sortBase }) {
  const out = [];
  const { from = 0, to = TAU, closed = true } = sweep || {};
  const span = to - from;
  // A closed ring's last section must not land on top of the first.
  const step = span / (closed ? count : Math.max(1, count - 1));

  // Chord width from the mean radius, backed off so neighbours don't touch.
  const width = ((TAU * ((rx + ry) / 2)) / Math.max(1, count)) * 0.86;

  for (let n = 0; n < count; n += 1) {
    const phi = from + step * n;
    const px = cx + rx * Math.cos(phi);
    const py = cy + ry * Math.sin(phi);
    out.push(
      draft({
        name: sectionName(tierIndex, n + 1),
        x: px - width / 2,
        y: py - depth / 2,
        width,
        height: depth,
        rotation: facingRotation(phi),
        layout,
        sortOrder: sortBase + n,
      }),
    );
  }
  return out;
}

// Four straight sides. Rotations are the cardinal cases of facingRotation():
// a section below the field already faces up, one above it needs a half turn.
function rectSections({ tierIndex, perSide, cx, cy, rx, ry, depth, layout, sortBase }) {
  const out = [];
  const sides = [
    // Below the field — already facing up.
    { rotation: 0, along: "x", length: rx * 2, fixed: cy + ry, sign: 1 },
    // Above the field — turn to face down.
    { rotation: 180, along: "x", length: rx * 2, fixed: cy - ry, sign: -1 },
    // Left of the field — face right.
    { rotation: 90, along: "y", length: ry * 2, fixed: cx - rx, sign: -1 },
    // Right of the field — face left.
    { rotation: 270, along: "y", length: ry * 2, fixed: cx + rx, sign: 1 },
  ];

  let n = 0;
  for (const side of sides) {
    const width = (side.length / perSide) * 0.9;
    for (let i = 0; i < perSide; i += 1) {
      const t = side.length * ((i + 0.5) / perSide) - side.length / 2;
      n += 1;
      // `fixed` is the ring edge; step out by half the tier depth so the block
      // sits outside the field rather than straddling its boundary.
      const offset = side.fixed + (side.sign * depth) / 2;
      const px = side.along === "x" ? cx + t : offset;
      const py = side.along === "x" ? offset : cy + t;
      out.push(
        draft({
          name: sectionName(tierIndex, n),
          x: px - width / 2,
          y: py - depth / 2,
          width,
          height: depth,
          rotation: side.rotation,
          layout,
          sortOrder: sortBase + n,
        }),
      );
    }
  }
  return out;
}

// Banquet rounds: small equal tables laid out in a grid that skips the middle,
// where the field (dance floor / stage) sits.
function banquetTables({ count, field, seatsPerTable, sortBase }) {
  const out = [];
  const size = 9;
  const cols = Math.ceil(Math.sqrt(count * 1.4));
  const rows = Math.ceil(count / cols);
  const stepX = 96 / cols;
  const stepY = 96 / rows;

  const fx1 = field.x;
  const fx2 = field.x + field.width;
  const fy1 = field.y;
  const fy2 = field.y + field.height;

  let placed = 0;
  for (let r = 0; r < rows && placed < count; r += 1) {
    for (let c = 0; c < cols && placed < count; c += 1) {
      const px = 2 + stepX * (c + 0.5);
      const py = 2 + stepY * (r + 0.5);
      // Skip any cell that would sit on the dance floor.
      if (px > fx1 - size / 2 && px < fx2 + size / 2 && py > fy1 - size / 2 && py < fy2 + size / 2) {
        continue;
      }
      placed += 1;
      out.push(
        draft({
          name: `Table ${placed}`,
          x: px - size / 2,
          y: py - size / 2,
          width: size,
          height: size,
          rotation: 0,
          layout: {
            rows: 2,
            seatsPerRow: Math.max(1, Math.round(seatsPerTable / 2)),
            rowLabels: "numeric",
            rowLabelStart: "1",
            numbering: "continental",
          },
          sortOrder: sortBase + placed,
        }),
      );
    }
  }
  return out;
}

// Lay out a whole bowl.
//
//   shape       oval | rect | horseshoe | rounds
//   tiers       how many concentric rings (ignored by `rounds`)
//   perSide     sections per side (rect) or per quarter turn (oval/horseshoe)
//   field       { x, y, width, height } in percent — the ring is built around it
//   gap         clear space between the field and tier 1, and between tiers
//   tierDepth   how deep (how many rows' worth) each ring is
//
// Returns section drafts ready for createSection(). Nothing is persisted here.
export function generateBowl(options = {}) {
  const {
    shape = "oval",
    tiers = 2,
    perSide = 6,
    field = DEFAULT_FIELD,
    gap = 2.5,
    tierDepth = 10,
    rows = 12,
    seatsPerRow = 14,
    seatsPerTable = 10,
    tables = 16,
  } = options;

  const layout = { ...DEFAULT_LAYOUT, rows, seatsPerRow };

  const fx = Number(field.x) || 0;
  const fy = Number(field.y) || 0;
  const fw = Number(field.width) || 0;
  const fh = Number(field.height) || 0;
  const cx = fx + fw / 2;
  const cy = fy + fh / 2;

  if (shape === "rounds") {
    return banquetTables({
      count: Math.max(1, Math.round(tables)),
      field: { x: fx, y: fy, width: fw, height: fh },
      seatsPerTable,
      sortBase: 0,
    });
  }

  const tierCount = Math.max(1, Math.round(tiers));
  const perSideCount = Math.max(1, Math.round(perSide));
  const out = [];

  for (let t = 0; t < tierCount; t += 1) {
    // Each ring sits one gap + one full tier beyond the last.
    const inset = gap + t * (tierDepth + gap);
    const rx = fw / 2 + inset;
    const ry = fh / 2 + inset;
    const sortBase = t * 1000;

    if (shape === "rect") {
      out.push(
        ...rectSections({
          tierIndex: t,
          perSide: perSideCount,
          cx,
          cy,
          rx,
          ry,
          depth: tierDepth,
          layout,
          sortBase,
        }),
      );
      continue;
    }

    // A horseshoe leaves the top 120 degrees open for the stage; the arc runs
    // from upper-right, under the field, round to upper-left.
    const sweep =
      shape === "horseshoe"
        ? { from: -Math.PI / 6, to: Math.PI + Math.PI / 6, closed: false }
        : { from: 0, to: TAU, closed: true };

    const count = shape === "horseshoe" ? perSideCount * 3 : perSideCount * 4;

    out.push(
      ...ringSections({
        tierIndex: t,
        count,
        cx,
        cy,
        rx: rx + tierDepth / 2,
        ry: ry + tierDepth / 2,
        depth: tierDepth,
        layout,
        sweep,
        sortBase,
      }),
    );
  }

  return out;
}

// How many chairs a generated bowl would hold — shown in the dialog before the
// organiser commits to writing a few thousand rows.
export function bowlSeatCount(drafts) {
  return (drafts || []).reduce(
    (sum, s) => sum + (Number(s.layout?.rows) || 0) * (Number(s.layout?.seatsPerRow) || 0),
    0,
  );
}
