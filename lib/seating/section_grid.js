// Drill-down seat geometry. Measures one section's stored chairs so the map can
// draw them in place: how big to draw a chair, where to park each row's label,
// and the two boxes around the block — one to highlight it, one to frame it.
//
// The grid is NOT reshaped. An earlier version squashed the looser axis to put
// the chairs on a square pitch, on the theory that a 1.5:1 pitch was what made
// the block read as a scatter of dots. It wasn't — the scatter came from the
// canvas being rendered at the wrong aspect (see map_canvas.jsx), and squaring
// the pitch on top of that cost the one cue that makes a chart read as rows:
// rows sit further apart than the chairs within them. Row pitch and seat pitch
// differ in every real venue, and the map should say so.
//
// Chairs are re-derived from the section's layout rather than drawn from their
// stored coordinates — same lattice, at a precision numeric(6, 2) can't hold
// (see idealised()). It is the same positions, not different ones: what goes is
// the storage rounding the zoom was magnifying into a ragged row.
//
// What the stored coordinates genuinely can't answer is WHERE THE BLOCK IS. A
// rotated section's chairs form a tilted rectangle, so the stored axis-aligned
// box both over-covers them and frames them badly when the viewport zooms in.
// The frame and bounds returned here are the chairs' own. No DB, no React.

import { aspectRatio, rotateUnits } from "./geometry.js";
import { generateSeats } from "./generate.js";

// Breathing room around the block, in chairs, so the highlight and the zoom
// don't crop the outermost seats.
const BOUNDS_PAD = 0.75;

// Drawing precision. The seats table is numeric(6, 2), which is plenty to store
// a venue but not to draw one: the drill-down magnifies the map 10-40x, so a
// hundredth of a percent lands as a visible wobble and the block stops reading
// as a lattice. Positions are re-derived below, so they are kept at a precision
// the zoom can't expose.
const round4 = (n) => Math.round(n * 10000) / 10000;

const seatKey = (seat) => `${seat?.rowLabel ?? ""}|${seat?.seatLabel ?? ""}`;

// The chairs at the exact positions their section's layout describes, matched
// to the stored ones by row and seat label — same seats, same order, without
// the storage rounding. Returns null (keep the stored coordinates) whenever the
// layout can't account for every chair: a CSV import carries real surveyed
// positions, and a section whose layout was edited after its seats were written
// would otherwise be drawn as a grid it no longer has.
function idealised(list, section, aspect) {
  if (!Number(section?.layout?.rows) || !Number(section?.layout?.seatsPerRow)) return null;

  const ideal = new Map();
  for (const seat of generateSeats(section, aspect, { round: false })) {
    const key = seatKey(seat);
    // Duplicate labels make the match ambiguous — don't guess at it.
    if (ideal.has(key)) return null;
    ideal.set(key, seat);
  }

  const out = [];
  for (const seat of list) {
    const match = ideal.get(seatKey(seat));
    if (!match) return null;
    out.push({ ...seat, x: match.x, y: match.y });
  }
  return out;
}

// Mean gap between consecutive distinct values. Chair coordinates are stored to
// 2dp, so identical positions arrive a hundredth apart and a plain "count the
// distinct values" would see a row of 14 chairs as 14 rows.
function meanStep(values, tolerance) {
  const sorted = [...values].sort((a, b) => a - b);
  const distinct = [];
  for (const v of sorted) {
    if (!distinct.length || v - distinct[distinct.length - 1] > tolerance) distinct.push(v);
  }
  if (distinct.length < 2) return 0;
  return (distinct[distinct.length - 1] - distinct[0]) / (distinct.length - 1);
}

// A section's chairs, measured for drawing, in percent-of-canvas.
//
// Returns `{ seats, rows, pitch, frame, bounds }`:
//   seats  — the input seats with `gx`/`gy` added (percent, as stored)
//   rows   — one `{ label, x, y }` per row, parked just outside its first chair
//   pitch  — the TIGHTER of the two spacings in UNITS, i.e. the biggest a chair
//            can be drawn without the block closing up into one slab
//   frame  — `{ x, y, width, height, rotation }` in percent: the block the way
//            it FACES, to be drawn with a matching CSS rotate(). The chairs of
//            a turned section form a tilted rectangle, and boxing them with an
//            upright rect makes the highlight disagree with what's inside it.
//   bounds — the same block's upright bounding box, for framing the viewport
export function sectionSeatGrid(seats, section, aspect = 1) {
  const list = seats || [];
  if (!list.length) return { seats: [], rows: [], pitch: 0, frame: null, bounds: null };

  const ar = aspectRatio(aspect);
  const rotation = Number(section?.rotation) || 0;
  const cx = ((Number(section?.x) || 0) + (Number(section?.width) || 0) / 2) * ar;
  const cy = (Number(section?.y) || 0) + (Number(section?.height) || 0) / 2;

  // Percent -> units -> the section's own frame, where rows run horizontally
  // whatever way the block is turned to face the field.
  const source = idealised(list, section, aspect) || list;
  const local = source.map((seat) => ({
    seat,
    ...rotateUnits((Number(seat.x) || 0) * ar, Number(seat.y) || 0, cx, cy, -rotation),
  }));

  const xs = local.map((p) => p.x);
  const ys = local.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  // Tolerance scales with the block so a tiny section isn't read as one big row.
  const tolerance = Math.max(0.03, (maxX - minX + maxY - minY) / 500);
  const along = meanStep(xs, tolerance); // chair to chair, within a row
  const across = meanStep(ys, tolerance); // row to row

  // Draw to the TIGHTER spacing: a chair sized off the looser axis would touch
  // its neighbour on the other one.
  const pitch = along > 0 && across > 0 ? Math.min(along, across) : along || across || 1;

  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;
  // Back out of the section's own frame onto the canvas.
  const place = (x, y) => rotateUnits(x, y, cx, cy, rotation);

  let boundsMinX = Infinity;
  let boundsMaxX = -Infinity;
  let boundsMinY = Infinity;
  let boundsMaxY = -Infinity;

  const placed = local.map(({ seat, x, y }) => {
    const p = place(x, y);
    if (p.x < boundsMinX) boundsMinX = p.x;
    if (p.x > boundsMaxX) boundsMaxX = p.x;
    if (p.y < boundsMinY) boundsMinY = p.y;
    if (p.y > boundsMaxY) boundsMaxY = p.y;
    return { ...seat, gx: round4(p.x / ar), gy: round4(p.y) };
  });

  // One anchor per row, parked a chair outside the row's first seat — measured
  // in the section's own frame, so a turned block's labels sit at the ends of
  // its rows rather than all down one side of the screen.
  const firstInRow = new Map();
  for (const p of local) {
    const current = firstInRow.get(p.seat.rowLabel);
    if (!current || p.x < current.x) firstInRow.set(p.seat.rowLabel, { ...p, label: p.seat.rowLabel });
  }
  const rows = [...firstInRow.values()].map((anchor) => {
    const p = rotateUnits(anchor.x - pitch, anchor.y, cx, cy, rotation);
    return { label: anchor.label, x: round4(p.x / ar), y: round4(p.y) };
  });

  const pad = pitch * BOUNDS_PAD;
  // The block as it faces: sized in the section's own frame, then its centre
  // put back on screen. CSS rotates about an element's centre, so a matching
  // rotate() on this rect lands exactly on the chairs inside it.
  const frameW = maxX - minX + pad * 2;
  const frameH = maxY - minY + pad * 2;
  const centre = place(midX, midY);

  return {
    seats: placed,
    rows,
    pitch,
    frame: {
      x: round4((centre.x - frameW / 2) / ar),
      y: round4(centre.y - frameH / 2),
      width: round4(frameW / ar),
      height: round4(frameH),
      rotation: round4(((rotation % 360) + 360) % 360),
    },
    bounds: {
      x: round4((boundsMinX - pad) / ar),
      y: round4(boundsMinY - pad),
      width: round4((boundsMaxX - boundsMinX + pad * 2) / ar),
      height: round4(boundsMaxY - boundsMinY + pad * 2),
    },
  };
}

export default sectionSeatGrid;
