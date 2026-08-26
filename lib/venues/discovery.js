"use client";

import { VENUE_TYPES } from "./normalize";

export { VENUE_TYPES };

export async function searchVenues({ q, near, radius, type } = {}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (near) params.set("near", near);
  if (radius) params.set("radius", String(radius));
  if (type && type !== "all") params.set("type", type);
  try {
    const res = await fetch(`/api/venues/search?${params.toString()}`);
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
    console.error("[discovery.search]", e);
    return { ok: false, error: "Couldn't reach the venue search service.", results: [] };
  }
}

export function venueResultToLead(r) {
  return {
    name: r.name || "Untitled venue",
    status: "Shortlisted",
    config: {
      city: r.city || "",
      capacity: r.capacity || 0,
      quotedPrice: 0,
      contactName: "",
      contactEmail: "",
      contactPhone: r.phone || "",
      rating: r.rating != null ? String(Math.round(r.rating)) : "",
      website: r.website || "",
      address: r.address || "",
      country: r.country || "",
      latitude: r.lat ?? null,
      longitude: r.lng ?? null,
      source: r.source || "",
      sourceId: r.sourceId || "",
      photoUrl: r.photoUrl || "",
      notes: "",
    },
  };
}
