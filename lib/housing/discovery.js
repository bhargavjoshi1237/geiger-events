"use client";

// Client-side entry point for Housing & Travel discovery. Thin wrapper over the
// search route (keeps CORS/rate-limit server-side) plus the helper that turns a
// discovered result into a `housing` conference record for the pipeline. Pure:
// returns an { ok, results } bag; the screen owns toasts and optimistic state.

import { HOUSING_TYPES } from "./normalize";

export { HOUSING_TYPES };

export async function searchHousing({ q, near, radius, type } = {}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (near) params.set("near", near);
  if (radius) params.set("radius", String(radius));
  if (type && type !== "all") params.set("type", type);
  try {
    const res = await fetch(`/api/housing/search?${params.toString()}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data.error || "Search failed.", results: [] };
    }
    return {
      ok: true,
      center: data.center || null,
      label: data.label || "",
      results: Array.isArray(data.results) ? data.results : [],
    };
  } catch (e) {
    console.error("[housing.search]", e);
    return { ok: false, error: "Couldn't reach the housing search service.", results: [] };
  }
}

// Map a discovered result's group -> the housing module's `kind` enum
// (Hotel / Apartment / Transport).
function leadKind(r) {
  if (r.group !== "stay") return "Transport";
  return /apartment|chalet/i.test(r.kind) ? "Apartment" : "Hotel";
}

// A discovered result -> a housing record ({ name, status, config }). Extra keys
// (geo, source, rating…) ride in the config jsonb bag; the pipeline detail reads
// the ones it knows and ignores the rest.
export function housingResultToLead(r) {
  const notes = [
    r.kind,
    r.iata ? `IATA ${r.iata}` : "",
    r.distance != null ? `${(r.distance / 1000).toFixed(1)} km from centre` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const rating =
    r.stars != null
      ? String(Math.round(r.stars))
      : r.rating != null
        ? String(Math.round(r.rating))
        : "";
  return {
    name: r.name || "Untitled option",
    status: "Available",
    config: {
      kind: leadKind(r),
      city: r.city || "",
      address: r.address || "",
      ratePerNight: 0,
      roomsBlocked: 0,
      roomsBooked: 0,
      bookingLink: r.website || r.url || "",
      notes,
      rating,
      latitude: r.lat ?? null,
      longitude: r.lng ?? null,
      phone: r.phone || "",
      website: r.website || "",
      source: r.source || "",
      sourceId: r.sourceId || "",
      photoUrl: r.photoUrl || "",
    },
  };
}
