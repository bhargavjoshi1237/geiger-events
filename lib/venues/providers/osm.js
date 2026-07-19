// OpenStreetMap provider — the always-on backbone (no API key). Uses Nominatim
// to turn a place query into a centre point, and Overpass to pull named venues
// (by amenity/leisure/tourism tags) around that point. Public endpoints ask for
// a descriptive User-Agent, which we set on every call.

import { makeResult, venueType } from "../normalize";

export const id = "osm";
export const label = "OpenStreetMap";

// OSM needs no credentials, so it is always available.
export function isConfigured() {
  return true;
}

const UA = "GeigerEvents/1.0 (venue-sourcing; +https://geiger.events)";
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const OVERPASS = "https://overpass-api.de/api/interpreter";

// Geocode free text -> { lat, lng, label, city, country }. Shared by the search
// route to resolve the centre before fanning out to every provider.
export async function geocode(query) {
  if (!query) return null;
  const url = `${NOMINATIM}?q=${encodeURIComponent(query)}&format=jsonv2&limit=1&addressdetails=1`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) return null;
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

// Build the Overpass filter block from a venue-type tag spec.
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

export async function search({ lat, lng, radius, type }) {
  const spec = venueType(type).osm;
  const q = `[out:json][timeout:25];\n(\n${filterBlock(spec, radius, lat, lng)}\n);\nout center 40;`;
  const res = await fetch(OVERPASS, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA },
    body: `data=${encodeURIComponent(q)}`,
  });
  if (!res.ok) throw new Error(`overpass ${res.status}`);
  const json = await res.json().catch(() => ({}));
  const els = Array.isArray(json.elements) ? json.elements : [];
  return els
    .map((el) => {
      const tags = el.tags || {};
      const pos = el.type === "node" ? el : el.center || {};
      return makeResult({
        source: id,
        sourceId: `${el.type}/${el.id}`,
        name: tags.name,
        category: tags.amenity || tags.leisure || tags.tourism || tags.building || "Venue",
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
