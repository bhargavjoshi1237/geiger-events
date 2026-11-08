"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { useTheme } from "next-themes";

import { MapZoomControls } from "@/components/internal/screens/events/event_map";
import { loadMapKit } from "@/lib/map/basemap";

// Discover-tab results map on the shared key-less basemap (lib/map/basemap) + MapZoomControls; Leaflet loads lazily so SSR never touches window.
// Optional: `focus` ({ id, n }) pans to a result when `n` changes; `onUserMove(center, radiusM)` fires after the user pans or zooms.

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

export default function VenueMap({ center, results = [], activeId, onSelect, focus, onUserMove }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const LRef = useRef(null);
  const layerRef = useRef(null);
  const markersRef = useRef(null);
  const basemapRef = useRef(null);
  const mountRef = useRef(null);
  const onSelectRef = useRef(onSelect);
  const onUserMoveRef = useRef(onUserMove);
  // Set by a pointer/wheel/key on the map so only the user's own moves report back, not fitBounds.
  const userMoveRef = useRef(false);
  const [ready, setReady] = useState(false);
  const { resolvedTheme } = useTheme();
  const scheme = resolvedTheme === "light" ? "light" : "dark";

  useEffect(() => {
    onSelectRef.current = onSelect;
    onUserMoveRef.current = onUserMove;
  }, [onSelect, onUserMove]);

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
      const m = L.marker([r.lat, r.lng], { icon: pinIcon(L, false) });
      m.on("click", () => onSelectRef.current?.(r.id));
      m.bindTooltip(r.name, { direction: "top", offset: [0, -8] });
      m.addTo(layer);
      markers.set(r.id, m);
      pts.push([r.lat, r.lng]);
    }
    markersRef.current = markers;
    userMoveRef.current = false;
    if (pts.length) map.fitBounds(pts, { padding: [40, 40], maxZoom: 15 });
    else if (center) map.setView([center.lat, center.lng], 13);
    setTimeout(() => mapRef.current && mapRef.current.invalidateSize(), 0);
  }, [results, center]);

  // Init once.
  useEffect(() => {
    let cancelled = false;
    const el = elRef.current;
    const markUser = () => {
      userMoveRef.current = true;
    };
    (async () => {
      const { L, mountBasemap } = await loadMapKit();
      if (cancelled || !elRef.current || mapRef.current) return;
      LRef.current = L;
      mountRef.current = mountBasemap;
      const map = L.map(elRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).setView([20, 0], 2);
      map.on("moveend", () => {
        if (!userMoveRef.current) return;
        userMoveRef.current = false;
        const c = map.getCenter();
        const radius = Math.round(c.distanceTo(map.getBounds().getNorthEast()));
        onUserMoveRef.current?.({ lat: c.lat, lng: c.lng }, radius);
      });
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      if (!cancelled) setReady(true);
    })();
    el?.addEventListener("pointerdown", markUser);
    el?.addEventListener("wheel", markUser, { passive: true });
    el?.addEventListener("keydown", markUser);
    return () => {
      cancelled = true;
      el?.removeEventListener("pointerdown", markUser);
      el?.removeEventListener("wheel", markUser);
      el?.removeEventListener("keydown", markUser);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markersRef.current = null;
        basemapRef.current = null;
      }
    };
  }, []);

  // Base tiles follow the app theme.
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;
    elRef.current?.classList.toggle("ev-map-light", scheme === "light");
    if (basemapRef.current) basemapRef.current.setScheme(scheme);
    else basemapRef.current = mountRef.current(map, scheme);
  }, [ready, scheme]);

  useEffect(() => {
    if (ready) draw();
  }, [ready, draw]);

  useEffect(() => {
    if (ready) highlight();
  }, [ready, highlight, results]);

  // Pan to a result picked from the list, zooming in only if the map is still zoomed out.
  useEffect(() => {
    const map = mapRef.current;
    const r = focus ? results.find((x) => x.id === focus.id) : null;
    if (!ready || !map || !r || r.lat == null) return;
    userMoveRef.current = false;
    map.setView([r.lat, r.lng], Math.max(map.getZoom(), 15), { animate: true });
    // Only `focus.n` re-pans; `results` changing alone must not yank the view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, focus?.n]);

  const zoom = (dir) => {
    userMoveRef.current = true;
    if (dir > 0) mapRef.current?.zoomIn();
    else mapRef.current?.zoomOut();
  };

  return (
    // `isolate` keeps Leaflet's z-200..1000 panes inside this box instead of
    // letting them compete at the document root and paint over a dialog.
    <div className="relative isolate h-full w-full">
      <div
        ref={elRef}
        className="absolute inset-0 [&_.leaflet-container]:bg-surface-card"
      />
      <MapZoomControls onZoomIn={() => zoom(1)} onZoomOut={() => zoom(-1)} />
    </div>
  );
}
