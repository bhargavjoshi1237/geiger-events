"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { passAtlasCanvas, ribbonTileCanvas } from "@/lib/passes/textures";

// Rasterizing a design is a few milliseconds of SVG decode, so an edit that
// arrives on every keystroke waits for the typing to stop before rebuilding.
const REBUILD_DELAY = 240;

// glTF UVs put their origin at the top-left, and the card mesh's were measured
// in that space — so the canvas must be sampled unflipped, exactly as
// GLTFLoader does with the model's own textures.
function toTexture(canvas) {
  if (!canvas) return null;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.anisotropy = 8;
  return texture;
}

// The card's texture — one atlas holding both faces — rebuilt (debounced)
// whenever the design or the previewed attendee changes.
export function usePassTexture({ template, event, attendee, qrSettings }) {
  const [texture, setTexture] = useState(null);
  // Textures are GPU resources React won't collect for us, so the live one is
  // tracked outside state and released as soon as it is replaced.
  const live = useRef(null);

  // The whole design decides the artwork, so the effect keys on its serialized
  // form rather than an identity that changes on every parent render.
  const signature = useMemo(
    () =>
      JSON.stringify({
        template,
        event: { name: event?.name, date: event?.date, venue: event?.venue },
        attendee,
        qrSettings,
      }),
    [template, event?.name, event?.date, event?.venue, attendee, qrSettings],
  );

  useEffect(() => {
    if (!template) return undefined;
    let alive = true;
    const timer = setTimeout(async () => {
      const canvas = await passAtlasCanvas(template, {
        event: event || {},
        attendee: attendee || {},
        qrSettings: qrSettings || {},
      });
      const next = toTexture(canvas);
      // A design edited again while this render was in flight has already
      // scheduled the next build — drop this one rather than flashing it in.
      if (!alive) {
        next?.dispose();
        return;
      }
      const previous = live.current;
      live.current = next;
      setTexture(next);
      previous?.dispose();
    }, REBUILD_DELAY);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // `signature` covers every input the artwork depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  // Release whatever is still on the GPU when the showcase unmounts.
  useEffect(() => () => live.current?.dispose(), []);

  return texture;
}

// The lanyard strap: the Geiger mark in white on black, tiled along the band.
// It never varies with the design, so it is built once per showcase.
export function useRibbonTexture() {
  const texture = useMemo(() => {
    const built = new THREE.CanvasTexture(ribbonTileCanvas());
    built.colorSpace = THREE.SRGBColorSpace;
    built.wrapS = THREE.RepeatWrapping;
    built.wrapT = THREE.RepeatWrapping;
    built.anisotropy = 8;
    return built;
  }, []);

  useEffect(() => () => texture.dispose(), [texture]);

  return texture;
}
