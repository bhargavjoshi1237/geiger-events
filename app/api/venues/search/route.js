import { NextResponse } from "next/server";

import { geocode, configuredProviders, MERGE_ORDER } from "@/lib/venues/providers";
import { distMeters, mergeResults } from "@/lib/venues/normalize";

const MAX_RESULTS = 60;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();
  const near = searchParams.get("near");
  const radius = Math.min(Math.max(Number(searchParams.get("radius")) || 5000, 500), 50000);
  const type = searchParams.get("type") || "all";

  let center = null;
  let label = "";
  if (near) {
    const [lat, lng] = near.split(",").map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lng)) center = { lat, lng };
  }
  if (!center && q) {
    const geo = await geocode(q);
    if (geo) {
      center = { lat: geo.lat, lng: geo.lng };
      label = geo.label;
    }
  }
  if (!center) {
    return NextResponse.json(
      {
        error: q ? `Couldn't find "${q}" — try a city, neighbourhood or full address.` : "Enter a city or area to search near.",
        results: [],
      },
      { status: 400 },
    );
  }

  const providers = configuredProviders();
  const params = { lat: center.lat, lng: center.lng, radius, type };
  const settled = await Promise.allSettled(providers.map((p) => p.search(params)));
  const lists = settled.map((s, i) => {
    if (s.status === "fulfilled") return s.value || [];
    console.error(`[venues.search] ${providers[i].id}`, s.reason?.message || s.reason);
    return [];
  });

  // Every provider failing is an outage, not an empty area — say so instead of "no venues".
  if (settled.every((s) => s.status === "rejected")) {
    return NextResponse.json(
      { error: "OpenStreetMap's venue search is busy right now — try again in a moment.", center, label, results: [] },
      { status: 502 },
    );
  }

  const results = mergeResults(lists, { order: MERGE_ORDER })
    .map((r) => ({ ...r, distanceM: Math.round(distMeters(center, r)) }))
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, MAX_RESULTS);
  return NextResponse.json({ center, label, count: results.length, results });
}
