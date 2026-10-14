"use client";

import "maplibre-gl/dist/maplibre-gl.css";

// Key-less vector basemap (OpenFreeMap) rendered inside Leaflet via the MapLibre GL bridge; the single place to swap providers.
const STYLES = {
  dark: "https://tiles.openfreemap.org/styles/dark",
  light: "https://tiles.openfreemap.org/styles/positron",
};

// OpenFreeMap's terms require this attribution on every map.
const ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener noreferrer">OpenMapTiles</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>';

// Loads Leaflet + the GL bridge client-side; mount(map, scheme) is sync so callers can bail on unmount before touching the map.
export async function loadMapKit() {
  const [{ default: L }, { maplibreGL }] = await Promise.all([
    import("leaflet"),
    import("@maplibre/maplibre-gl-leaflet"),
  ]);

  const mountBasemap = (map, scheme = "dark") => {
    let current = STYLES[scheme] ? scheme : "dark";
    const layer = maplibreGL({ style: STYLES[current], attribution: ATTRIBUTION });
    L.control.attribution({ position: "bottomleft", prefix: false }).addTo(map);
    layer.addTo(map);
    return {
      setScheme(next) {
        if (!STYLES[next] || next === current) return;
        current = next;
        layer.getMaplibreMap()?.setStyle(STYLES[next]);
      },
    };
  };

  return { L, mountBasemap };
}
