"use client";

import React, { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

import { useStaticTexture } from "../textures";
import { rng } from "../kit";

// Night city pieces shared by the exterior scenes.

function paintWindows(ctx, w, h) {
  const r = rng(77);
  ctx.fillStyle = "#07080c";
  ctx.fillRect(0, 0, w, h);
  const cols = 8;
  const rows = 16;
  const cw = w / cols;
  const rh = h / rows;
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const lit = r() < 0.32;
      ctx.fillStyle = lit ? (r() < 0.7 ? "#ffcf8a" : "#a9c8ff") : "#10131b";
      ctx.globalAlpha = lit ? 0.45 + r() * 0.55 : 1;
      ctx.fillRect(x * cw + cw * 0.18, y * rh + rh * 0.22, cw * 0.64, rh * 0.56);
    }
  }
  ctx.globalAlpha = 1;
}

// Lit-window facade; `worldUv` is for geometry whose UVs are already in metres (extrusions).
export function useWindowMaterial(width, height, { worldUv = false } = {}) {
  const windows = useStaticTexture(256, 512, paintWindows);
  const material = useMemo(() => {
    const tex = windows.clone();
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    if (worldUv) tex.repeat.set(1 / 12, 1 / 24);
    else tex.repeat.set(Math.max(1, Math.round(width / 12)), Math.max(1, Math.round(height / 24)));
    tex.needsUpdate = true;
    return new THREE.MeshStandardMaterial({
      color: "#1a1c22",
      map: tex,
      emissive: "#ffffff",
      emissiveMap: tex,
      emissiveIntensity: 0.9,
      roughness: 0.8,
    });
  }, [windows, width, height, worldUv]);
  useEffect(() => () => material.dispose(), [material]);
  return material;
}

function Block({ x, z, w, d, h }) {
  const material = useWindowMaterial(Math.max(w, d), h);
  return (
    <mesh position={[x, h / 2, z]} material={material}>
      <boxGeometry args={[w, h, d]} />
    </mesh>
  );
}

// Lit towers scattered in a ring around the scene, clear of the plaza.
export function CityBlocks({ seed = 11, count = 36, inner = 80, outer = 170 }) {
  const blocks = useMemo(() => {
    const r = rng(seed);
    return Array.from({ length: count }, (_, i) => {
      const a = r() * Math.PI * 2;
      const dist = inner + r() * (outer - inner);
      return {
        key: i,
        x: Math.cos(a) * dist,
        z: Math.sin(a) * dist,
        w: 14 + r() * 18,
        d: 14 + r() * 18,
        h: 20 + r() * 70,
      };
    });
  }, [seed, count, inner, outer]);
  return blocks.map(({ key, ...b }) => <Block key={key} {...b} />);
}

export function Ground({ size = 800, color = "#0b0c10" }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial color={color} roughness={0.95} />
    </mesh>
  );
}

function paintRoad(ctx, w, h) {
  ctx.fillStyle = "#101116";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#d8d2bf";
  ctx.fillRect(0, h * 0.06, w, 3);
  ctx.fillRect(0, h * 0.94 - 3, w, 3);
  ctx.fillStyle = "#e0b43a";
  for (let x = 0; x < w; x += 64) ctx.fillRect(x, h / 2 - 2, 36, 4);
}

// A two-lane road along x (or z), centred `offset` metres from the origin.
export function Road({ axis = "x", offset = 16, length = 400, width = 9 }) {
  const texture = useStaticTexture(256, 64, paintRoad);
  const tex = useMemo(() => {
    const t = texture.clone();
    t.wrapS = THREE.RepeatWrapping;
    t.repeat.set(length / 16, 1);
    t.needsUpdate = true;
    return t;
  }, [texture, length]);
  useEffect(() => () => tex.dispose(), [tex]);
  const alongZ = axis === "z";
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, alongZ ? Math.PI / 2 : 0]}
      position={alongZ ? [offset, 0.02, 0] : [0, 0.02, offset]}
    >
      <planeGeometry args={[length, width]} />
      <meshStandardMaterial map={tex} roughness={0.7} />
    </mesh>
  );
}

// Cars as dark bodies with white headlights and red tail-lights; bloom turns
// them into light trails at night.
export function Traffic({ axis = "x", offset = 16, span = 240, perLane = 9, seed = 4 }) {
  const bodies = useRef(null);
  const heads = useRef(null);
  const tails = useRef(null);
  const count = perLane * 2;
  const cars = useMemo(() => {
    const r = rng(seed);
    return Array.from({ length: count }, (_, i) => {
      const dir = i < perLane ? 1 : -1;
      return { dir, lane: dir * -2.2, start: (r() - 0.5) * span, speed: 11 + r() * 7 };
    });
  }, [count, perLane, seed, span]);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(({ clock }) => {
    if (!bodies.current) return;
    const t = clock.elapsedTime;
    const place = (mesh, i, along, across, y, sx, sy, sz) => {
      if (axis === "x") dummy.position.set(along, y, offset + across);
      else dummy.position.set(offset + across, y, along);
      dummy.rotation.set(0, axis === "x" ? Math.PI / 2 : 0, 0);
      dummy.scale.set(sx, sy, sz);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    };
    cars.forEach((c, i) => {
      const raw = c.start + c.dir * c.speed * t;
      const along = ((((raw + span / 2) % span) + span) % span) - span / 2;
      place(bodies.current, i, along, c.lane, 0.7, 1.8, 1.1, 4.2);
      place(heads.current, i, along + c.dir * 2.12, c.lane, 0.65, 1.5, 0.18, 0.08);
      place(tails.current, i, along - c.dir * 2.12, c.lane, 0.75, 1.5, 0.14, 0.08);
    });
    bodies.current.instanceMatrix.needsUpdate = true;
    heads.current.instanceMatrix.needsUpdate = true;
    tails.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={bodies} args={[undefined, undefined, count]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#15171c" metalness={0.6} roughness={0.4} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, count]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={[4, 3.8, 3.2]} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={tails} args={[undefined, undefined, count]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={[3, 0.15, 0.1]} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

function paintGlow(ctx, w, h) {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, "rgba(255,200,130,0.55)");
  g.addColorStop(1, "rgba(255,200,130,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

// Lamp posts with a warm pool of light painted on the pavement beneath each.
export function StreetLamps({ positions }) {
  const glow = useStaticTexture(128, 128, paintGlow);
  return positions.map(([x, z]) => (
    <group key={`${x}:${z}`} position={[x, 0, z]}>
      <mesh position={[0, 3.5, 0]}>
        <cylinderGeometry args={[0.07, 0.1, 7, 8]} />
        <meshStandardMaterial color="#1d1f24" metalness={0.7} roughness={0.4} />
      </mesh>
      <mesh position={[0, 7.05, 0]}>
        <sphereGeometry args={[0.22, 12, 8]} />
        <meshBasicMaterial color={[3.2, 2.4, 1.5]} toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <planeGeometry args={[9, 9]} />
        <meshBasicMaterial map={glow} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  ));
}
