"use client";

import { portalFetch } from "@/lib/portal/portal_fetch";
import { VENUE_TYPES } from "./normalize";

export { VENUE_TYPES };

export async function searchVenues({ q, near, radius, type } = {}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (near) params.set("near", near);
  if (radius) params.set("radius", String(radius));
  if (type && type !== "all") params.set("type", type);
  try {
    const res = await portalFetch(`/api/venues/search?${params.toString()}`);
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

const fold = (v) =>
  String(v || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

const coord = (v, max) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) && Math.abs(n) <= max ? n : null;
};

// The events.venues row a pipeline lead becomes on "Convert to venue".
export function leadToVenue(record) {
  const c = record?.config || {};
  return {
    name: String(record?.name || "").trim() || "Untitled venue",
    type: "Indoor",
    status: "Active",
    address: c.address || "",
    city: c.city || "",
    country: c.country || "",
    latitude: coord(c.latitude, 90),
    longitude: coord(c.longitude, 180),
    seatedCapacity: Math.max(0, Math.round(Number(c.capacity) || 0)),
    contactName: c.contactName || "",
    contactEmail: c.contactEmail || "",
    contactPhone: c.contactPhone || c.phone || "",
    website: c.website || "",
    // Only the discovery photo (an external URL) is copied, never a file the lead owns in storage.
    coverUrl: c.photoUrl || "",
  };
}

// A venue already in the book with the lead's name and city, so converting links instead of duplicating.
export function matchVenueForLead(venues, record) {
  const name = fold(record?.name);
  if (!name) return null;
  const city = fold(record?.config?.city);
  return (venues || []).find((v) => fold(v?.name) === name && fold(v?.city) === city) || null;
}
