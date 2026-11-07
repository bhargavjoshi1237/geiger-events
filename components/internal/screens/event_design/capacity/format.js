import { METRES_PER_FOOT, roundTo } from "@/lib/event_design";

// Display helpers for planning densities (stored as m² per person).

export const SQFT_PER_M2 = 1 / (METRES_PER_FOOT * METRES_PER_FOOT);

export function formatPerPerson(m2, unit = "m") {
  if (unit === "ft") return `${roundTo(m2 * SQFT_PER_M2, 1)} sq ft`;
  return `${roundTo(m2, 2)} m²`;
}

// Density in the display unit (for inputs) and back.
export const densityToDisplay = (m2, unit) => (unit === "ft" ? roundTo(m2 * SQFT_PER_M2, 1) : roundTo(m2, 2));
export const densityFromDisplay = (value, unit) => (unit === "ft" ? Number(value) / SQFT_PER_M2 : Number(value));
