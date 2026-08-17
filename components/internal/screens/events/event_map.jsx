"use client";

import React, { useEffect, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import "leaflet/dist/leaflet.css";
import {
  TramFront,
  Navigation,
  MapPin,
  Plus,
  Minus,
  Bike,
  CarTaxiFront,
  PlugZap,
  CircleParking,
  Hotel,
  Utensils,
  Coffee,
  Beer,
  ExternalLink,
  Sun,
  CloudSun,
  Cloud,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  CloudSunRain,
  CloudSnow,
  CloudLightning,
  ChevronDown,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { fetchWeather } from "@/lib/map/geo";

// Our own zoom control (Leaflet's default is hard to theme reliably). Pure UI —
// the map wires the callbacks to map.zoomIn()/zoomOut(). Shared by every map.
export function MapZoomControls({ onZoomIn, onZoomOut, className }) {
  return (
    <div
      className={cn(
        "absolute bottom-3 right-3 z-[500] flex flex-col overflow-hidden rounded-lg border border-border-strong bg-surface-card shadow-lg",
        className,
      )}
    >
      <button
        type="button"
        onClick={onZoomIn}
        aria-label="Zoom in"
        className="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
      >
        <Plus className="h-4 w-4" />
      </button>
      <div className="h-px bg-border" />
      <button
        type="button"
        onClick={onZoomOut}
        aria-label="Zoom out"
        className="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
      >
        <Minus className="h-4 w-4" />
      </button>
    </div>
  );
}

// Neutral world view used when we have neither a pinned venue nor a geocoded
// address yet — so the panel always shows a real map rather than a blank.
const DEFAULT_CENTER = { lat: 25, lng: 5 };

// CARTO's keyless, OSM-attributed basemaps, one per scheme. Which one loads is
// decided by the surface the map is sitting on, not by a prop — see detectScheme.
const TILES = {
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  light: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
};

// Perceived brightness of a CSS color, 0-255, or null if it isn't one.
//
// A computed color comes back in whatever space it was authored, and this has to
// read all of them: `rgb()` for a plain declaration, `color(srgb r g b)` — 0-1
// channels — for anything the browser resolved from a color-mix(), and
// `oklch()/lab()` for the app's own tokens. Reading only rgb() is what made a
// light brand still report as dark.
function brightnessOf(color) {
  let raw = String(color || "").trim();
  if (!raw) return null;

  const hex = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
  if (hex) {
    const full =
      hex.length === 3 ? hex.replace(/./g, (c) => c + c) : hex;
    const n = parseInt(full, 16);
    return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  }

  // The color-space keyword can itself contain a digit ("display-p3"), so drop
  // it before harvesting the channel numbers.
  raw = raw.replace(/^color\(\s*[\w-]+/i, "color(");
  const nums = (raw.match(/-?\d*\.?\d+/g) || []).map(Number);
  if (nums.length < 3) return null;

  if (/^rgba?\(/i.test(raw)) {
    return 0.299 * nums[0] + 0.587 * nums[1] + 0.114 * nums[2];
  }
  if (/^color\(/i.test(raw)) {
    return 255 * (0.299 * nums[0] + 0.587 * nums[1] + 0.114 * nums[2]);
  }
  // Perceptual lightness is the first component — 0-1 for ok*, 0-100 for lab/lch.
  if (/^okl(ch|ab)\(/i.test(raw)) return 255 * nums[0];
  if (/^l(ch|ab)\(/i.test(raw)) return 255 * (nums[0] / 100);
  return null;
}

// "light" | "dark" for the surface the map is drawn on, or null if it can't be
// read yet.
//
// A dark basemap under an imported light brand is the single loudest seam on a
// themed event page. Rather than threading the theme through every caller, the
// map reads the tokens it has already inherited: the themed page wrapper
// overrides --background for its whole subtree, so the page color the map sees
// *is* the brand's. Dashboard maps resolve to the app's dark tokens and are
// unaffected.
//
// --background is preferred over the container's own computed background because
// we author it as a plain hex, where --surface-card is a color-mix() the browser
// re-serialises into another space.
function detectScheme(el) {
  if (!el) return null;
  const cs = getComputedStyle(el);
  const y =
    brightnessOf(cs.getPropertyValue("--background")) ??
    brightnessOf(cs.backgroundColor);
  if (!Number.isFinite(y)) return null;
  return y > 140 ? "light" : "dark";
}

// Escape user-supplied strings before they go into popup innerHTML.
function escapeHtml(str) {
  return String(str ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );
}

// Key-less map built on Leaflet + CARTO raster tiles (free, OSM-attributed).
// Vanilla Leaflet is loaded dynamically inside the effect so it never touches
// `window` during SSR. Markers use divIcon/circleMarker to avoid Leaflet's
// bundler-unfriendly default marker images.
//
// Every colour it draws — basemap, pin, popup link — comes from the CSS tokens
// of whatever surface it lands on, so an imported brand re-skins the map along
// with the rest of the page instead of leaving a dark hole in a light one.
//
// The map always renders. It centres on `coords` (with a venue pin + nearby
// markers) when pinned; otherwise on `fallbackCenter` (a lightly geocoded
// address) so attendees still see the right area before auto-detect runs.
export function EventMap({
  coords,
  places = [],
  className,
  fallbackCenter = null,
  label = "Venue",
  address = "",
}) {
  const containerRef = useRef(null);
  const tileRef = useRef(null);
  const elRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef(null);
  const LRef = useRef(null);
  const [ready, setReady] = useState(false);
  // First paint is instant; a later pin move animates (Google-style fly-to).
  const initedRef = useRef(false);
  const lastCoordRef = useRef(null);
  const sigRef = useRef(null);

  // Build the map a single time — markers and camera are updated imperatively
  // below so a location change flies to the new spot instead of rebuilding.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !elRef.current || mapInstanceRef.current) return;
      LRef.current = L;
      const map = L.map(elRef.current, {
        zoomControl: false,
        scrollWheelZoom: false,
        attributionControl: false,
      }).setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], 2);
      // Pick the basemap up front — requesting the wrong set of tiles and
      // swapping them a moment later is a visible flash.
      const initial = detectScheme(containerRef.current) || "dark";
      tileRef.current = L.tileLayer(TILES[initial] || TILES.dark, {
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);
      markersRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
      setReady(true);
      setTimeout(
        () => mapInstanceRef.current && mapInstanceRef.current.invalidateSize(),
        0,
      );
    })();
    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersRef.current = null;
        tileRef.current = null;
      }
    };
  }, []);

  // Follow the surface after every commit, so a brand import can flip the page
  // from dark to light with the map already on screen. Kept imperative on
  // purpose: this measures the DOM, and routing it through state would cost a
  // render pass and paint one frame of the wrong basemap first.
  useEffect(() => {
    const el = containerRef.current;
    const next = detectScheme(el);
    if (!el || !next) return;
    el.classList.toggle("ev-map-light", next === "light");
    el.classList.toggle("ev-map-dark", next === "dark");
    tileRef.current?.setUrl(TILES[next]);
  });

  // Redraw markers and move the camera when the pin or nearby places change.
  useEffect(() => {
    const L = LRef.current;
    const map = mapInstanceRef.current;
    const layer = markersRef.current;
    if (!L || !map || !layer || !ready) return;

    const center = coords || fallbackCenter || DEFAULT_CENTER;
    const zoom = coords ? 15 : fallbackCenter ? 13 : 2;
    const valid = places.filter(
      (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng),
    );

    // Skip unrelated re-renders so a manual zoom/pan isn't reset — only redraw
    // when the pin, its label, or the nearby places actually change.
    const coordKey = coords ? `${coords.lat},${coords.lng}` : "none";
    const sig = `${coordKey}|${zoom}|${label}|${address}|${valid
      .map((p) => `${p.lat},${p.lng}`)
      .join(";")}`;
    if (sig === sigRef.current) return;
    sigRef.current = sig;

    layer.clearLayers();

    if (coords) {
      const pin = L.divIcon({
        className: "",
        // Brand fill, ringed in the page colour — the same shape as before on
        // the dark app tokens, and legible on any imported palette.
        html: `<span style="display:flex;height:18px;width:18px;border-radius:9999px;background:var(--primary);border:3px solid var(--background);box-shadow:0 0 0 2px var(--primary)"></span>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      L.marker([coords.lat, coords.lng], { icon: pin })
        .addTo(layer)
        .bindPopup(
          venuePopupHtml({ label, address, lat: coords.lat, lng: coords.lng }),
        );
      // Nearby places — one Lucide-icon marker per place, tinted by category.
      valid.forEach((p) => {
        L.marker([p.lat, p.lng], { icon: placeMarkerIcon(L, p) })
          .addTo(layer)
          .bindPopup(placePopupHtml(p));
      });
    }

    // Animate only when the location itself moved — first paint and nearby
    // places loading in settle instantly, a pin change flies.
    const moved = lastCoordRef.current !== null && lastCoordRef.current !== coordKey;
    const animate = initedRef.current && moved;
    lastCoordRef.current = coordKey;
    initedRef.current = true;

    const pts = coords
      ? [[coords.lat, coords.lng], ...valid.map((p) => [p.lat, p.lng])]
      : [];
    if (pts.length > 1) {
      const opts = { padding: [32, 32], maxZoom: 16 };
      if (animate) map.flyToBounds(pts, { ...opts, duration: 1.1 });
      else map.fitBounds(pts, opts);
    } else if (animate) {
      map.flyTo([center.lat, center.lng], zoom, { duration: 1.1 });
    } else {
      map.setView([center.lat, center.lng], zoom);
    }

    setTimeout(
      () => mapInstanceRef.current && mapInstanceRef.current.invalidateSize(),
      0,
    );
  }, [ready, coords, places, fallbackCenter, label, address]);

  return (
    <div
      ref={containerRef}
      className={cn(
        // ev-map-light / ev-map-dark are stamped on by the effect above; the
        // tile-pane treatment differs per basemap (globals.css).
        //
        // `isolate` is load-bearing: Leaflet's panes and controls run z-index
        // 200-1000, and `relative` alone doesn't open a stacking context — so
        // without it those layers compete at the document root and paint over a
        // z-50 dialog. Isolating scopes them to this box.
        "relative isolate overflow-hidden rounded-xl border border-border bg-surface-card",
        className,
      )}
    >
      <div
        ref={elRef}
        className="absolute inset-0 [&_.leaflet-container]:bg-surface-card"
      />
      <MapZoomControls
        onZoomIn={() => mapInstanceRef.current?.zoomIn()}
        onZoomOut={() => mapInstanceRef.current?.zoomOut()}
      />
      {!coords ? (
        <div className="pointer-events-none absolute right-3 top-3 z-[500] flex items-center gap-1.5 rounded-md border border-border bg-background/80 px-2.5 py-1 text-xs text-muted-foreground backdrop-blur">
          <MapPin className="h-3.5 w-3.5" />
          {fallbackCenter ? "Approximate area" : "No location set"}
        </div>
      ) : null}
    </div>
  );
}

const KIND_ICON = {
  Parking: CircleParking,
  "Car park": CircleParking,
  "Bus stop": TramFront,
  "Rail station": TramFront,
  Underground: TramFront,
  "Tram stop": TramFront,
  "Rail halt": TramFront,
  "Transit stop": TramFront,
  Transit: TramFront,
  "Bike share": Bike,
  "Bike parking": Bike,
  "Taxi rank": CarTaxiFront,
  "EV charging": PlugZap,
  Hotel: Hotel,
  Hostel: Hotel,
  "Guest house": Hotel,
  Restaurant: Utensils,
  "Fast food": Utensils,
  Café: Coffee,
  Bar: Beer,
  Pub: Beer,
};

// A `lat, lng` chip + an "open in Google Maps" link, shared by every popup so
// the layout stays consistent. Returns the inner HTML for the popup footer.
function popupFooterHtml(lat, lng, linkLabel) {
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
  const linkIcon = renderToStaticMarkup(
    <ExternalLink width={13} height={13} strokeWidth={2.25} />,
  );
  const coordsHtml = hasCoords
    ? `<span style="font-size:11px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--text-tertiary)">${lat.toFixed(
        5,
      )}, ${lng.toFixed(5)}</span>`
    : "<span></span>";
  const linkHtml = hasCoords
    ? `<a href="https://www.google.com/maps/search/?api=1&query=${lat},${lng}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:500;color:var(--ev-link, #5b9dff);text-decoration:none">${linkIcon}<span>${escapeHtml(
        linkLabel,
      )}</span></a>`
    : "";
  return `<div style="margin-top:8px;display:flex;align-items:center;justify-content:space-between;gap:10px;border-top:1px solid var(--border);padding-top:8px">${coordsHtml}${linkHtml}</div>`;
}

// Popup for the venue pin — title, address, coords, and a Maps link.
function venuePopupHtml({ label, address, lat, lng }) {
  return `
    <div style="min-width:190px">
      <div style="font-weight:600;font-size:13px;color:var(--foreground)">${escapeHtml(
        label || "Venue",
      )}</div>
      ${
        address
          ? `<div style="margin-top:2px;font-size:12px;color:var(--text-secondary)">${escapeHtml(
              address,
            )}</div>`
          : ""
      }
      ${popupFooterHtml(lat, lng, "Open in Maps")}
    </div>`;
}

// Popup for a nearby place — name, detail + walk time, coords, and a Maps link.
function placePopupHtml(p) {
  const meta = [
    p.detail || p.kind,
    Number.isFinite(p.walkMin) ? `${p.walkMin} min walk` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return `
    <div style="min-width:190px">
      <div style="font-weight:600;font-size:13px;color:var(--foreground)">${escapeHtml(
        p.name,
      )}</div>
      ${
        meta
          ? `<div style="margin-top:2px;font-size:12px;color:var(--text-secondary)">${escapeHtml(
              meta,
            )}</div>`
          : ""
      }
      ${popupFooterHtml(p.lat, p.lng, "Maps")}
    </div>`;
}

// A round divIcon carrying the place's Lucide icon, tinted by its category
// accent (currentColor drives both the ring and the icon stroke).
function placeMarkerIcon(L, place) {
  const Icon = KIND_ICON[place.kind] || MapPin;
  const svg = renderToStaticMarkup(
    <Icon width={15} height={15} strokeWidth={2.25} />,
  );
  return L.divIcon({
    className: "",
    html: `<div class="event-map-marker ${place.accentClass || ""}">${svg}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  });
}

// A compact list row for one nearby place.
function NearbyRow({ item, accentClass }) {
  const Icon = KIND_ICON[item.kind] || MapPin;
  return (
    <div className="flex items-center gap-3 py-2">
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card",
          accentClass,
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {item.name}
        </p>
        <p className="truncate text-xs text-text-secondary">
          {item.detail || item.kind}
        </p>
      </div>
      <span className="flex shrink-0 items-center gap-1 text-xs tabular-nums text-text-secondary">
        <Navigation className="h-3 w-3" />
        {item.walkMin} min
      </span>
    </div>
  );
}

// Group metadata — maps each saved map-config key to a label + accent colour.
// `EventMap` and the public page share these so the columns stay consistent.
export const GETTING_THERE_GROUPS = [
  { key: "nearbyTransit", label: "Public transport", accentClass: "text-sky-400" },
  { key: "nearbyParking", label: "Parking", accentClass: "text-amber-400" },
  { key: "nearbyBike", label: "Cycling", accentClass: "text-emerald-400" },
  { key: "nearbyTaxi", label: "Taxi", accentClass: "text-yellow-400" },
  { key: "nearbyCharging", label: "EV charging", accentClass: "text-lime-400" },
];
export const AROUND_VENUE_GROUPS = [
  { key: "nearbyHotels", label: "Hotels", accentClass: "text-violet-400" },
  { key: "nearbyFood", label: "Food & drink", accentClass: "text-orange-400" },
];

const ALL_NEARBY_GROUPS = [...GETTING_THERE_GROUPS, ...AROUND_VENUE_GROUPS];

// Flatten a saved `map` config into the point list `EventMap` plots — every
// nearby place across all categories, each tagged with its category accent so
// the marker can be tinted to match its group in the lists below.
export function flattenPlaces(mapConfig) {
  if (!mapConfig) return [];
  return ALL_NEARBY_GROUPS.flatMap((g) =>
    (mapConfig[g.key] || []).map((it) => ({
      ...it,
      accentClass: g.accentClass,
    })),
  );
}

// Build the `groups` array NearbyList expects from a saved `map` config.
export function nearbyGroups(map, meta) {
  return meta.map((m) => ({
    label: m.label,
    accentClass: m.accentClass,
    items: map?.[m.key] || [],
  }));
}

// Any non-empty group across the given metadata sets?
export function hasNearby(map, ...metas) {
  return metas.some((meta) =>
    meta.some((m) => (map?.[m.key] || []).length > 0),
  );
}

// Number of rows shown before a group collapses (when `collapse` is on).
const COLLAPSE_LIMIT = 3;

// One group column. With `collapse`, only the first `limit` rows show; the rest
// sit behind a faded "Show all" toggle that reveals them on click.
function NearbyGroup({ group, collapse, limit = COLLAPSE_LIMIT }) {
  const [expanded, setExpanded] = useState(false);
  const items = group.items;
  const cap = Math.max(1, limit);
  const hidden = collapse && items.length > cap;
  const visible = hidden && !expanded ? items.slice(0, cap) : items;
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wider text-text-secondary">
        {group.label}
      </p>
      <div className="divide-y divide-border">
        {visible.map((it) => (
          <NearbyRow
            key={`${it.name}-${it.lat}-${it.lng}`}
            item={it}
            accentClass={group.accentClass}
          />
        ))}
      </div>
      {hidden ? (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-1 flex w-full items-center justify-center gap-1 rounded-md py-1.5 text-xs font-medium text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-secondary"
        >
          {expanded
            ? "Show less"
            : `Show all ${items.length}`}
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 transition-transform",
              expanded && "rotate-180",
            )}
          />
        </button>
      ) : null}
    </div>
  );
}

// Given a set of groups headed for a 2-col grid, sink any short (< limit)
// group to the end and trim the final row to its shorter mate's height, so a
// short group in the bottom row never leaves a hole beside its partner.
function packForGrid(groups, limit) {
  const ordered = [...groups].sort(
    (a, b) => Number(a.items.length < limit) - Number(b.items.length < limit),
  );
  const lastRowStart = ordered.length - (ordered.length % 2 === 0 ? 2 : 1);
  const lastRow = ordered.slice(lastRowStart);
  const tailLimit =
    lastRow.length === 2
      ? Math.min(limit, ...lastRow.map((g) => g.items.length))
      : limit;
  return ordered.map((g, i) => ({
    group: g,
    limit: i >= lastRowStart ? tailLimit : limit,
  }));
}

export function NearbyList({ groups = [], className, collapse = false }) {
  const [expanded, setExpanded] = useState(false);
  const shown = groups.filter((g) => g.items?.length);
  if (!shown.length) return null;

  if (!collapse) {
    return (
      <div className={cn("gap-4 sm:columns-2 [&>*]:mb-4", className)}>
        {shown.map((g) => (
          <div key={g.label} className="break-inside-avoid">
            <NearbyGroup group={g} collapse={false} />
          </div>
        ))}
      </div>
    );
  }

  const visible = shown.slice(0, 2);
  const rest = shown.slice(2);

  return (
    <div className={className}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {visible.map((g) => (
          <NearbyGroup key={g.label} group={g} collapse />
        ))}
      </div>
      {rest.length ? (
        <>
          {expanded ? (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {packForGrid(rest, COLLAPSE_LIMIT).map(({ group, limit }) => (
                <NearbyGroup key={group.label} group={group} collapse limit={limit} />
              ))}
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="mt-3 flex w-full items-center justify-center gap-1 rounded-md py-1.5 text-xs font-medium text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-secondary"
          >
            {expanded ? "Show fewer categories" : `Show ${rest.length} More Categories`}
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform",
                expanded && "rotate-180",
              )}
            />
          </button>
        </>
      ) : null}
    </div>
  );
}

const WEATHER_ICON = {
  clear: Sun,
  partly: CloudSun,
  cloudy: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  showers: CloudSunRain,
  snow: CloudSnow,
  thunder: CloudLightning,
};

// Compact, keyless weather forecast for the event date (Open-Meteo). Forecasts
// are live (never persisted) and only render when the date is within range —
// renders nothing otherwise, so it's safe to drop in unconditionally.
export function WeatherCard({ coords, date, className }) {
  const [wx, setWx] = useState(null);
  const lat = coords?.lat;
  const lng = coords?.lng;
  useEffect(() => {
    // fetchWeather guards invalid coords/date (returns null), so the only
    // setState here is async — no synchronous cascade.
    let alive = true;
    fetchWeather(lat, lng, date).then((w) => alive && setWx(w));
    return () => {
      alive = false;
    };
  }, [lat, lng, date]);

  if (!wx) return null;
  const Icon = WEATHER_ICON[wx.kind] || Cloud;
  const toF = (c) => Math.round((c * 9) / 5 + 32);
  const tempsC = [wx.tMax, wx.tMin]
    .filter((t) => Number.isFinite(t))
    .map((t) => `${Math.round(t)}°`)
    .join(" - ");
  const tempsF = [wx.tMax, wx.tMin]
    .filter((t) => Number.isFinite(t))
    .map((t) => `${toF(t)}°`)
    .join(" - ");
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-subtle text-sky-300">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{wx.label}</p>
        <p className="text-xs text-text-secondary">
          Forecast for the event day
          {Number.isFinite(wx.precip) ? ` · ${wx.precip}% chance of rain` : ""}
        </p>
      </div>
      {tempsC ? (
        <div className="ml-auto shrink-0 text-right leading-tight">
          <p className="text-2xl font-semibold text-foreground">
            {tempsC}
            <span className="ml-0.5 text-sm font-medium text-text-secondary">
              C
            </span>
          </p>
          <p className="text-sm font-medium text-text-secondary">
            {tempsF}
            <span className="ml-0.5 text-xs">F</span>
          </p>
        </div>
      ) : null}
    </div>
  );
}

export default EventMap;
