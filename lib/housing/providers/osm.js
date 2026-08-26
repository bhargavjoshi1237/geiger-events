
import { makeResult, housingType, distMeters, STAY_KIND_LABEL } from "../normalize";

export const id = "osm";
export const label = "OpenStreetMap";

export function isConfigured() {
  return true;
}

const UA = "GeigerEvents/1.0 (housing-travel; +https://geiger.events)";
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const OVERPASS = "https://overpass-api.de/api/interpreter";

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

function filterBlock(spec, radius, lat, lng, requireName) {
  const around = `around:${radius},${lat},${lng}`;
  return spec
    .map(({ key, values, require = [], exclude = {} }) => {
      let line = `nwr(${around})[${key}~"^(${values.join("|")})$"]`;
      if (requireName) line += "[name]";
      for (const req of require) line += `["${req}"]`;
      for (const [k, v] of Object.entries(exclude)) line += `["${k}"!~"^(${v})$"]`;
      return `${line};`;
    })
    .join("\n");
}

function tagAddress(tags) {
  return [
    [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" "),
    tags["addr:city"],
    tags["addr:postcode"],
  ]
    .filter(Boolean)
    .join(", ");
}

function kindFor(group, tags) {
  if (group === "airport") return "Airport";
  if (group === "station") return "Rail station";
  return STAY_KIND_LABEL[tags.tourism] || "Stay";
}

export async function search({ lat, lng, radius, type }) {
  const t = housingType(type);
  const r =
    t.group === "airport"
      ? Math.max(radius, 120000)
      : t.group === "station"
        ? Math.max(radius, 20000)
        : radius;
  const q = `[out:json][timeout:25];\n(\n${filterBlock(t.osm, r, lat, lng, t.group === "stay")}\n);\nout center 300;`;
  const res = await fetch(OVERPASS, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA },
    body: `data=${encodeURIComponent(q)}`,
  });
  if (!res.ok) throw new Error(`overpass ${res.status}`);
  const json = await res.json().catch(() => ({}));
  const els = Array.isArray(json.elements) ? json.elements : [];
  const center = { lat, lng };
  return els
    .map((el) => {
      const tags = el.tags || {};
      const pos = el.type === "node" ? el : el.center || {};
      if (pos.lat == null) return null;
      return makeResult({
        source: id,
        sourceId: `${el.type}/${el.id}`,
        group: t.group,
        kind: kindFor(t.group, tags),
        name: tags.name,
        address: tagAddress(tags),
        city: tags["addr:city"] || "",
        lat: pos.lat,
        lng: pos.lon,
        phone: tags.phone || tags["contact:phone"] || "",
        website: tags.website || tags["contact:website"] || "",
        stars: tags.stars,
        iata: tags.iata || "",
        distance: distMeters(center, { lat: pos.lat, lng: pos.lon }),
        url: `https://www.openstreetmap.org/${el.type}/${el.id}`,
      });
    })
    .filter((x) => x && x.name && x.lat != null);
}
