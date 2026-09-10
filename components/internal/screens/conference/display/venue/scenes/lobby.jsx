"use client";

import React, { useMemo } from "react";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

import { useVenue } from "../context";
import { usePortraitTexture } from "../textures";
import { Atmosphere, LedScreen, Walkers } from "../kit";

// Entrance lobby with a row of 55" portrait kiosks in front of a glass facade.

const SCREEN = { w: 0.68, h: 1.21 };
const BODY = { w: 0.84, h: 1.95, d: 0.14 };

function Totem({ texture, accent, ...group }) {
  const body = useMemo(() => new RoundedBoxGeometry(BODY.w, BODY.h, BODY.d, 4, 0.05), []);
  return (
    <group {...group}>
      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[0.96, 0.08, 0.5]} />
        <meshStandardMaterial color="#1a1b20" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh geometry={body} position={[0, 0.08 + BODY.h / 2, 0]}>
        <meshStandardMaterial color="#202228" metalness={0.5} roughness={0.3} />
      </mesh>
      <LedScreen
        texture={texture}
        width={SCREEN.w}
        height={SCREEN.h}
        pitch={null}
        gain={1.1}
        bezel={0}
        position={[0, 1.25, BODY.d / 2 + 0.002]}
      />
      <mesh position={[0, 0.3, BODY.d / 2 + 0.002]}>
        <planeGeometry args={[0.3, 0.035]} />
        <meshBasicMaterial color={accent} toneMapped={false} />
      </mesh>
    </group>
  );
}

export function LobbyScene() {
  const { theme } = useVenue();
  const portrait = usePortraitTexture();
  const mullions = useMemo(() => Array.from({ length: 13 }, (_, i) => -12 + i * 2), []);
  const downlights = useMemo(() => {
    const out = [];
    for (let x = -8; x <= 8; x += 2.6) for (let z = -3; z <= 9; z += 3) out.push([x, z]);
    return out;
  }, []);

  return (
    <group>
      <Atmosphere background="#05070c" fog="#0a0c12" density={0.04} />
      <hemisphereLight args={["#46506e", "#0b0b0b", 0.6]} />
      <ambientLight intensity={0.15} />
      <spotLight position={[0, 5, 3]} angle={0.7} penumbra={0.6} intensity={3} decay={0} color="#fff1dc" />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 3]}>
        <planeGeometry args={[40, 30]} />
        <meshStandardMaterial color="#1a1a1e" roughness={0.18} metalness={0.35} />
      </mesh>
      <mesh position={[0, 5.5, 3]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[40, 30]} />
        <meshStandardMaterial color="#0d0d10" roughness={1} />
      </mesh>
      {downlights.map(([x, z]) => (
        <mesh key={`${x}:${z}`} position={[x, 5.48, z]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.12, 16]} />
          <meshBasicMaterial color="#fff4e0" toneMapped={false} />
        </mesh>
      ))}

      {/* Glass facade onto the night street. */}
      <mesh position={[0, 3, -7]}>
        <planeGeometry args={[40, 9]} />
        <meshBasicMaterial color="#0d1a2e" />
      </mesh>
      <mesh position={[0, 2.75, -5.9]}>
        <planeGeometry args={[26, 5.5]} />
        <meshStandardMaterial color="#1b2a3a" transparent opacity={0.35} roughness={0.05} metalness={0.9} />
      </mesh>
      {mullions.map((x) => (
        <mesh key={x} position={[x, 2.75, -5.85]}>
          <boxGeometry args={[0.08, 5.5, 0.1]} />
          <meshStandardMaterial color="#2b2d33" metalness={0.8} roughness={0.3} />
        </mesh>
      ))}

      <Totem texture={portrait} accent={theme.accent} position={[-2.4, 0, 0.4]} rotation={[0, 0.18, 0]} />
      <Totem texture={portrait} accent={theme.accent} position={[0, 0, 0]} />
      <Totem texture={portrait} accent={theme.accent} position={[2.4, 0, 0.4]} rotation={[0, -0.18, 0]} />

      <Walkers count={10} span={[-12, 12]} lanes={[2.5, 8]} seed={17} />
    </group>
  );
}
