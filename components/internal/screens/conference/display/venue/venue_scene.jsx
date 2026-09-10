"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

import { BOARD_H, BOARD_W } from "@/lib/display/constants";
import { placementEntry } from "@/lib/display/placements";
import { BoardPlayer, preloadImages, resolveTheme } from "@/lib/display/renderer";
import { VenueContext } from "./context";
import { CenterHungScene, RibbonScene } from "./scenes/arena";
import { StageScene } from "./scenes/stage";
import { ConcourseScene } from "./scenes/concourse";
import { LobbyScene } from "./scenes/lobby";
import { CorridorScene } from "./scenes/corridor";
import { MarqueeScene } from "./scenes/marquee";
import { AnamorphicScene } from "./scenes/anamorphic";

// The venue simulator's WebGL half. Loaded via next/dynamic from
// ./venue_preview.jsx only — three.js must never reach the server bundle.

const SCENES = {
  center_hung: CenterHungScene,
  ribbon: RibbonScene,
  stage: StageScene,
  video_wall: ConcourseScene,
  totem: LobbyScene,
  door_sign: CorridorScene,
  marquee: MarqueeScene,
  anamorphic: AnamorphicScene,
};

// Runs the same BoardPlayer as the wall on an offscreen canvas the scenes sample.
function useBoardCanvas({ slides, event, sessions, theme, speed, onSlideChange }) {
  const [canvas] = useState(() => {
    const c = document.createElement("canvas");
    c.width = BOARD_W;
    c.height = BOARD_H;
    return c;
  });
  const [images, setImages] = useState(() => new Map());
  const player = useRef(null);

  const imageKey = JSON.stringify([
    event?.coverUrl || "",
    ...slides.filter((s) => s.type === "image").map((s) => s.config?.url || ""),
  ]);
  useEffect(() => {
    let alive = true;
    preloadImages(slides, event).then((map) => alive && setImages(map));
    return () => {
      alive = false;
    };
  }, [imageKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const p = new BoardPlayer(canvas, { slides, event, sessions, theme, speed, images, onSlideChange });
    player.current = p;
    p.start();
    return () => {
      p.stop();
      player.current = null;
    };
  }, [canvas]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    player.current?.update({ slides, event, sessions, theme, speed, images });
  }, [slides, event, sessions, theme, speed, images]);

  return canvas;
}

function VenueProvider({ canvas, theme, event, sessions, showLights, children }) {
  const boardTexture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.anisotropy = 8;
    return t;
  }, [canvas]);
  const live = useRef(null);
  useEffect(() => {
    live.current = boardTexture;
    return () => boardTexture.dispose();
  }, [boardTexture]);

  // The board animates its fades, so re-upload at 30 fps rather than every frame.
  const since = useRef(Infinity);
  useFrame((_, dt) => {
    since.current += dt;
    if (!live.current || since.current < 1 / 30) return;
    since.current = 0;
    live.current.needsUpdate = true;
  });

  const value = useMemo(
    () => ({ canvas, boardTexture, theme: resolveTheme(theme), event, sessions: sessions || [], showLights }),
    [canvas, boardTexture, theme, event, sessions, showLights],
  );
  return <VenueContext.Provider value={value}>{children}</VenueContext.Provider>;
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const UP = new THREE.Vector3(0, 1, 0);
const SWAY_RATE = 0.22;

// Orbit controls plus a camera fly-to: switching screens dollies in, switching
// viewpoint flies from wherever you are. Any drag cancels the flight.
function Rig({ placement, preset, nonce, autoRotate, sway }) {
  const camera = useThree((s) => s.camera);
  const dom = useThree((s) => s.gl.domElement);
  const controls = useRef(null);
  const flight = useRef(null);
  const lastPlacement = useRef(null);
  const swayClock = useRef(0);
  const offset = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const c = new OrbitControls(camera, dom);
    Object.assign(c, {
      enableDamping: true,
      dampingFactor: 0.08,
      rotateSpeed: 0.55,
      zoomSpeed: 0.8,
      panSpeed: 0.6,
      minDistance: 0.3,
      maxDistance: 110,
      maxPolarAngle: Math.PI * 0.8,
    });
    const cancel = () => {
      flight.current = null;
    };
    c.addEventListener("start", cancel);
    controls.current = c;
    return () => {
      c.removeEventListener("start", cancel);
      c.dispose();
      controls.current = null;
    };
  }, [camera, dom]);

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const toPos = new THREE.Vector3(...preset.position);
    const toTarget = new THREE.Vector3(...preset.target);
    const switched = lastPlacement.current !== placement;
    lastPlacement.current = placement;
    if (switched) {
      camera.position.copy(toPos).add(toPos.clone().sub(toTarget).multiplyScalar(0.25));
      c.target.copy(toTarget);
    }
    swayClock.current = 0;
    flight.current = {
      fromPos: camera.position.clone(),
      fromTarget: c.target.clone(),
      toPos,
      toTarget,
      t: 0,
    };
  }, [placement, preset, nonce, camera]);

  useFrame((state, dt) => {
    const c = controls.current;
    if (!c) return;
    const f = flight.current;
    if (f) {
      f.t = Math.min(1, f.t + dt / 1.6);
      const k = ease(f.t);
      state.camera.position.lerpVectors(f.fromPos, f.toPos, k);
      c.target.lerpVectors(f.fromTarget, f.toTarget, k);
      if (f.t >= 1) flight.current = null;
    }
    // Idle drift is a slow pan about the target, never a full orbit — a full turn
    // round an off-centre target walks the camera through walls.
    if (autoRotate && !f && !preset.hold && sway > 0) {
      swayClock.current += dt;
      const turn = sway * SWAY_RATE * Math.cos(swayClock.current * SWAY_RATE) * dt;
      offset.copy(state.camera.position).sub(c.target).applyAxisAngle(UP, turn);
      state.camera.position.copy(c.target).add(offset);
    }
    c.update(dt);
    if (state.camera.position.y < 0.3) state.camera.position.y = 0.3;
  });

  return null;
}

// LED glow: bright pixels bleed into the haze the way they do in a real room.
function Bloom() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  const composer = useMemo(() => {
    const c = new EffectComposer(gl);
    c.addPass(new RenderPass(scene, camera));
    c.addPass(new UnrealBloomPass(new THREE.Vector2(512, 512), 0.65, 0.55, 0.6));
    c.addPass(new OutputPass());
    return c;
  }, [gl, scene, camera]);

  useEffect(() => {
    composer.setPixelRatio(gl.getPixelRatio());
    composer.setSize(size.width, size.height);
  }, [composer, gl, size]);
  useEffect(() => () => composer.dispose(), [composer]);

  useFrame((_, dt) => composer.render(dt), 1);
  return null;
}

export default function VenueScene({
  slides,
  event,
  sessions,
  theme,
  speed,
  placement,
  preset,
  nonce,
  autoRotate,
  showLights,
  onSlideChange,
}) {
  const canvas = useBoardCanvas({ slides, event, sessions, theme, speed, onSlideChange });
  const Scene = SCENES[placement] || CenterHungScene;

  return (
    <Canvas
      camera={{ position: preset.position, fov: 45, near: 0.05, far: 1200 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NeutralToneMapping;
      }}
    >
      <VenueProvider canvas={canvas} theme={theme} event={event} sessions={sessions} showLights={showLights}>
        <Scene key={placement} />
      </VenueProvider>
      <Rig
        placement={placement}
        preset={preset}
        nonce={nonce}
        autoRotate={autoRotate}
        sway={preset.sway ?? placementEntry(placement).sway ?? 0.3}
      />
      <Bloom />
    </Canvas>
  );
}
