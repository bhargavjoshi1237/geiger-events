
export const STAY_KIND_LABEL = {
  hotel: "Hotel",
  motel: "Motel",
  hostel: "Hostel",
  guest_house: "Guest house",
  apartment: "Serviced apartment",
  chalet: "Chalet",
};

export const HOUSING_TYPES = [
  {
    value: "all",
    label: "All Stays",
    group: "stay",
    osm: [{ key: "tourism", values: ["hotel", "hostel", "guest_house", "motel", "apartment", "chalet"] }],
  },
  {
    value: "hotel",
    label: "Hotels & Motels",
    group: "stay",
    osm: [{ key: "tourism", values: ["hotel", "motel"] }],
  },
  {
    value: "budget",
    label: "Hostels & Guesthouses",
    group: "stay",
    osm: [{ key: "tourism", values: ["hostel", "guest_house"] }],
  },
  {
    value: "apartment",
    label: "Apartments & chalets",
    group: "stay",
    osm: [{ key: "tourism", values: ["apartment", "chalet"] }],
  },
  {
    value: "airport",
    label: "Airports",
    group: "airport",
    osm: [{ key: "aeroway", values: ["aerodrome"], require: ["iata"] }],
  },
  {
    value: "station",
    label: "Rail stations",
    group: "station",
    osm: [{ key: "railway", values: ["station"], exclude: { station: "subway|light_rail|monorail", subway: "yes" } }],
  },
];

export function housingType(value) {
  return HOUSING_TYPES.find((t) => t.value === value) || HOUSING_TYPES[0];
}

const num = (v) =>
  v === "" || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v);

export function makeResult(partial) {
  return {
    source: partial.source || "osm",
    sourceId: partial.sourceId != null ? String(partial.sourceId) : "",
    name: (partial.name || "").trim(),
    address: partial.address || "",
    city: partial.city || "",
    country: partial.country || "",
    lat: num(partial.lat),
    lng: num(partial.lng),
    phone: partial.phone || "",
    website: partial.website || "",
    photoUrl: partial.photoUrl || "",
    rating: num(partial.rating),
    stars: num(partial.stars),
    iata: partial.iata || "",
    url: partial.url || "",
  };
}

const normName = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function distMeters(a, b) {
  if (a.lat == null || b.lat == null) return Infinity;
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function dedupeResults(list) {
  const out = [];
  for (const r of list) {
    if (!r || !r.name || r.lat == null) continue;
    const dup = out.find(
      (m) => normName(m.name) === normName(r.name) && distMeters(m, r) < 120,
    );
    if (dup) {
      if (!dup.website && r.website) dup.website = r.website;
      if (!dup.phone && r.phone) dup.phone = r.phone;
      if (dup.stars == null && r.stars != null) dup.stars = r.stars;
      continue;
    }
    out.push(r);
  }
  out.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
  return out.map((m) => ({ id: `${m.source}:${m.sourceId}`, ...m }));
}
