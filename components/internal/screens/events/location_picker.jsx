"use client";

import React, { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import {
  Search,
  MapPinned,
  Crosshair,
  Loader2,
  X,
  MapPin,
  Copy,
  Check,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { MapZoomControls } from "./event_map";
import { searchAddresses, reverseGeocode } from "@/lib/map/geo";

const DEFAULT_CENTER = { lat: 25, lng: 5 };
const TILE = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

const MODES = [
  { id: "search", label: "Search", icon: Search },
  { id: "pin", label: "Drop a pin", icon: MapPinned },
  { id: "coords", label: "Coordinates", icon: Crosshair },
];

// The input-method switch. Lives separately from the picker body so it can be
// hoisted up beside the section title.
export function LocationModeTabs({ mode, onModeChange, className }) {
  return (
    <div
      className={cn(
        "inline-flex rounded-lg border border-border bg-surface-subtle p-1",
        className,
      )}
    >
      {MODES.map((m) => {
        const Icon = m.icon;
        const active = mode === m.id;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onModeChange(m.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-surface-card text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

// --- Interactive map ---------------------------------------------------------
// Created once; the marker is moved imperatively when `coords` changes, so a
// click or drag never tears down and rebuilds the whole map.
function PickerMap({ coords, onPick }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const LRef = useRef(null);
  // Flips true once the (async) map build finishes, so the marker effect
  // re-runs and drops the pin even when coords were already set at mount.
  const [ready, setReady] = useState(false);
  const onPickRef = useRef(onPick);
  useEffect(() => {
    onPickRef.current = onPick;
  });

  // Build the map a single time.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !elRef.current || mapRef.current) return;
      LRef.current = L;
      const start = coords || DEFAULT_CENTER;
      const map = L.map(elRef.current, {
        zoomControl: false,
        scrollWheelZoom: false,
        attributionControl: false,
      }).setView([start.lat, start.lng], coords ? 15 : 3);
      L.tileLayer(TILE, { subdomains: "abcd", maxZoom: 19 }).addTo(map);
      map.on("click", (e) =>
        onPickRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }),
      );
      mapRef.current = map;
      setReady(true);
      setTimeout(() => mapRef.current && mapRef.current.invalidateSize(), 0);
    })();
    return () => {
      cancelled = true;
      setReady(false);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
    // Build once — `coords` only seeds the initial view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Move the marker (and recentre) whenever coords change — or once the map is
  // ready, so a pre-set location shows its pin without waiting for a coord edit.
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map || !ready) return;
    if (!coords) {
      if (markerRef.current) {
        map.removeLayer(markerRef.current);
        markerRef.current = null;
      }
      return;
    }
    const target = [coords.lat, coords.lng];
    if (!markerRef.current) {
      const icon = L.divIcon({
        className: "",
        html: `<span style="display:flex;height:18px;width:18px;border-radius:9999px;background:#ededed;border:3px solid #161616;box-shadow:0 0 0 2px #ededed"></span>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      const marker = L.marker(target, { icon, draggable: true }).addTo(map);
      marker.on("dragend", () => {
        const ll = marker.getLatLng();
        onPickRef.current?.({ lat: ll.lat, lng: ll.lng });
      });
      markerRef.current = marker;
      // First placement — fly in from wherever the map was (world → venue).
      map.flyTo(target, Math.max(map.getZoom(), 15), { duration: 1.1 });
    } else {
      markerRef.current.setLatLng(target);
      // Big jump (search / coords) flies + zooms in; a small pin-drag just pans.
      const far = map.distance(map.getCenter(), coords) > 500;
      if (far) map.flyTo(target, Math.max(map.getZoom(), 15), { duration: 1.1 });
      else map.panTo(target);
    }
    // Primitive deps — we react to the lat/lng values, not the object identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, coords?.lat, coords?.lng]);

  return (
    <div className="relative h-full min-h-72 overflow-hidden rounded-xl border border-border bg-surface-card">
      <div
        ref={elRef}
        className="absolute inset-0 [&_.leaflet-container]:cursor-crosshair [&_.leaflet-container]:bg-surface-card"
      />
      <MapZoomControls
        onZoomIn={() => mapRef.current?.zoomIn()}
        onZoomOut={() => mapRef.current?.zoomOut()}
      />
      <div className="pointer-events-none absolute left-3 top-3 z-[500] flex items-center gap-1.5 rounded-md border border-border bg-background/80 px-2.5 py-1 text-xs text-muted-foreground backdrop-blur">
        <MapPin className="h-3.5 w-3.5" />
        {coords ? "Drag the pin to fine-tune" : "Click the map to drop a pin"}
      </div>
    </div>
  );
}

// --- Address search ----------------------------------------------------------
function AddressSearch({ address, onPick, onAddressChange }) {
  const [query, setQuery] = useState(address || "");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef(null);
  const boxRef = useRef(null);

  // Re-sync the field when the address is set elsewhere (pin drop / coords).
  const [seed, setSeed] = useState(address);
  if (address !== seed) {
    setSeed(address);
    setQuery(address || "");
  }

  // Close the dropdown on an outside click.
  useEffect(() => {
    const onDocClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const runSearch = (q) => {
    if (timer.current) clearTimeout(timer.current);
    if (!q || q.trim().length < 3) {
      setResults([]);
      setLoading(false);
      setOpen(false);
      return;
    }
    setLoading(true);
    setOpen(true);
    timer.current = setTimeout(async () => {
      const r = await searchAddresses(q);
      setResults(r);
      setLoading(false);
    }, 350);
  };

  const clear = () => {
    setQuery("");
    onAddressChange?.("");
    setResults([]);
    setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-text-secondary" />
        <Input
          value={query}
          spellCheck={false}
          onChange={(e) => {
            setQuery(e.target.value);
            onAddressChange?.(e.target.value);
            runSearch(e.target.value);
          }}
          onFocus={() => results.length && setOpen(true)}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          placeholder="Search for a venue or address…"
          className="!pl-9 !pr-9"
        />
        {loading ? (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-text-secondary" />
        ) : query ? (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="absolute z-[1000] mt-1.5 w-full overflow-hidden rounded-lg border border-border bg-surface-subtle shadow-2xl">
          {loading && !results.length ? (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-text-secondary">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
            </div>
          ) : results.length ? (
            <ul className="max-h-64 overflow-y-auto py-1">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick(r);
                      setQuery(r.label);
                      setSeed(r.label);
                      setOpen(false);
                    }}
                    className="flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors hover:bg-surface-hover"
                  >
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary" />
                    <span className="text-sm leading-snug text-foreground">
                      {r.label}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-3 py-3 text-sm text-text-secondary">
              No matches. Try a fuller address.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

// --- Manual coordinates ------------------------------------------------------
function CoordsInput({ coords, onChange }) {
  const [lat, setLat] = useState(coords ? String(coords.lat) : "");
  const [lng, setLng] = useState(coords ? String(coords.lng) : "");

  // Reseed only on an external change (not echoes of what we just typed).
  const incoming = coords ? `${coords.lat},${coords.lng}` : "";
  const [seedKey, setSeedKey] = useState(incoming);
  if (incoming !== seedKey && incoming !== `${parseFloat(lat)},${parseFloat(lng)}`) {
    setSeedKey(incoming);
    setLat(coords ? String(coords.lat) : "");
    setLng(coords ? String(coords.lng) : "");
  }

  const apply = (nlat, nlng) => {
    const la = parseFloat(nlat);
    const lo = parseFloat(nlng);
    if (
      Number.isFinite(la) &&
      Number.isFinite(lo) &&
      la >= -90 &&
      la <= 90 &&
      lo >= -180 &&
      lo <= 180
    ) {
      onChange({ lat: la, lng: lo });
    }
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-text-secondary">
          Latitude
        </label>
        <Input
          type="number"
          inputMode="decimal"
          value={lat}
          placeholder="51.5074"
          className="tabular-nums"
          onChange={(e) => {
            setLat(e.target.value);
            apply(e.target.value, lng);
          }}
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-text-secondary">
          Longitude
        </label>
        <Input
          type="number"
          inputMode="decimal"
          value={lng}
          placeholder="-0.1278"
          className="tabular-nums"
          onChange={(e) => {
            
            setLng(e.target.value);
            apply(lat, e.target.value);
          }}
        />
      </div>
    </div>
  );
}

// --- Selected location panel -------------------------------------------------
function SelectedLocationPanel({ address, coords }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    if (!coords || typeof navigator === "undefined" || !navigator.clipboard)
      return;
    navigator.clipboard
      .writeText(`${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
  };

  return (
    <aside className="flex flex-col gap-3 rounded-xl border border-border bg-surface-subtle p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
        Selected location
      </p>
      {coords ? (
        <div className="flex flex-col gap-2 h-full">
          <div>
            <p className="break-words text-sm font-medium text-foreground">
              {address || "Address not set"}
            </p>
          </div>
          <div className="flex flex-col items-center justify-between h-full py-2">
            <div className="flex w-full items-center gap-2">
              <span className="text-xs tabular-nums text-text-secondary">
                {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
              </span>
              <button
                type="button"
                onClick={copy}
                aria-label="Copy coordinates"
                className="shrink-0 text-text-secondary transition-colors hover:text-foreground ml-auto mr-4"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-zinc-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>           
             <p className="text-xs text-text-secondary">
              Drag the pin to adjust, or switch tabs to change how you set the
              location.
            </p>
          </div>

        </div>
      ) : (
        <p className="text-sm text-text-secondary">
          No location set yet — search an address, drop a pin on the map, or
          enter coordinates.
        </p>
      )}
    </aside>
  );
}

// --- Picker ------------------------------------------------------------------
// `mode` is controlled by the parent (the tabs are hoisted next to the section
// title via `LocationModeTabs`). `onChange` receives a partial patch:
// `{ address?, coords? }`.
export function LocationPicker({
  mode = "search",
  address = "",
  coords = null,
  onChange,
}) {
  const emit = (patch) => onChange?.(patch);

  // A pin drop / map click sets the coords, then backfills the address.
  const handlePick = async (c) => {
    emit({ coords: c });
    const label = await reverseGeocode(c.lat, c.lng);
    if (label) emit({ address: label });
  };

  return (
    <div className="space-y-4">
      {/* Mode body — full width; the address search needs the room. */}
      {mode === "search" ? (
        <AddressSearch
          address={address}
          onAddressChange={(v) => emit({ address: v })}
          onPick={(r) =>
            emit({ address: r.label, coords: { lat: r.lat, lng: r.lng } })
          }
        />
      ) : null}

      {mode === "pin" ? (
        <p className="text-sm text-text-secondary">
          Click anywhere on the map to drop a pin, then drag it to fine-tune —
          we&apos;ll fill in the address for you.
        </p>
      ) : null}

      {mode === "coords" ? (
        <CoordsInput coords={coords} onChange={(c) => emit({ coords: c })} />
      ) : null}

      {/* Map (70%) alongside a details panel (30%). */}
      <div className="grid gap-4 lg:grid-cols-[7fr_3fr]">
        <PickerMap coords={coords} onPick={handlePick} />
        <SelectedLocationPanel address={address} coords={coords} />
      </div>
    </div>
  );
}

export default LocationPicker;
