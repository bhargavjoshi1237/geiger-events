"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

import { drawImag, drawPortrait, drawTicker } from "@/lib/display/surfaces";
import { useVenue } from "./context";

// A canvas-backed texture redrawn at `fps` from inside the render loop.
export function useCanvasTexture(width, height, draw, fps = 30, { repeat = false } = {}) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    if (repeat) tex.wrapS = THREE.RepeatWrapping;
    return tex;
  }, [width, height, repeat]);

  // The frame loop reaches the texture through refs, never the memoised value.
  const live = useRef(null);
  const drawRef = useRef(draw);
  useEffect(() => {
    live.current = texture;
    drawRef.current = draw;
  }, [texture, draw]);

  const clock = useRef(Infinity);
  useFrame((state, dt) => {
    const tex = live.current;
    if (!tex) return;
    clock.current += dt;
    if (clock.current < 1 / fps) return;
    clock.current = 0;
    drawRef.current(tex.image.getContext("2d"), state.clock.elapsedTime);
    tex.needsUpdate = true;
  });

  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

// The board re-laid for a 9:16 kiosk.
export function usePortraitTexture() {
  const { canvas, theme, event, sessions } = useVenue();
  const draw = useMemo(
    () => (ctx) => drawPortrait(ctx, canvas, { width: 540, height: 960, theme, event, sessions }),
    [canvas, theme, event, sessions],
  );
  return useCanvasTexture(540, 960, draw, 15);
}

// Now & Next as a seamless ticker strip; scroll it by moving the sample offset.
export function useTickerTexture() {
  const { theme, event, sessions } = useVenue();
  const draw = useMemo(
    () => (ctx) => drawTicker(ctx, { width: 4096, height: 128, theme, event, sessions }),
    [theme, event, sessions],
  );
  return useCanvasTexture(4096, 128, draw, 1, { repeat: true });
}

// The stylised IMAG camera feed of whoever is on stage.
export function useImagTexture() {
  const { theme, sessions } = useVenue();
  const draw = useMemo(
    () => (ctx, t) => drawImag(ctx, { width: 432, height: 768, theme, sessions, t }),
    [theme, sessions],
  );
  return useCanvasTexture(432, 768, draw, 24);
}

// Canvas painted once, e.g. lit office windows or a court; `paint` must be stable.
export function useStaticTexture(width, height, paint) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    paint(canvas.getContext("2d"), width, height);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }, [width, height, paint]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}
