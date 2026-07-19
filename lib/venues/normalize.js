// Canonical venue-search result shape + venue-type catalog + a merge/dedupe pass.
// Server-side (plain JS, safe to import from client too — no browser/node APIs).
// Every provider maps its rows to makeResult(); the search route merges the
// per-provider lists so the same venue from two sources collapses into one card.

// The venue kinds the Discover filter offers. `osm` is the Overpass tag spec
// (tagKey -> allowed values); `keyword` is the free-text hint passed to the
// keyed providers (Foursquare / Ticketmaster / SeatGeek) for relevance.
export const VENUE_TYPES = [
  {
    value: "all",
    label: "All Venue Types",
    keyword: "event venue",
    osm: {
      amenity: [
        "conference_centre",
        "exhibition_centre",
        "events_venue",
        "theatre",
        "arts_centre",
        "community_centre",
        "townhall",
        "restaurant",
      ],
      leisure: ["stadium", "sports_centre"],
      tourism: ["hotel"],
      building: ["stadium"],
    },
  },
  {
    value: "conference",
    label: "Conference & convention",
    keyword: "conference centre",
    osm: { amenity: ["conference_centre", "exhibition_centre", "events_venue"] },
  },
  {
    value: "hotel",
    label: "Hotel & resort",
    keyword: "hotel event space",
    osm: { tourism: ["hotel"] },
  },
  {
    value: "theatre",
    label: "Theatre & arts",
    keyword: "theatre",
    osm: { amenity: ["theatre", "arts_centre", "cinema"] },
  },
  {
    value: "stadium",
    label: "Stadium & arena",
    keyword: "stadium arena",
    osm: { leisure: ["stadium"], building: ["stadium"], amenity: ["events_venue"] },
  },
  {
    value: "community",
    label: "Community & hall",
    keyword: "event hall",
    osm: { amenity: ["community_centre", "townhall", "events_venue"] },
  },
  {
    value: "restaurant",
    label: "Restaurant & banquet",
    keyword: "banquet hall",
    osm: { amenity: ["restaurant", "events_venue"] },
  },
];

export function venueType(value) {
  return VENUE_TYPES.find((t) => t.value === value) || VENUE_TYPES[0];
}

const num = (v) =>
  v === "" || v === null || v === undefined || Number.isNaN(Number(v))
    ? null
    : Number(v);

// Normalize any provider row into the shape the screen renders directly.
export function makeResult(partial) {
  return {
    source: partial.source || "",
    sourceId: partial.sourceId != null ? String(partial.sourceId) : "",
    name: (partial.name || "").trim(),
    category: partial.category || "",
    address: partial.address || "",
    city: partial.city || "",
    country: partial.country || "",
    lat: num(partial.lat),
    lng: num(partial.lng),
    phone: partial.phone || "",
    website: partial.website || "",
    photoUrl: partial.photoUrl || "",
    rating: num(partial.rating),
    capacity: num(partial.capacity),
    url: partial.url || "",
  };
}

const normName = (s) =>
  (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Rough metre distance between two lat/lng points (haversine).
function distMeters(a, b) {
  if (a.lat == null || b.lat == null) return Infinity;
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Fill any empty field on `base` from `extra` (a lower-priority duplicate).
function fill(base, extra) {
  for (const k of [
    "category",
    "address",
    "city",
    "country",
    "phone",
    "website",
    "photoUrl",
    "url",
  ]) {
    if (!base[k] && extra[k]) base[k] = extra[k];
  }
  if (base.rating == null && extra.rating != null) base.rating = extra.rating;
  if (base.capacity == null && extra.capacity != null) base.capacity = extra.capacity;
  if (base.lat == null && extra.lat != null) {
    base.lat = extra.lat;
    base.lng = extra.lng;
  }
  if (!base.sources.includes(extra.source)) base.sources.push(extra.source);
}

// Merge per-provider result lists into one deduped list. Same name within ~150m
// collapses to a single card; the richer provider (earlier in `order`) wins the
// base row and the rest just backfill its gaps.
export function mergeResults(lists, { order = [] } = {}) {
  const rank = (s) => {
    const i = order.indexOf(s);
    return i === -1 ? order.length : i;
  };
  const all = lists.flat().filter((r) => r && r.name);
  all.sort((a, b) => rank(a.source) - rank(b.source));

  const merged = [];
  for (const r of all) {
    const dup = merged.find(
      (m) => normName(m.name) === normName(r.name) && distMeters(m, r) < 150,
    );
    if (dup) {
      fill(dup, r);
      continue;
    }
    merged.push({ ...r, sources: [r.source] });
  }
  return merged.map((m) => ({ id: `${m.source}:${m.sourceId}`, ...m }));
}
