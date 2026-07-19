import { NextResponse } from "next/server";

import { geocode, configuredProviders } from "@/lib/housing/providers";
import { dedupeResults } from "@/lib/housing/normalize";

// GET /api/housing/search?q=&near=lat,lng&radius=&type=
// Resolves a search centre (explicit `near`, else geocodes `q`), queries the
// configured providers (OpenStreetMap) for accommodation or travel gateways,
// and returns one deduped, nearest-first result set. A provider that errors is
// skipped, not fatal.
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
    console.error(`[housing.search] ${providers[i].id}`, s.reason?.message || s.reason);
    return [];
  });

  const results = dedupeResults(lists.flat()).slice(0, 60);
  return NextResponse.json({ center, label, count: results.length, results });
}
