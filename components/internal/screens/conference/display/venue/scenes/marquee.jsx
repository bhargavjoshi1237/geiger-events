"use client";

import React, { useCallback, useEffect, useMemo } from "react";
import * as THREE from "three";

import { useVenue } from "../context";
import { useStaticTexture, useTickerTexture } from "../textures";
import { Atmosphere, LedScreen, NightSky, useLedMaterial, useScroll } from "../kit";
import { CityBlocks, Ground, Road, StreetLamps, Traffic } from "./outdoor";

// Venue entrance at night: a double-sided pylon marquee on the plaza, the arena
// behind it wrapped in a facade ticker, and traffic on the street in front.

const SCREEN = { w: 14.8, h: 8.325 };
const SCREEN_Y = 14.5;

function NamePlate({ position, rotation }) {
  const { event, theme } = useVenue();
  const name = (event?.name || "Live").toUpperCase();
  const paint = useCallback(
    (ctx, w, h) => {
      ctx.fillStyle = "#08080b";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = theme.accent;
      ctx.font = `800 ${Math.round(h * 0.56)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      let size = Math.round(h * 0.56);
      while (size > 20 && ctx.measureText(name).width > w * 0.92) {
        size -= 4;
        ctx.font = `800 ${size}px system-ui, sans-serif`;
      }
      ctx.fillText(name, w / 2, h / 2 + 4);
    },
    [name, theme.accent],
  );
  const texture = useStaticTexture(1024, 128, paint);
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[16, 2]} />
      <meshBasicMaterial map={texture} toneMapped={false} color={[1.6, 1.6, 1.6]} />
    </mesh>
  );
}

function Pylon() {
  const { boardTexture } = useVenue();
  return (
    <group>
      {[-8.2, 8.2].map((x) => (
        <mesh key={x} position={[x, 12, 0]}>
          <boxGeometry args={[1.4, 24, 1.6]} />
          <meshStandardMaterial color="#1b1c21" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, SCREEN_Y, 0]}>
        <boxGeometry args={[SCREEN.w + 0.8, SCREEN.h + 0.8, 1.5]} />
        <meshStandardMaterial color="#111216" metalness={0.5} roughness={0.5} />
      </mesh>
      <LedScreen texture={boardTexture} width={SCREEN.w} height={SCREEN.h} pitch={12} gain={1.35} bezel={0} position={[0, SCREEN_Y, 0.76]} />
      <LedScreen
        texture={boardTexture}
        width={SCREEN.w}
        height={SCREEN.h}
        pitch={12}
        gain={1.35}
        bezel={0}
        position={[0, SCREEN_Y, -0.76]}
        rotation={[0, Math.PI, 0]}
      />
      <mesh position={[0, 20.4, 0]}>
        <boxGeometry args={[17.8, 2.6, 1.8]} />
        <meshStandardMaterial color="#0d0e12" metalness={0.5} roughness={0.5} />
      </mesh>
      <NamePlate position={[0, 20.4, 0.91]} />
      <NamePlate position={[0, 20.4, -0.91]} rotation={[0, Math.PI, 0]} />
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[20, 0.8, 4]} />
        <meshStandardMaterial color="#202127" roughness={0.8} />
      </mesh>
    </group>
  );
}

function paintFacade(ctx, w, h) {
  ctx.fillStyle = "#0a0c12";
  ctx.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 16) {
    ctx.fillStyle = x % 48 ? "#1a2536" : "#2f4a6e";
    ctx.fillRect(x, 0, 10, h);
  }
}

function VenueBuilding() {
  const facade = useStaticTexture(512, 64, paintFacade);
  const glass = useMemo(() => {
    const t = facade.clone();
    t.wrapS = THREE.RepeatWrapping;
    t.repeat.set(6, 1);
    t.needsUpdate = true;
    return t;
  }, [facade]);
  useEffect(() => () => glass.dispose(), [glass]);
  const ticker = useTickerTexture();
  const R = 30.3;
  const H = 4;
  const theta = Math.PI * 0.9;
  const arc = R * theta;
  const copies = Math.max(1, Math.round(arc / (H * 32)));
  const band = useLedMaterial(ticker, { grid: [(arc * 1000) / 16, (H * 1000) / 16], uvRect: [0, 0, copies, 1], gain: 1.3 });
  const bandMesh = useScroll(0.02);
  const { theme } = useVenue();

  return (
    <group position={[0, 0, -52]}>
      <mesh position={[0, 12, 0]}>
        <cylinderGeometry args={[30, 30, 24, 96]} />
        <meshStandardMaterial map={glass} emissiveMap={glass} emissive="#ffffff" emissiveIntensity={0.5} roughness={0.4} metalness={0.5} />
      </mesh>
      <mesh ref={bandMesh} position={[0, 18, 0]} material={band}>
        <cylinderGeometry args={[R, R, H, 96, 1, true, -theta / 2, theta]} />
      </mesh>
      <mesh position={[0, 24.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[30.1, 0.18, 8, 128]} />
        <meshBasicMaterial color={theme.accent} toneMapped={false} />
      </mesh>
      <mesh position={[0, 2.2, 30.2]}>
        <boxGeometry args={[18, 4.4, 1]} />
        <meshStandardMaterial color="#2a2f3a" emissive="#ffd9a8" emissiveIntensity={0.35} roughness={0.3} />
      </mesh>
      <mesh position={[0, 4.6, 30.8]}>
        <boxGeometry args={[19, 0.35, 0.3]} />
        <meshBasicMaterial color={[1.2, 1.05, 0.8]} toneMapped={false} />
      </mesh>
    </group>
  );
}

const LAMPS = [-48, -32, -16, 16, 32, 48].map((x) => [x, 10]);

export function MarqueeScene() {
  return (
    <group>
      <Atmosphere background="#05060b" fog="#140f22" density={0.0065} />
      <NightSky />
      <hemisphereLight args={["#3b3f66", "#0a0a0a", 0.45]} />
      <ambientLight intensity={0.1} />
      <pointLight position={[0, 12, 8]} intensity={2} decay={0} distance={26} color="#aab8ff" />
      <Ground />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -14]}>
        <planeGeometry args={[80, 44]} />
        <meshStandardMaterial color="#16171c" roughness={0.6} metalness={0.2} />
      </mesh>
      <Road axis="x" offset={16} />
      <Traffic axis="x" offset={16} />
      <StreetLamps positions={LAMPS} />
      <VenueBuilding />
      <Pylon />
      <CityBlocks />
    </group>
  );
}
