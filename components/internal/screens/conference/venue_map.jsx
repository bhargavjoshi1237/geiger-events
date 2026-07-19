"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

import { MapZoomControls } from "@/components/internal/screens/events/event_map";

// Results map for the Discover tab. Built on the same dark, key-less base as the
// suite's venue location map (EventMap) — CARTO "dark_all" tiles + the shared
// MapZoomControls — so it feels native. Vanilla Leaflet is loaded lazily inside
// the effect so it never touches `window` during SSR (mounted via next/dynamic
// { ssr: false }). Each result is a divIcon pin; the active card highlights its
// pin and clicking a pin selects the card.

// A round pin matching EventMap's venue marker; emerald + larger when active.
function pinIcon(L, active) {
  const size = active ? 20 : 16;
  const bg = active ? "#34d399" : "#ededed";
  const ring = active ? "#34d399" : "#ededed";
  return L.divIcon({
    className: "",
    html: `<span style="display:block;height:${size}px;width:${size}px;border-radius:9999px;background:${bg};border:3px solid #161616;box-shadow:0 0 0 2px ${ring}"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export default function VenueMap({ center, results = [], activeId, onSelect }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const LRef = useRef(null);
  const layerRef = useRef(null);
  const markersRef = useRef(null);
  const onSelectRef = useRef(onSelect);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  const highlight = useCallback(() => {
    const markers = markersRef.current;
    const L = LRef.current;
    if (!markers || !L) return;
    for (const [markerId, m] of markers) {
      m.setIcon(pinIcon(L, markerId === activeId));
      if (markerId === activeId) m.setZIndexOffset(1000);
      else m.setZIndexOffset(0);
    }
  }, [activeId]);

  const draw = useCallback(() => {
    const L = LRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!L || !map || !layer) return;
    layer.clearLayers();
    const markers = new Map();
    const pts = [];
    for (const r of results) {
      if (r.lat == null || r.lng == null) continue;
      const m = L.marker([r.lat, r.lng], { icon: pinIcon(L, r.id === activeId) });
      m.on("click", () => onSelectRef.current?.(r.id));
      m.bindTooltip(r.name, { direction: "top", offset: [0, -8] });
      m.addTo(layer);
      markers.set(r.id, m);
      pts.push([r.lat, r.lng]);
    }
    markersRef.current = markers;
    if (pts.length) map.fitBounds(pts, { padding: [40, 40], maxZoom: 15 });
    else if (center) map.setView([center.lat, center.lng], 11);
    setTimeout(() => mapRef.current && mapRef.current.invalidateSize(), 0);
  }, [results, center, activeId]);

  // Init once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !elRef.current || mapRef.current) return;
      LRef.current = L;
      const map = L.map(elRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).setView([20, 0], 2);
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        { subdomains: "abcd", maxZoom: 19 },
      ).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markersRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (ready) draw();
  }, [ready, draw]);

  useEffect(() => {
    if (ready) highlight();
  }, [ready, highlight]);

  return (
    <div className="relative h-full w-full">
      <div
        ref={elRef}
        className="absolute inset-0 [&_.leaflet-container]:bg-surface-card"
      />
      <MapZoomControls
        onZoomIn={() => mapRef.current?.zoomIn()}
        onZoomOut={() => mapRef.current?.zoomOut()}
      />
    </div>
  );
}
