"use client";

import React, { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { useVenue } from "../context";
import { useImagTexture, useTickerTexture } from "../textures";
import { Atmosphere, Beam, LedScreen, rng, useLedMaterial, useScroll } from "../kit";
import { useFrame } from "@react-three/fiber";

// Keynote hall: raised stage, 12 m main LED wall, angled portrait IMAG screens
// either side, a lit lip ticker, and a raked audience in silhouette.

const STAGE_TOP = 1.2;
const WALL = { w: 12, h: 6.75 };

function Audience() {
  const heads = useRef(null);
  const bodies = useRef(null);
  const seats = useMemo(() => {
    const r = rng(21);
    const out = [];
    for (let z = 3; z < 25; z += 1.1) {
      for (let x = -15; x <= 15; x += 0.62) {
        if (Math.abs(x) < 0.9 || (Math.abs(x) > 8.6 && Math.abs(x) < 9.6)) continue;
        if (r() > 0.9) continue;
        out.push({ x: x + (r() - 0.5) * 0.08, z, y: 1.15 + z * 0.045 + (r() - 0.5) * 0.08, s: 0.9 + r() * 0.2 });
      }
    }
    return out;
  }, []);

  useEffect(() => {
    const o = new THREE.Object3D();
    seats.forEach((p, i) => {
      o.position.set(p.x, p.y, p.z);
      o.scale.setScalar(p.s);
      o.updateMatrix();
      heads.current.setMatrixAt(i, o.matrix);
      o.position.set(p.x, p.y - 0.42, p.z + 0.05);
      o.scale.set(p.s * 1.9, p.s * 1.4, p.s);
      o.updateMatrix();
      bodies.current.setMatrixAt(i, o.matrix);
    });
    heads.current.instanceMatrix.needsUpdate = true;
    bodies.current.instanceMatrix.needsUpdate = true;
  }, [seats]);

  return (
    <group>
      <instancedMesh ref={heads} args={[undefined, undefined, seats.length]}>
        <sphereGeometry args={[0.12, 10, 8]} />
        <meshStandardMaterial color="#1b1c22" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={bodies} args={[undefined, undefined, seats.length]}>
        <sphereGeometry args={[0.13, 10, 8]} />
        <meshStandardMaterial color="#15161b" roughness={0.9} />
      </instancedMesh>
    </group>
  );
}

function StageLip() {
  const texture = useTickerTexture();
  const material = useLedMaterial(texture, { grid: [20000 / 4, 300 / 4], uvRect: [0, 0, 2, 1], gain: 1.2 });
  const mesh = useScroll(0.03);
  return (
    <mesh ref={mesh} position={[0, STAGE_TOP - 0.25, -0.99]} material={material}>
      <planeGeometry args={[20, 0.3]} />
    </mesh>
  );
}

function Presenter() {
  const group = useRef(null);
  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.elapsedTime;
    group.current.position.x = 3.4 + Math.sin(t * 0.25) * 1.4;
    group.current.rotation.y = Math.sin(t * 0.5) * 0.4;
  });
  return (
    <group ref={group} position={[3.4, STAGE_TOP, -3.2]}>
      <mesh position={[0, 0.85, 0]}>
        <capsuleGeometry args={[0.22, 1.1, 4, 10]} />
        <meshStandardMaterial color="#20232b" roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.72, 0]}>
        <sphereGeometry args={[0.14, 12, 10]} />
        <meshStandardMaterial color="#8a6a58" roughness={0.6} />
      </mesh>
    </group>
  );
}

export function StageScene() {
  const { boardTexture, theme } = useVenue();
  const imag = useImagTexture();
  const wallY = STAGE_TOP + 0.45 + WALL.h / 2;
  const beams = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => ({
        key: i,
        position: [-10.5 + i * 3, 12.2, -2.5],
        aim: [-6 + i * 1.7, 0, 8 + (i % 3) * 3],
        phase: i * 0.9,
        color: i % 2 ? theme.accent : "#7aa2ff",
      })),
    [theme.accent],
  );

  return (
    <group>
      <Atmosphere background="#040406" fog="#08080d" density={0.02} />
      <hemisphereLight args={["#202638", "#050505", 0.35]} />
      <pointLight position={[0, 5, -3]} intensity={2.4} decay={0} distance={26} color={theme.accent} />
      <pointLight position={[0, 9, 6]} intensity={1.2} decay={0} distance={30} color="#9fb4ff" />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 8]}>
        <planeGeometry args={[50, 50]} />
        <meshStandardMaterial color="#121318" roughness={0.95} />
      </mesh>
      <mesh position={[0, 8, -8.2]}>
        <planeGeometry args={[50, 16]} />
        <meshStandardMaterial color="#08080b" roughness={1} />
      </mesh>
      <mesh position={[0, STAGE_TOP / 2, -4.5]}>
        <boxGeometry args={[20, STAGE_TOP, 7]} />
        <meshStandardMaterial color="#0f1014" roughness={0.6} />
      </mesh>

      <LedScreen texture={boardTexture} width={WALL.w} height={WALL.h} pitch={3.9} position={[0, wallY, -7.4]} />
      <LedScreen
        texture={imag}
        width={3.6}
        height={6.4}
        pitch={3.9}
        position={[-9.4, wallY, -6.3]}
        rotation={[0, 0.24, 0]}
      />
      <LedScreen
        texture={imag}
        width={3.6}
        height={6.4}
        pitch={3.9}
        position={[9.4, wallY, -6.3]}
        rotation={[0, -0.24, 0]}
      />
      <StageLip />

      <mesh position={[-3.6, STAGE_TOP + 0.55, -2.6]}>
        <boxGeometry args={[0.8, 1.1, 0.55]} />
        <meshStandardMaterial color="#1a1b20" roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh position={[-3.6, STAGE_TOP + 0.75, -2.31]}>
        <planeGeometry args={[0.5, 0.12]} />
        <meshBasicMaterial color={theme.accent} toneMapped={false} />
      </mesh>
      <Presenter />

      <mesh position={[0, 12.4, -2.5]}>
        <boxGeometry args={[24, 0.45, 0.45]} />
        <meshStandardMaterial color="#26282e" metalness={0.8} roughness={0.35} />
      </mesh>
      {beams.map((b) => (
        <Beam
          key={b.key}
          position={b.position}
          aim={b.aim}
          color={b.color}
          length={16}
          radius={1.8}
          intensity={0.2}
          sweep={[0.2, 0.3]}
          speed={0.4}
          phase={b.phase}
        />
      ))}
      {[-7.5, 7.5].map((x) => (
        <Beam
          key={x}
          position={[x, STAGE_TOP, -7.9]}
          aim={[x * 1.6, 20, -6]}
          color="#ffffff"
          length={18}
          radius={1.4}
          intensity={0.12}
          sweep={[0.05, 0.25]}
          speed={0.3}
          phase={x}
        />
      ))}
      <Audience />
    </group>
  );
}
