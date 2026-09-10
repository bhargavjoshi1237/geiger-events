"use client";

import React, { useMemo } from "react";
import * as THREE from "three";

import { useVenue } from "../context";
import { Atmosphere, Walkers, ledGrid, rng, useLedMaterial } from "../kit";

// Concourse video wall built from 16 × 9 half-metre cabinets. Each cabinet is
// its own quad with a hairline seam and a slightly different calibration — the
// two tells of a tiled wall once you're standing close to it.

const COLS = 16;
const ROWS = 9;
const CAB = 0.5;
const GAP = 0.006;
const WALL_W = COLS * CAB;
const WALL_H = ROWS * CAB;
const BOTTOM = 0.6;

function cabinetGeometry() {
  const r = rng(13);
  const positions = [];
  const uvs = [];
  const tints = [];
  const indices = [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const x0 = -WALL_W / 2 + col * CAB + GAP / 2;
      const x1 = x0 + CAB - GAP;
      const y0 = row * CAB + GAP / 2;
      const y1 = y0 + CAB - GAP;
      const k = 0.96 + r() * 0.08;
      const tint = [k * (0.99 + r() * 0.02), k, k * (0.98 + r() * 0.04)];
      const base = positions.length / 3;
      for (const [x, y] of [
        [x0, y0],
        [x1, y0],
        [x1, y1],
        [x0, y1],
      ]) {
        positions.push(x, y, 0);
        uvs.push((x + WALL_W / 2) / WALL_W, y / WALL_H);
        tints.push(...tint);
      }
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute("tint", new THREE.Float32BufferAttribute(tints, 3));
  g.setIndex(indices);
  return g;
}

export function ConcourseScene() {
  const { boardTexture } = useVenue();
  const geometry = useMemo(() => cabinetGeometry(), []);
  const grid = ledGrid(WALL_W, WALL_H, 2.5);
  const wall = useLedMaterial(boardTexture, { grid, tint: true, gain: 1.15 });
  const mirror = useLedMaterial(boardTexture, { grid, tint: true, gain: 0.3, side: THREE.DoubleSide });

  return (
    <group>
      <Atmosphere background="#060608" fog="#0a0a0e" density={0.035} />
      <hemisphereLight args={["#3a4058", "#0a0a0a", 0.85]} />
      <ambientLight intensity={0.12} />

      <group position={[0, BOTTOM, 0]}>
        <mesh geometry={geometry} material={wall} />
        <mesh position={[0, WALL_H / 2, -0.08]}>
          <boxGeometry args={[WALL_W + 0.24, WALL_H + 0.24, 0.14]} />
          <meshStandardMaterial color="#0c0d10" roughness={0.5} metalness={0.4} />
        </mesh>
      </group>
      {/* A dimmed, flipped copy under a semi-opaque floor stands in for reflection. */}
      <group position={[0, -BOTTOM, 0]} scale={[1, -1, 1]}>
        <mesh geometry={geometry} material={mirror} />
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 6]}>
        <planeGeometry args={[60, 30]} />
        <meshStandardMaterial color="#0e0f13" roughness={0.3} metalness={0.3} transparent opacity={0.86} />
      </mesh>

      <mesh position={[0, 3.5, -0.2]}>
        <planeGeometry args={[60, 7]} />
        <meshStandardMaterial color="#17181d" roughness={0.9} />
      </mesh>
      <mesh position={[0, 6.2, 6]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[60, 30]} />
        <meshStandardMaterial color="#0b0b0e" roughness={1} />
      </mesh>
      {[2.5, 6.5, 10.5].map((z) => (
        <mesh key={z} position={[0, 6.15, z]}>
          <boxGeometry args={[40, 0.04, 0.14]} />
          <meshBasicMaterial color="#b9bfca" toneMapped={false} />
        </mesh>
      ))}
      {[-12, 12].map((x) => (
        <mesh key={x} position={[x, 3.1, 1.2]}>
          <boxGeometry args={[1, 6.2, 1]} />
          <meshStandardMaterial color="#1d1e24" roughness={0.8} />
        </mesh>
      ))}
      <pointLight position={[0, 5.5, 7]} intensity={1.5} decay={0} distance={18} color="#dfe6ff" />
      <Walkers count={16} span={[-18, 18]} lanes={[2.2, 9]} seed={5} />
    </group>
  );
}
