import { humanizeCategory, makeResult, venueType } from "../normalize";

export const id = "osm";
export const label = "OpenStreetMap";

export function isConfigured() {
  return true;
}

const UA = "GeigerEvents/1.0 (venue-sourcing; +https://geiger.events)";
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
// Public Overpass instances; the main one is often busy, so each mirror joins after HEDGE_MS and the first answer wins.
const OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
const HEDGE_MS = 4000;
const OVERPASS_DEADLINE_MS = 15000;

export async function geocode(query) {
  if (!query) return null;
  const url = `${NOMINATIM}?q=${encodeURIComponent(query)}&format=jsonv2&limit=1&addressdetails=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!res?.ok) return null;
  const rows = await res.json().catch(() => []);
  const hit = Array.isArray(rows) ? rows[0] : null;
  if (!hit) return null;
  const addr = hit.address || {};
  return {
    lat: Number(hit.lat),
    lng: Number(hit.lon),
    label: hit.display_name || query,
    city: addr.city || addr.town || addr.village || addr.state || "",
    country: addr.country || "",
  };
}

function filterBlock(spec, radius, lat, lng) {
  const around = `around:${radius},${lat},${lng}`;
  const lines = [];
  for (const [key, vals] of Object.entries(spec)) {
    lines.push(`nwr(${around})[${key}~"^(${vals.join("|")})$"][name];`);
  }
  return lines.join("\n");
}

function tagAddress(tags) {
  const parts = [
    [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" "),
    tags["addr:city"],
    tags["addr:postcode"],
  ].filter(Boolean);
  return parts.join(", ");
}

const wait = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (!ms) return resolve();
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      reject(signal.reason);
    }, { once: true });
  });

async function overpass(query) {
  const ctrl = new AbortController();
  const deadline = setTimeout(() => ctrl.abort(new Error("overpass timed out")), OVERPASS_DEADLINE_MS);
  try {
    return await Promise.any(
      OVERPASS.map(async (endpoint, i) => {
        await wait(i * HEDGE_MS, ctrl.signal);
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA },
          body: `data=${encodeURIComponent(query)}`,
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`overpass ${res.status} (${endpoint})`);
        return res.json();
      }),
    );
  } catch (e) {
    throw e?.errors?.[0] || e;
  } finally {
    clearTimeout(deadline);
    // Cancels the mirrors still in flight once one has answered.
    ctrl.abort();
  }
}

export async function search({ lat, lng, radius, type }) {
  const spec = venueType(type).osm;
  const json = await overpass(`[out:json][timeout:15];\n(\n${filterBlock(spec, radius, lat, lng)}\n);\nout center 80;`);
  const els = Array.isArray(json?.elements) ? json.elements : [];
  return els
    .map((el) => {
      const tags = el.tags || {};
      const pos = el.type === "node" ? el : el.center || {};
      return makeResult({
        source: id,
        sourceId: `${el.type}/${el.id}`,
        name: tags.name,
        category: humanizeCategory(tags.amenity || tags.leisure || tags.tourism || tags.building) || "Venue",
        address: tagAddress(tags),
        city: tags["addr:city"] || "",
        lat: pos.lat,
        lng: pos.lon,
        phone: tags.phone || tags["contact:phone"] || "",
        website: tags.website || tags["contact:website"] || "",
        url: `https://www.openstreetmap.org/${el.type}/${el.id}`,
      });
    })
    .filter((r) => r.name && r.lat != null);
}
