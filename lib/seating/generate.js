// Pure seat geometry. Turns a section's layout parameters into concrete seats
// with percent-of-canvas coordinates — venue exports essentially never carry
// coordinates, so every position in the app is computed here. No DB, no React.

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// 0 -> A, 25 -> Z, 26 -> AA (spreadsheet-style, so rows never run out).
function toAlpha(index) {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = ALPHA[rem] + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

// "A" -> 0, "AA" -> 26. Unknown characters are ignored so a stray label degrades
// to row A rather than producing NaN positions.
function fromAlpha(label) {
  const clean = String(label || "A").toUpperCase().replace(/[^A-Z]/g, "");
  if (!clean) return 0;
  let n = 0;
  for (const ch of clean) n = n * 26 + (ALPHA.indexOf(ch) + 1);
  return n - 1;
}

const round2 = (n) => Math.round(n * 100) / 100;

// Row labels down a section: "alpha" (A, B, … Z, AA) or "numeric" (1, 2, 3).
export function rowLabels(count, scheme = "alpha", start = "A") {
  const total = Math.max(0, Number(count) || 0);
  const out = [];
  if (scheme === "numeric") {
    const first = Number.parseInt(start, 10) || 1;
    for (let i = 0; i < total; i += 1) out.push(String(first + i));
    return out;
  }
  const first = fromAlpha(start);
  for (let i = 0; i < total; i += 1) out.push(toAlpha(first + i));
  return out;
}

// Seat labels across a row.
//   continental — straight 1..N left to right
//   odd-even    — odds house-left descending, evens house-right ascending,
//                 i.e. numbering counts outward from the centre aisle
export function seatLabels(count, numbering = "continental") {
  const total = Math.max(0, Number(count) || 0);
  const out = [];
  if (numbering !== "odd-even") {
    for (let i = 0; i < total; i += 1) out.push(String(i + 1));
    return out;
  }
  const left = Math.ceil(total / 2);
  const right = total - left;
  for (let i = left; i >= 1; i -= 1) out.push(String(i * 2 - 1));
  for (let i = 1; i <= right; i += 1) out.push(String(i * 2));
  return out;
}

// How many chairs a section holds. GA zones carry a plain capacity and generate
// no chairs at all — they stay on the counter-based inventory path.
export function sectionSeatCount(section) {
  if (!section) return 0;
  if (section.kind === "ga") return Math.max(0, Number(section.capacity) || 0);
  const rows = Math.max(0, Number(section.layout?.rows) || 0);
  const perRow = Math.max(0, Number(section.layout?.seatsPerRow) || 0);
  return rows * perRow;
}

// Lay a section's chairs out inside its box. Rows run front (nearest the stage)
// to back; `curve` bows each row's ends away from the stage, `rake` widens the
// gap between successive rows, and `aisleAfter` inserts empty slots without
// renumbering the seats around them. Every coordinate stays inside the box.
export function generateSeats(section) {
  if (!section || section.kind === "ga") return [];

  const layout = section.layout || {};
  const rows = Math.max(0, Number(layout.rows) || 0);
  const perRow = Math.max(0, Number(layout.seatsPerRow) || 0);
  if (rows === 0 || perRow === 0) return [];

  const boxX = Number(section.x) || 0;
  const boxY = Number(section.y) || 0;
  const boxW = Math.max(0, Number(section.width) || 0);
  const boxH = Math.max(0, Number(section.height) || 0);

  const rLabels = rowLabels(rows, layout.rowLabels || "alpha", layout.rowLabelStart || "A");
  const sLabels = seatLabels(perRow, layout.numbering || "continental");

  // Aisles consume horizontal slots so the chairs either side spread apart.
  const aisles = Array.isArray(layout.aisleAfter) ? layout.aisleAfter : [];
  const slots = perRow + aisles.length;
  const slotW = boxW / Math.max(1, slots);

  // Reserve vertical room for the bow so curved rows can't escape the box.
  const curve = Math.min(90, Math.max(0, Number(layout.curve) || 0));
  const depth = (curve / 90) * boxH * 0.15;
  const usableH = Math.max(0, boxH - depth);

  // Rake spreads later rows further apart; weights are normalised so the rows
  // always fill exactly the usable height regardless of the rake value.
  const rake = Math.min(100, Math.max(0, Number(layout.rake) || 0)) / 100;
  const weights = [];
  for (let r = 0; r < rows; r += 1) {
    weights.push(1 + rake * (rows === 1 ? 0 : r / (rows - 1)));
  }
  const weightTotal = weights.reduce((a, b) => a + b, 0) || 1;

  const seats = [];
  let consumed = 0;
  for (let r = 0; r < rows; r += 1) {
    const band = (weights[r] / weightTotal) * usableH;
    const rowY = boxY + consumed + band / 2;
    consumed += band;

    for (let s = 0; s < perRow; s += 1) {
      const before = aisles.filter((a) => Number(a) <= s).length;
      const x = boxX + slotW * (s + before + 0.5);

      // Parabolic bow: centre seats sit closest to the stage.
      const u = perRow === 1 ? 0 : (s / (perRow - 1)) * 2 - 1;
      const y = rowY + depth * u * u;

      seats.push({
        rowLabel: rLabels[r],
        seatLabel: sLabels[s],
        x: round2(Math.min(boxX + boxW, Math.max(boxX, x))),
        y: round2(Math.min(boxY + boxH, Math.max(boxY, y))),
        kind: "standard",
      });
    }
  }
  return seats;
}
