"use client";

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

function leadKind(r) {
  if (r.group !== "stay") return "Transport";
  return /apartment|chalet/i.test(r.kind) ? "Apartment" : "Hotel";
}

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
