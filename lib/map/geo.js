"use client";


const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_REVERSE = "https://nominatim.openstreetmap.org/reverse";
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

async function overpassQuery(query) {
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: query,
      });
      if (!res.ok) continue;
      const text = await res.text();
      return JSON.parse(text);
    } catch {
    }
  }
  return null;
}

export function distanceMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

export function walkMinutes(meters) {
  return Math.max(1, Math.round(meters / 80));
}

export async function geocodeAddress(query) {
  if (!query) {
    console.warn("[geocode] empty query");
    return null;
  }
  try {
    const url = `${NOMINATIM}?format=json&limit=1&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      console.error(
        `[geocode] Nominatim HTTP ${res.status} ${res.statusText} for query "${query}"`,
      );
      return null;
    }
    const data = await res.json();
    if (!Array.isArray(data)) {
      console.error(
        `[geocode] unexpected Nominatim response for "${query}":`,
        data,
      );
      return null;
    }
    if (!data.length) {
      console.warn(`[geocode] no results for query "${query}"`);
      return null;
    }
    return {
      lat: Number(data[0].lat),
      lng: Number(data[0].lon),
      label: data[0].display_name || query,
    };
  } catch (err) {
    console.error(`[geocode] fetch failed for query "${query}":`, err);
    return null;
  }
}

export async function searchAddresses(query, limit = 6) {
  if (!query || query.trim().length < 3) return [];
  try {
    const url = `${NOMINATIM}?format=json&addressdetails=0&limit=${limit}&q=${encodeURIComponent(
      query,
    )}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data
      .map((d) => ({
        id: d.place_id,
        lat: Number(d.lat),
        lng: Number(d.lon),
        label: d.display_name || "",
      }))
      .filter((d) => Number.isFinite(d.lat) && Number.isFinite(d.lng));
  } catch {
    return [];
  }
}

export async function reverseGeocode(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  try {
    const url = `${NOMINATIM_REVERSE}?format=json&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.display_name || null;
  } catch {
    return null;
  }
}

const TRANSIT_LABEL = {
  station: "Rail station",
  subway_entrance: "Underground",
  tram_stop: "Tram stop",
  bus_stop: "Bus stop",
  halt: "Rail halt",
  stop_position: "Transit stop",
};

function classifyTransit(tags = {}) {
  if (tags.railway && TRANSIT_LABEL[tags.railway]) return TRANSIT_LABEL[tags.railway];
  if (tags.highway === "bus_stop") return TRANSIT_LABEL.bus_stop;
  if (tags.public_transport) return "Transit stop";
  return "Transit";
}

const FOOD_LABEL = {
  restaurant: "Restaurant",
  cafe: "Café",
  bar: "Bar",
  pub: "Pub",
  fast_food: "Fast food",
};

const STAY_LABEL = {
  hotel: "Hotel",
  hostel: "Hostel",
  guest_house: "Guest house",
};

function titleCase(str = "") {
  return String(str)
    .split(/[;_]/)[0]
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function detailLine(...parts) {
  const out = parts.filter(Boolean);
  return out.length ? out.join(" · ") : "";
}

function classify(tags = {}) {
  if (tags.amenity === "parking") {
    const covered =
      tags.covered === "yes" ||
      tags.parking === "multi-storey" ||
      tags.parking === "underground";
    return {
      group: "parking",
      kind: covered ? "Car park" : "Parking",
      detail: detailLine(
        tags.fee === "yes" ? "Paid" : tags.fee === "no" ? "Free" : "",
        tags.capacity ? `${tags.capacity} spaces` : "",
        covered ? "Covered" : "",
        tags.wheelchair === "yes" ? "Accessible" : "",
      ),
    };
  }
  if (
    (tags.railway && TRANSIT_LABEL[tags.railway]) ||
    tags.highway === "bus_stop" ||
    tags.public_transport === "station"
  ) {
    const lines = tags.route_ref || tags.ref;
    return {
      group: "transit",
      kind: classifyTransit(tags),
      detail: detailLine(
        lines ? `Lines ${String(lines).split(";").join(", ")}` : "",
        tags.wheelchair === "yes" ? "Step-free" : "",
      ),
    };
  }
  if (tags.amenity === "bicycle_rental") {
    return {
      group: "bike",
      kind: "Bike share",
      detail: detailLine(
        tags.capacity ? `${tags.capacity} bikes` : "Docking station",
      ),
    };
  }
  if (tags.amenity === "bicycle_parking") {
    return {
      group: "bike",
      kind: "Bike parking",
      detail: detailLine(
        tags.capacity ? `${tags.capacity} spaces` : "",
        tags.covered === "yes" ? "Covered" : "",
      ),
    };
  }
  if (tags.amenity === "taxi") {
    return { group: "taxi", kind: "Taxi rank", detail: "" };
  }
  if (tags.amenity === "charging_station") {
    return {
      group: "charging",
      kind: "EV charging",
      detail: detailLine(
        tags.capacity ? `${tags.capacity} points` : "",
        tags.fee === "no" ? "Free" : tags.fee === "yes" ? "Paid" : "",
      ),
    };
  }
  if (tags.tourism && STAY_LABEL[tags.tourism]) {
    return {
      group: "hotels",
      kind: STAY_LABEL[tags.tourism],
      detail: detailLine(tags.stars ? `${tags.stars}★` : ""),
    };
  }
  if (tags.amenity && FOOD_LABEL[tags.amenity]) {
    return {
      group: "food",
      kind: FOOD_LABEL[tags.amenity],
      detail: detailLine(tags.cuisine ? titleCase(tags.cuisine) : ""),
    };
  }
  return null;
}

function nodeCoords(el) {
  if (typeof el.lat === "number") return { lat: el.lat, lng: el.lon };
  if (el.center) return { lat: el.center.lat, lng: el.center.lon };
  return null;
}

const GROUP_CAP = {
  transit: 8,
  parking: 6,
  bike: 4,
  taxi: 3,
  charging: 4,
  hotels: 5,
  food: 6,
};
const EMPTY_NEARBY = {
  parking: [],
  transit: [],
  bike: [],
  taxi: [],
  charging: [],
  hotels: [],
  food: [],
};

export async function findNearby(lat, lng, radius = 800) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ...EMPTY_NEARBY };
  }
  const origin = { lat, lng };
  const a = `(around:${radius},${lat},${lng})`;
  const q = `[out:json][timeout:25];
nwr["amenity"="parking"]${a};
out center 30;
(
  node["railway"~"^(station|subway_entrance|tram_stop|halt)$"]${a};
  node["highway"="bus_stop"]${a};
  node["public_transport"="station"]${a};
);
out center 40;
(
  node["amenity"="bicycle_rental"]${a};
  nwr["amenity"="bicycle_parking"]${a};
);
out center 20;
node["amenity"="taxi"]${a};
out center 15;
nwr["amenity"="charging_station"]${a};
out center 20;
nwr["tourism"~"^(hotel|hostel|guest_house)$"]${a};
out center 25;
nwr["amenity"~"^(restaurant|cafe|bar|pub|fast_food)$"]${a};
out center 30;`;

  try {
    const data = await overpassQuery(q);
    if (!data) return { ...EMPTY_NEARBY };
    const groups = {
      parking: [],
      transit: [],
      bike: [],
      taxi: [],
      charging: [],
      hotels: [],
      food: [],
    };
    const seen = new Set();

    for (const el of data.elements || []) {
      const coords = nodeCoords(el);
      if (!coords) continue;
      const tags = el.tags || {};
      const c = classify(tags);
      if (!c) continue;
      const name = tags.name || c.kind || "Unnamed";
      const cell = `${coords.lat.toFixed(4)}:${coords.lng.toFixed(4)}`;
      const dedupe = `${c.group}:${name}:${c.kind}:${cell}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      const distance = distanceMeters(origin, coords);
      groups[c.group].push({
        name,
        kind: c.kind,
        detail: c.detail,
        lat: coords.lat,
        lng: coords.lng,
        distance,
        walkMin: walkMinutes(distance),
      });
    }

    const byDistance = (a, b) => a.distance - b.distance;
    for (const key of Object.keys(groups)) {
      groups[key] = groups[key].sort(byDistance).slice(0, GROUP_CAP[key] || 6);
    }
    return groups;
  } catch {
    return { ...EMPTY_NEARBY };
  }
}

export async function resolveEventLocation(address) {
  const geo = await geocodeAddress(address);
  if (!geo) return null;
  const nearby = await findNearby(geo.lat, geo.lng);
  return { coords: { lat: geo.lat, lng: geo.lng }, label: geo.label, ...nearby };
}


const STAY_KINDS = {
  hotel: "Hotel",
  hostel: "Hostel",
  guest_house: "Guest house",
  motel: "Motel",
  apartment: "Serviced apartment",
  chalet: "Chalet",
};
const STAYS_CAP = 12;

export async function findStays(lat, lng, radius = 2500) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
  const origin = { lat, lng };
  const kinds = Object.keys(STAY_KINDS).join("|");
  const q = `[out:json][timeout:25];
nwr["tourism"~"^(${kinds})$"](around:${radius},${lat},${lng});
out center 60;`;
  try {
    const data = await overpassQuery(q);
    if (!data) return [];
    const out = [];
    const seen = new Set();
    for (const el of data.elements || []) {
      const coords = nodeCoords(el);
      if (!coords) continue;
      const tags = el.tags || {};
      const kind = STAY_KINDS[tags.tourism];
      const cell = `${coords.lat.toFixed(4)}:${coords.lng.toFixed(4)}`;
      const dedupe = `${tags.name}:${cell}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      const distance = distanceMeters(origin, coords);
      out.push({
        name: tags.name,
        kind,
        detail: detailLine(
          tags.stars ? `${tags.stars}★` : "",
          tags.rooms ? `${tags.rooms} rooms` : "",
        ),
        lat: coords.lat,
        lng: coords.lng,
        distance,
        walkMin: walkMinutes(distance),
      });
    }
    return out.sort((a, b) => a.distance - b.distance).slice(0, STAYS_CAP);
  } catch {
    return [];
  }
}

const AIRPORTS_CAP = 5;
const STATIONS_CAP = 6;
const AIRPORT_FETCH = 120;
const STATION_FETCH = 400;
const EMPTY_GATEWAYS = { airports: [], stations: [] };

export async function findGateways(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { ...EMPTY_GATEWAYS };
  const origin = { lat, lng };
  const q = `[out:json][timeout:25];
nwr["aeroway"="aerodrome"]["iata"](around:${AIRPORT_RADIUS},${lat},${lng});
out center ${AIRPORT_FETCH};
nwr["railway"="station"]["station"!~"subway|light_rail|monorail"]["subway"!="yes"](around:${STATION_RADIUS},${lat},${lng});
out center ${STATION_FETCH};`;
  try {
    const data = await overpassQuery(q);
    if (!data) return { ...EMPTY_GATEWAYS };
    const airports = [];
    const stations = [];
    const seen = new Set();
    for (const el of data.elements || []) {
      const coords = nodeCoords(el);
      if (!coords) continue;
      const tags = el.tags || {};
      const isAirport = tags.aeroway === "aerodrome" && Boolean(tags.iata);
      const isStation = tags.railway === "station";
      if (!isAirport && !isStation) continue;
      const name = tags.name || tags.iata;
      if (!name) continue;
      const cell = `${coords.lat.toFixed(3)}:${coords.lng.toFixed(3)}`;
      const dedupe = `${name}:${cell}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      const distance = distanceMeters(origin, coords);
      if (isAirport) {
        airports.push({
          name,
          kind: "Airport",
          detail: detailLine(
            tags.iata,
            tags["aerodrome:type"] === "international" ? "International" : "",
          ),
          lat: coords.lat,
          lng: coords.lng,
          distance,
        });
      } else {
        stations.push({
          name,
          kind: "Rail station",
          detail: detailLine(tags.network || tags.operator || ""),
          lat: coords.lat,
          lng: coords.lng,
          distance,
        });
      }
    }
    const byDistance = (a, b) => a.distance - b.distance;
    return {
      airports: airports.sort(byDistance).slice(0, AIRPORTS_CAP),
      stations: stations.sort(byDistance).slice(0, STATIONS_CAP),
    };
  } catch {
    return { ...EMPTY_GATEWAYS };
  }
}

export async function resolveTravelOptions(address) {
  const geo = await geocodeAddress(address);
  if (!geo) return null;
  const [stays, gateways] = await Promise.all([
    findStays(geo.lat, geo.lng),
    findGateways(geo.lat, geo.lng),
  ]);
  return {
    coords: { lat: geo.lat, lng: geo.lng },
    label: geo.label,
    stays,
    ...gateways,
  };
}

const WMO_WEATHER = {
  0: { label: "Clear sky", kind: "clear" },
  1: { label: "Mainly clear", kind: "partly" },
  2: { label: "Partly cloudy", kind: "partly" },
  3: { label: "Overcast", kind: "cloudy" },
  45: { label: "Fog", kind: "fog" },
  48: { label: "Rime fog", kind: "fog" },
  51: { label: "Light drizzle", kind: "drizzle" },
  53: { label: "Drizzle", kind: "drizzle" },
  55: { label: "Heavy drizzle", kind: "drizzle" },
  56: { label: "Freezing drizzle", kind: "drizzle" },
  57: { label: "Freezing drizzle", kind: "drizzle" },
  61: { label: "Light rain", kind: "rain" },
  63: { label: "Rain", kind: "rain" },
  65: { label: "Heavy rain", kind: "rain" },
  66: { label: "Freezing rain", kind: "rain" },
  67: { label: "Freezing rain", kind: "rain" },
  71: { label: "Light snow", kind: "snow" },
  73: { label: "Snow", kind: "snow" },
  75: { label: "Heavy snow", kind: "snow" },
  77: { label: "Snow grains", kind: "snow" },
  80: { label: "Rain showers", kind: "showers" },
  81: { label: "Rain showers", kind: "showers" },
  82: { label: "Violent showers", kind: "showers" },
  85: { label: "Snow showers", kind: "snow" },
  86: { label: "Snow showers", kind: "snow" },
  95: { label: "Thunderstorm", kind: "thunder" },
  96: { label: "Thunderstorm", kind: "thunder" },
  99: { label: "Thunderstorm", kind: "thunder" },
};

export function weatherSummary(code) {
  return WMO_WEATHER[code] || { label: "Forecast", kind: "cloudy" };
}

export async function fetchWeather(lat, lng, date) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !date) return null;
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
      `&timezone=auto&start_date=${date}&end_date=${date}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const d = data?.daily;
    if (!d || !Array.isArray(d.time) || !d.time.length) return null;
    const tMax = d.temperature_2m_max?.[0];
    const tMin = d.temperature_2m_min?.[0];
    if (tMax == null && tMin == null) return null;
    return {
      tMax,
      tMin,
      precip: d.precipitation_probability_max?.[0] ?? null,
      ...weatherSummary(d.weathercode?.[0]),
    };
  } catch {
    return null;
  }
}
