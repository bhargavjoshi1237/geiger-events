import { NextResponse } from "next/server";

import { geocode, configuredProviders, MERGE_ORDER } from "@/lib/venues/providers";
import { mergeResults } from "@/lib/venues/normalize";

// GET /api/venues/search?q=&near=lat,lng&radius=&type=
// Resolves a search centre (explicit `near`, else geocodes `q`), queries the
// configured providers (OpenStreetMap) in parallel, and returns one merged,
// deduped result set. A provider that errors is skipped, not fatal.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();
  const near = searchParams.get("near");
  const radius = Math.min(Number(searchParams.get("radius")) || 5000, 50000);
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
      { error: "Enter a city or area to search near.", results: [] },
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

  const results = mergeResults(lists, { order: MERGE_ORDER });
  return NextResponse.json({ center, label, count: results.length, results });
}
