"use client";

import React, { useMemo } from "react";
import * as THREE from "three";

import { useVenue } from "../context";
import { useStaticTexture, useTickerTexture } from "../textures";
import { Atmosphere, Beam, BulbRing, Crowd, Strut, rng, useLedMaterial, useScroll } from "../kit";

// A seated arena bowl: stepped lower and upper tiers, a club-level fascia with
// a ribbon board, and an upper ribbon. Shared by the center-hung and ribbon views.

const ROWS = 18;
const LOWER = { r0: 17, y0: 0.8, r1: 31, y1: 9.5 };
const UPPER = { r0: 33, y0: 12.5, r1: 47, y1: 26 };
const ROOF_Y = 34;

function tier({ r0, y0, r1, y1 }) {
  const dr = (r1 - r0) / ROWS;
  const dy = (y1 - y0) / ROWS;
  const pts = [];
  for (let i = 0; i < ROWS; i += 1) {
    pts.push(new THREE.Vector2(r0 + i * dr, y0 + (i + 1) * dy));
    pts.push(new THREE.Vector2(r0 + (i + 1) * dr, y0 + (i + 1) * dy));
  }
  return pts;
}

function seatPositions(seed, floor) {
  const r = rng(seed);
  const out = [];
  for (const t of [LOWER, UPPER]) {
    const dr = (t.r1 - t.r0) / ROWS;
    const dy = (t.y1 - t.y0) / ROWS;
    for (let row = 0; row < ROWS; row += 1) {
      const radius = t.r0 + (row + 0.5) * dr;
      const y = t.y0 + (row + 1) * dy + 0.5;
      const step = 0.55 / radius;
      for (let a = 0; a < Math.PI * 2; a += step) {
        if ((a % (Math.PI / 10)) * radius < 1.3) continue;
        if (r() > 0.84) continue;
        const rr = radius + (r() - 0.5) * 0.12;
        out.push(Math.sin(a) * rr, y + (r() - 0.5) * 0.1, Math.cos(a) * rr);
      }
    }
  }
  if (floor) {
    for (let x = -14; x <= 14; x += 0.6) {
      for (let z = -14; z <= 14; z += 0.75) {
        const edge = Math.max(Math.abs(x), Math.abs(z));
        if (edge < 6.5 || Math.hypot(x, z) > 15.5 || r() > 0.9) continue;
        out.push(x + (r() - 0.5) * 0.1, 1.2, z);
      }
    }
  }
  return new Float32Array(out);
}

// A ticker ribbon wrapped round the bowl; `inward` faces the arena floor.
export function Ribbon({ radius, y, height, pitch = 10, speed = 0.02, inward = true, gain = 1.3 }) {
  const texture = useTickerTexture();
  const circumference = 2 * Math.PI * radius;
  const copies = Math.max(1, Math.round(circumference / (height * 32)));
  const material = useLedMaterial(texture, {
    grid: [(circumference * 1000) / pitch, (height * 1000) / pitch],
    uvRect: [0, 0, inward ? -copies : copies, 1],
    side: inward ? THREE.BackSide : THREE.FrontSide,
    gain,
  });
  const mesh = useScroll(speed);
  return (
    <mesh ref={mesh} position={[0, y, 0]} material={material}>
      <cylinderGeometry args={[radius, radius, height, 160, 1, true]} />
    </mesh>
  );
}

export function Arena({ children, floorCrowd = true }) {
  const bowl = useMemo(() => {
    const profile = [
      new THREE.Vector2(15, 0),
      new THREE.Vector2(LOWER.r0, 0),
      new THREE.Vector2(LOWER.r0, LOWER.y0),
      ...tier(LOWER),
      new THREE.Vector2(LOWER.r1, UPPER.y0),
      new THREE.Vector2(UPPER.r0, UPPER.y0),
      ...tier(UPPER),
      new THREE.Vector2(UPPER.r1, ROOF_Y),
    ];
    return new THREE.LatheGeometry(profile, 128);
  }, []);
  const seats = useMemo(() => seatPositions(5, floorCrowd), [floorCrowd]);

  return (
    <group>
      <Atmosphere background="#030306" fog="#07070d" density={0.011} />
      <hemisphereLight args={["#2a3050", "#050505", 0.5]} />
      <ambientLight intensity={0.08} />

      <mesh geometry={bowl}>
        <meshStandardMaterial color="#101116" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[17.2, 64]} />
        <meshStandardMaterial color="#0d0e12" roughness={0.6} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, ROOF_Y, 0]}>
        <circleGeometry args={[UPPER.r1 + 1, 64]} />
        <meshStandardMaterial color="#060608" roughness={1} />
      </mesh>

      <Crowd positions={seats} />
      <Ribbon radius={LOWER.r1 - 0.05} y={11} height={1.1} speed={0.018} />
      <Ribbon radius={UPPER.r1 - 0.05} y={27.6} height={1.3} speed={-0.014} />
      {children}
    </group>
  );
}

function BoxingRing() {
  const ropes = [
    { y: 1.75, color: "#d7263d" },
    { y: 2.15, color: "#f4f4f5" },
    { y: 2.55, color: "#2046c8" },
  ];
  const half = 3.4;
  const corners = [
    [-half, -half],
    [half, -half],
    [half, half],
    [-half, half],
  ];
  return (
    <group>
      <mesh position={[0, 0.6, 0]}>
        <boxGeometry args={[7.6, 1.2, 7.6]} />
        <meshStandardMaterial color="#1b3fa8" roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.205, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[7.6, 7.6]} />
        <meshStandardMaterial color="#dcdce4" roughness={0.8} />
      </mesh>
      {corners.map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 2.05, z]}>
          <cylinderGeometry args={[0.09, 0.09, 1.7, 10]} />
          <meshStandardMaterial color="#c8c8cc" metalness={0.8} roughness={0.3} />
        </mesh>
      ))}
      {ropes.flatMap((rope) =>
        corners.map(([x, z], i) => {
          const [nx, nz] = corners[(i + 1) % 4];
          return (
            <Strut
              key={`${rope.y}-${i}`}
              from={[x, rope.y, z]}
              to={[nx, rope.y, nz]}
              radius={0.035}
              color={rope.color}
              metalness={0.1}
            />
          );
        }),
      )}
      <spotLight position={[0, 24, 0]} angle={0.3} penumbra={0.5} intensity={9} decay={0} color="#fff6e8" />
    </group>
  );
}

// The drum-style center-hung from the reference: a 360° video drum carrying the
// board four times, halo ribbons above and below, and a lit truss cage.
function CenterHung({ y = 17.5 }) {
  const { boardTexture } = useVenue();
  const R = 7.9;
  const H = 7;
  const drum = useLedMaterial(boardTexture, {
    grid: [(2 * Math.PI * R * 1000) / 6, (H * 1000) / 6],
    uvRect: [0, 0, 4, 1],
    gain: 1.25,
  });
  const struts = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return {
          key: i,
          from: [Math.sin(a) * 10.3, y + 5.6, Math.cos(a) * 10.3],
          to: [Math.sin(a) * 7.2, y + 8, Math.cos(a) * 7.2],
        };
      }),
    [y],
  );
  return (
    <group>
      <mesh position={[0, y, 0]} rotation={[0, -Math.PI / 4, 0]} material={drum}>
        <cylinderGeometry args={[R, R, H, 160, 1, true]} />
      </mesh>
      {[H / 2 + 0.18, -H / 2 - 0.18].map((dy) => (
        <mesh key={dy} position={[0, y + dy, 0]}>
          <cylinderGeometry args={[R + 0.15, R + 0.15, 0.36, 96, 1]} />
          <meshStandardMaterial color="#17181d" metalness={0.8} roughness={0.35} />
        </mesh>
      ))}
      <BulbRing radius={R + 0.2} y={y + H / 2 + 0.4} count={96} size={0.07} />
      <BulbRing radius={R + 0.2} y={y - H / 2 - 0.4} count={96} size={0.07} />

      <group position={[0, y + 4.4, 0]}>
        <Ribbon radius={9.6} y={0} height={1.5} pitch={6} inward={false} speed={-0.02} />
      </group>
      <group position={[0, y - 4.6, 0]}>
        <Ribbon radius={5.6} y={0} height={1.2} pitch={6} inward={false} speed={0.025} />
      </group>

      {[
        { r: 10.3, dy: 5.6 },
        { r: 7.2, dy: 8 },
        { r: 6.4, dy: -5.6 },
      ].map(({ r, dy }) => (
        <group key={dy}>
          <mesh position={[0, y + dy, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[r, 0.13, 8, 96]} />
            <meshStandardMaterial color="#2a2c33" metalness={0.85} roughness={0.3} />
          </mesh>
          <BulbRing radius={r} y={y + dy - 0.22} count={Math.round(r * 9)} size={0.08} />
        </group>
      ))}
      {struts.map((s) => (
        <Strut key={s.key} from={s.from} to={s.to} radius={0.07} />
      ))}
      {[0, 1, 2, 3].map((i) => {
        const a = Math.PI / 4 + (i * Math.PI) / 2;
        return (
          <Strut
            key={i}
            from={[Math.sin(a) * 6.5, y + 8, Math.cos(a) * 6.5]}
            to={[Math.sin(a) * 6.5, ROOF_Y, Math.cos(a) * 6.5]}
            radius={0.03}
            color="#111"
          />
        );
      })}
    </group>
  );
}

// The low ring of fixtures over the ring throwing warm beams down onto the canvas.
function LightRing() {
  const beams = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return {
          key: i,
          position: [Math.sin(a) * 11.5, 7.4, Math.cos(a) * 11.5],
          aim: [Math.sin(a) * 2.5, 0, Math.cos(a) * 2.5],
          phase: i * 0.7,
        };
      }),
    [],
  );
  return (
    <group>
      <mesh position={[0, 7.6, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[11.5, 0.16, 8, 128]} />
        <meshStandardMaterial color="#2a2c33" metalness={0.85} roughness={0.3} />
      </mesh>
      <BulbRing radius={11.5} y={7.35} count={120} size={0.07} color="#ffe2a8" />
      {beams.map((b) => (
        <Beam
          key={b.key}
          position={b.position}
          aim={b.aim}
          color="#ffcf5a"
          length={11}
          radius={1.1}
          intensity={0.22}
          sweep={[0.08, 0.08]}
          phase={b.phase}
        />
      ))}
    </group>
  );
}

function RafterBeams({ color = "#3d6bff", count = 8, intensity = 0.16 }) {
  const beams = useMemo(() => {
    const r = rng(9);
    return Array.from({ length: count }, (_, i) => {
      const a = (i / count) * Math.PI * 2 + 0.2;
      return {
        key: i,
        position: [Math.sin(a) * 27, 31, Math.cos(a) * 27],
        aim: [(r() - 0.5) * 16, 0, (r() - 0.5) * 16],
        phase: r() * 6,
      };
    });
  }, [count]);
  return beams.map((b) => (
    <Beam
      key={b.key}
      position={b.position}
      aim={b.aim}
      color={b.key % 2 ? color : "#8fb0ff"}
      length={38}
      radius={3}
      intensity={intensity}
      sweep={[0.18, 0.22]}
      speed={0.35}
      phase={b.phase}
    />
  ));
}

export function CenterHungScene() {
  return (
    <Arena>
      <BoxingRing />
      <CenterHung />
      <LightRing />
      <RafterBeams />
    </Arena>
  );
}

function paintCourt(ctx, w, h) {
  ctx.fillStyle = "#b07a45";
  ctx.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 12) {
    ctx.fillStyle = x % 24 ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.04)";
    ctx.fillRect(x, 0, 6, h);
  }
  ctx.strokeStyle = "#f5f1ea";
  ctx.lineWidth = 5;
  ctx.strokeRect(10, 10, w - 20, h - 20);
  ctx.beginPath();
  ctx.moveTo(w / 2, 10);
  ctx.lineTo(w / 2, h - 10);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, h * 0.12, 0, Math.PI * 2);
  ctx.stroke();
  for (const side of [0, 1]) {
    const x = side ? w - 10 : 10;
    const dir = side ? -1 : 1;
    ctx.strokeRect(side ? w - 10 - w * 0.2 : 10, h * 0.34, w * 0.2, h * 0.32);
    ctx.beginPath();
    ctx.arc(x + dir * w * 0.055, h / 2, h * 0.44, -Math.PI / 2, Math.PI / 2, side === 1);
    ctx.stroke();
  }
}

function Court() {
  const texture = useStaticTexture(1024, 544, paintCourt);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[28, 15]} />
        <meshStandardMaterial map={texture} roughness={0.35} metalness={0.05} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 13.2, 0, 0]}>
          <Strut from={[side * 1.2, 0, 0]} to={[side * 1.2, 3.4, 0]} radius={0.1} color="#1a1a1f" />
          <mesh position={[0, 3.35, 0]}>
            <boxGeometry args={[0.05, 1.05, 1.8]} />
            <meshStandardMaterial color="#e8eef5" transparent opacity={0.45} roughness={0.1} />
          </mesh>
        </group>
      ))}
      <pointLight position={[0, 16, 0]} intensity={3.5} decay={0} distance={40} color="#fff4e2" />
    </group>
  );
}

export function RibbonScene() {
  return (
    <Arena floorCrowd={false}>
      <Court />
      <RafterBeams color="#ee6b3b" count={6} intensity={0.1} />
    </Arena>
  );
}
