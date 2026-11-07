// Room setup styles a venue space records a capacity for (venue_spaces.capacities keys).
export const SETUP_STYLES = [
  { key: "theatre", label: "Theatre" },
  { key: "classroom", label: "Classroom" },
  { key: "banquet", label: "Banquet" },
  { key: "cabaret", label: "Cabaret" },
  { key: "reception", label: "Reception" },
  { key: "boardroom", label: "Boardroom" },
  { key: "u_shape", label: "U-shape" },
  { key: "hollow_square", label: "Hollow square" },
];

const LABELS = Object.fromEntries(SETUP_STYLES.map((s) => [s.key, s.label]));

export function setupStyleLabel(key) {
  return LABELS[key] || (key ? String(key).replace(/_/g, " ") : "");
}

// The space's capacity for a style, or its largest recorded capacity when no style is given.
export function capacityFor(space, style) {
  const caps = space?.capacities && typeof space.capacities === "object" ? space.capacities : {};
  if (style) return Number(caps[style]) || 0;
  return Math.max(0, ...SETUP_STYLES.map((s) => Number(caps[s.key]) || 0));
}

export const BOOKING_CURRENCIES = ["GBP", "USD", "EUR", "AUD", "CAD", "NZD", "CHF", "AED", "SGD", "INR", "JPY", "ZAR"];
