"use client";

import React, { useCallback } from "react";

import { agendaRooms } from "@/lib/agenda/sessions";
import { useVenue } from "../context";
import { useStaticTexture } from "../textures";
import { Atmosphere, LedScreen, Walkers } from "../kit";

// Meeting-room corridor: a 43" LCD beside every door, each with its room plate.

const DOORS = [0, -8, -16, -24];
const FALLBACK_ROOMS = ["Room A", "Room B", "Room C", "Room D"];

function RoomPlate({ name, accent, position }) {
  const paint = useCallback(
    (ctx, w, h) => {
      ctx.fillStyle = "#15161b";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = accent;
      ctx.fillRect(0, 0, 10, h);
      ctx.fillStyle = "#f4f4f5";
      ctx.font = `600 ${Math.round(h * 0.5)}px system-ui, sans-serif`;
      ctx.textBaseline = "middle";
      ctx.fillText(name, 34, h / 2 + 2);
    },
    [name, accent],
  );
  const texture = useStaticTexture(512, 128, paint);
  return (
    <mesh position={position} rotation={[0, Math.PI / 2, 0]}>
      <planeGeometry args={[0.6, 0.15]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

export function CorridorScene() {
  const { boardTexture, sessions, theme } = useVenue();
  const rooms = agendaRooms(sessions);
  const names = DOORS.map((_, i) => rooms[i] || FALLBACK_ROOMS[i]);

  return (
    <group>
      <Atmosphere background="#050507" fog="#0b0b0f" density={0.045} />
      <hemisphereLight args={["#4a4f63", "#101010", 0.9]} />
      <ambientLight intensity={0.3} />
      {[10, 2, -6, -14, -22].map((z) => (
        <pointLight key={z} position={[0, 2.8, z]} intensity={3.2} decay={0} distance={8} color="#fff1dc" />
      ))}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -4]}>
        <planeGeometry args={[4, 60]} />
        <meshStandardMaterial color="#2a2d35" roughness={0.95} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 3, -4]}>
        <planeGeometry args={[4, 60]} />
        <meshStandardMaterial color="#18191d" roughness={1} />
      </mesh>
      {Array.from({ length: 15 }, (_, i) => 22 - i * 4).map((z) => (
        <mesh key={z} position={[0, 2.99, z]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.2, 0.6]} />
          <meshBasicMaterial color="#f3efe6" toneMapped={false} />
        </mesh>
      ))}
      <mesh position={[-2, 1.5, -4]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[60, 3]} />
        <meshStandardMaterial color="#3a3c43" roughness={0.9} />
      </mesh>
      <mesh position={[2, 1.5, -4]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[60, 3]} />
        <meshStandardMaterial color="#34363c" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.5, -34]}>
        <planeGeometry args={[4, 3]} />
        <meshStandardMaterial color="#2c2e34" roughness={0.9} />
      </mesh>

      {DOORS.map((z, i) => (
        <group key={z}>
          <mesh position={[-1.97, 1.1, z]}>
            <boxGeometry args={[0.08, 2.2, 1.1]} />
            <meshStandardMaterial color="#5a3f2c" roughness={0.6} />
          </mesh>
          <mesh position={[-1.9, 1.05, z + 0.4]}>
            <boxGeometry args={[0.06, 0.04, 0.2]} />
            <meshStandardMaterial color="#c9c9cf" metalness={0.9} roughness={0.2} />
          </mesh>
          <RoomPlate name={names[i]} accent={theme.accent} position={[-1.985, 2.42, z]} />
          <LedScreen
            texture={boardTexture}
            width={0.95}
            height={0.535}
            pitch={null}
            gain={1.05}
            bezel={0.02}
            depth={0.05}
            position={[-1.94, 1.6, z - 1.35]}
            rotation={[0, Math.PI / 2, 0]}
          />
        </group>
      ))}
      {[-4, -12, -20].map((z) => (
        <mesh key={z} position={[1.98, 1.6, z]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[1.4, 0.9]} />
          <meshStandardMaterial color="#20242c" roughness={0.6} />
        </mesh>
      ))}
      <Walkers count={4} span={[-30, 20]} lanes={[-0.9, 0.9]} seed={29} axis="z" />
    </group>
  );
}
