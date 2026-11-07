// Unit handling for Event Design: everything is stored in metres, `unit` is only how a plan is displayed and typed.

export const METRES_PER_FOOT = 0.3048;
export const UNITS = ["m", "ft"];

export const normaliseUnit = (unit) => (unit === "ft" ? "ft" : "m");

const finite = (n) => (Number.isFinite(n) ? n : 0);

// A value typed in `unit` → metres.
export function toMetres(value, unit = "m") {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return normaliseUnit(unit) === "ft" ? n * METRES_PER_FOOT : n;
}

// Metres → the display unit, unrounded.
export function fromMetres(metres, unit = "m") {
  const n = finite(Number(metres));
  return normaliseUnit(unit) === "ft" ? n / METRES_PER_FOOT : n;
}

// Rounds to `decimals` and drops trailing zeros (1.50 → 1.5, 2.00 → 2).
export function roundTo(n, decimals = 2) {
  const f = 10 ** decimals;
  return Math.round(finite(n) * f) / f;
}

// Value for a number input in the display unit (e.g. 1.8288 m → 6 in ft).
export function inputValue(metres, unit = "m", decimals = 2) {
  if (metres === null || metres === undefined || metres === "") return "";
  return String(roundTo(fromMetres(metres, unit), decimals));
}

// "6 ft", "1.83 m".
export function formatLength(metres, unit = "m", { decimals } = {}) {
  const u = normaliseUnit(unit);
  const value = fromMetres(metres, u);
  const places = decimals ?? (Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : 2);
  return `${roundTo(value, places).toLocaleString()} ${u}`;
}

// "20 × 15 m".
export function formatDimensions(widthM, lengthM, unit = "m", opts) {
  const u = normaliseUnit(unit);
  const w = formatLength(widthM, u, opts).replace(` ${u}`, "");
  return `${w} × ${formatLength(lengthM, u, opts)}`;
}

// Square metres → "300 m²" / "3,229 sq ft".
export function formatArea(m2, unit = "m") {
  const n = finite(Number(m2));
  if (normaliseUnit(unit) === "ft") {
    const sqft = n / (METRES_PER_FOOT * METRES_PER_FOOT);
    return `${Math.round(sqft).toLocaleString()} sq ft`;
  }
  return `${roundTo(n, n >= 100 ? 0 : 1).toLocaleString()} m²`;
}

// Parses free text like `6ft`, `6'`, `72"`, `1.8m`, `180cm` or a bare number (read in `fallbackUnit`) → metres, or null.
export function parseLength(input, fallbackUnit = "m") {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") return Number.isFinite(input) ? toMetres(input, fallbackUnit) : null;
  const text = String(input).trim().toLowerCase().replace(/,/g, "");
  if (!text) return null;
  const feetInches = text.match(/^(-?\d+(?:\.\d+)?)\s*(?:'|ft|feet)\s*(?:(\d+(?:\.\d+)?)\s*(?:"|in|inches)?)?$/);
  if (feetInches) {
    const feet = Number(feetInches[1]);
    const inches = Number(feetInches[2] || 0);
    return (feet + inches / 12) * METRES_PER_FOOT;
  }
  const withUnit = text.match(/^(-?\d+(?:\.\d+)?)\s*(m|cm|mm|in|inches|")$/);
  if (withUnit) {
    const n = Number(withUnit[1]);
    const u = withUnit[2];
    if (u === "m") return n;
    if (u === "cm") return n / 100;
    if (u === "mm") return n / 1000;
    return (n / 12) * METRES_PER_FOOT;
  }
  const bare = Number(text);
  return Number.isFinite(bare) ? toMetres(bare, fallbackUnit) : null;
}

// Default grid step for a unit, in metres: 0.5 m or 1 ft.
export const gridStepFor = (unit) => (normaliseUnit(unit) === "ft" ? METRES_PER_FOOT : 0.5);

// Arrow-key nudge in metres: fine (10 cm / 3 in) and coarse (one grid step).
export function nudgeStepFor(unit, coarse = false) {
  if (coarse) return gridStepFor(unit);
  return normaliseUnit(unit) === "ft" ? METRES_PER_FOOT / 4 : 0.1;
}

// A round scale-bar length (1, 2, 5, 10… in the display unit) whose on-screen width is near `targetPx`; returns metres + label.
export function niceScaleLength(pxPerMetre, unit = "m", targetPx = 110) {
  const u = normaliseUnit(unit);
  const pxPerUnit = u === "ft" ? pxPerMetre * METRES_PER_FOOT : pxPerMetre;
  if (!(pxPerUnit > 0)) return { metres: 1, units: 1, label: `1 ${u}` };
  const raw = targetPx / pxPerUnit;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const steps = [1, 2, 5, 10];
  let units = pow;
  for (const s of steps) {
    if (s * pow <= raw) units = s * pow;
  }
  units = roundTo(units, 4);
  return { metres: toMetres(units, u), units, label: `${units.toLocaleString()} ${u}` };
}
