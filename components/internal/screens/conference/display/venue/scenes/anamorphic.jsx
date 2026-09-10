"use client";

import React, { useCallback, useEffect, useMemo } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";

import { useVenue } from "../context";
import { useStaticTexture } from "../textures";
import { Atmosphere, NightSky, rng } from "../kit";
import { CityBlocks, Ground, Road, StreetLamps, Traffic, useWindowMaterial } from "./outdoor";

// Anamorphic ("forced perspective") corner billboard. A virtual 3D scene — a
// room behind the corner with the board floating out of it — is rendered from
// the sweet spot and projected onto the L-shaped screen from that same eye.
// From the sweet spot it reads as depth; anywhere else it visibly shears.

export const SWEET_SPOT = [16, 1.7, 16];
export const SWEET_TARGET = [-3.5, 11, -3.5];

const LEG = 12;
const RADIUS = 2;
const Y0 = 6;
const Y1 = 16;
const PITCH = 10;

// The screen's footprint: along z = 0, round the corner, then back along x = 0.
function cornerPath(offset) {
  const pts = [
    [-LEG, offset],
    [-RADIUS, offset],
  ];
  const r = RADIUS + offset;
  for (let i = 1; i < 24; i += 1) {
    const a = Math.PI / 2 - (i / 24) * (Math.PI / 2);
    pts.push([-RADIUS + Math.cos(a) * r, -RADIUS + Math.sin(a) * r]);
  }
  pts.push([offset, -RADIUS], [offset, -LEG]);
  return pts;
}

function wrapGeometry(offset, y0, y1) {
  const path = cornerPath(offset);
  const lengths = [0];
  for (let i = 1; i < path.length; i += 1) {
    const [ax, az] = path[i - 1];
    const [bx, bz] = path[i];
    lengths.push(lengths[i - 1] + Math.hypot(bx - ax, bz - az));
  }
  const total = lengths[lengths.length - 1];
  const positions = [];
  const uvs = [];
  const indices = [];
  path.forEach(([x, z], i) => {
    positions.push(x, y0, z, x, y1, z);
    uvs.push(lengths[i] / total, 0, lengths[i] / total, 1);
    if (i > 0) {
      const a = (i - 1) * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return { geometry: g, length: total };
}

const PROJ_VERT = /* glsl */ `
  uniform mat4 eyeViewProj;
  varying vec4 vProj;
  varying vec2 vUv;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vProj = eyeViewProj * world;
    vUv = uv;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const PROJ_FRAG = /* glsl */ `
  uniform sampler2D map;
  uniform vec2 grid;
  uniform float gain;
  varying vec4 vProj;
  varying vec2 vUv;
  void main() {
    vec2 cell = vUv * grid;
    vec2 w = fwidth(cell);
    float blend = clamp(max(w.x, w.y) * 2.5 - 0.35, 0.0, 1.0);
    float mask = mix(smoothstep(0.5, 0.25, length(fract(cell) - 0.5)) * 2.2, 1.0, blend);
    vec2 uv = vProj.xy / vProj.w * 0.5 + 0.5;
    gl_FragColor = vec4(texture2D(map, uv).rgb * mask * gain, 1.0);
    #include <colorspace_fragment>
  }
`;

function paintRoomGrid(accent) {
  return (ctx, w, h) => {
    ctx.fillStyle = "#04050a";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 2;
    for (let i = 0; i <= 8; i += 1) {
      const p = (i / 8) * w;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, h);
      ctx.moveTo(0, p);
      ctx.lineTo(w, p);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.lineWidth = 8;
    ctx.strokeRect(0, 0, w, h);
  };
}

// Build the hidden scene the eye camera renders into the billboard's texture.
function useVirtualScene(boardTexture, gridTexture, accent) {
  const built = useMemo(() => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#020205");
    scene.add(new THREE.AmbientLight("#ffffff", 0.7));
    const key = new THREE.PointLight(accent, 30, 30, 1.5);
    key.position.set(-6, 14, -6);
    scene.add(key);

    const room = new THREE.Mesh(
      new THREE.BoxGeometry(LEG, Y1 - Y0, LEG),
      new THREE.MeshBasicMaterial({ map: gridTexture, side: THREE.BackSide }),
    );
    room.position.set(-LEG / 2, (Y0 + Y1) / 2, -LEG / 2);
    scene.add(room);

    const edge = new THREE.MeshStandardMaterial({ color: "#1b1c22", metalness: 0.8, roughness: 0.3 });
    const face = new THREE.MeshBasicMaterial({ map: boardTexture, toneMapped: false });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(9, 5.06, 0.5), [edge, edge, edge, edge, face, edge]);
    scene.add(slab);

    const r = rng(3);
    const cubes = Array.from({ length: 12 }, () => {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.6, 0.6),
        new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.6 }),
      );
      m.userData = { a: r() * Math.PI * 2, rad: 3 + r() * 3, y: Y0 + 1 + r() * 8, s: 0.3 + r() * 0.4 };
      scene.add(m);
      return m;
    });
    return { scene, slab, cubes };
  }, [boardTexture, gridTexture, accent]);

  useEffect(
    () => () => {
      built.scene.traverse((o) => {
        o.geometry?.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => m?.dispose());
      });
    },
    [built],
  );
  return built;
}

function AnamorphicScreen() {
  const { boardTexture, theme } = useVenue();
  const gl = useThree((s) => s.gl);
  const paintGrid = useMemo(() => paintRoomGrid(theme.accent), [theme.accent]);
  const gridTexture = useStaticTexture(512, 512, paintGrid);
  const virtual = useVirtualScene(boardTexture, gridTexture, theme.accent);

  const { eye, target, material, screen, frame } = useMemo(() => {
    const cam = new THREE.PerspectiveCamera(34, 1.6, 0.1, 200);
    cam.position.set(...SWEET_SPOT);
    cam.lookAt(...SWEET_TARGET);
    cam.updateMatrixWorld();
    const rt = new THREE.WebGLRenderTarget(1600, 1000, { samples: 4 });
    const { geometry, length } = wrapGeometry(0.08, Y0, Y1);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: rt.texture },
        eyeViewProj: { value: new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse) },
        grid: { value: new THREE.Vector2((length * 1000) / PITCH, ((Y1 - Y0) * 1000) / PITCH) },
        gain: { value: 1.2 },
      },
      vertexShader: PROJ_VERT,
      fragmentShader: PROJ_FRAG,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    return {
      eye: cam,
      target: rt,
      material: mat,
      screen: geometry,
      frame: wrapGeometry(0.04, Y0 - 0.35, Y1 + 0.35).geometry,
    };
  }, []);

  useEffect(
    () => () => {
      target.dispose();
      material.dispose();
      screen.dispose();
      frame.dispose();
    },
    [target, material, screen, frame],
  );

  const out = useMemo(() => new THREE.Vector3(1, 0, 1).normalize(), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const { scene, slab, cubes } = virtual;
    const d = 0.5 + 0.5 * Math.sin(t * 0.55);
    slab.position.set(-4.6, 11 + Math.sin(t * 0.9) * 0.4, -4.6).addScaledVector(out, d * 5.2);
    slab.lookAt(eye.position);
    slab.rotateY(Math.sin(t * 0.4) * 0.25);
    cubes.forEach((c) => {
      const { a, rad, y, s } = c.userData;
      const ang = a + t * s;
      c.position.set(-5 + Math.cos(ang) * rad, y + Math.sin(t + a) * 0.6, -5 + Math.sin(ang) * rad);
      c.rotation.set(t * s, t * s * 1.3, 0);
    });
    const previous = gl.getRenderTarget();
    gl.setRenderTarget(target);
    gl.render(scene, eye);
    gl.setRenderTarget(previous);
  });

  return (
    <group>
      <mesh geometry={frame}>
        <meshStandardMaterial color="#0b0c10" metalness={0.5} roughness={0.5} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={screen} material={material} />
    </group>
  );
}

function SweetSpotMarker() {
  const { theme } = useVenue();
  const paint = useCallback(
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = theme.accent;
      ctx.font = "700 64px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("STAND HERE", w / 2, h / 2);
    },
    [theme.accent],
  );
  const label = useStaticTexture(512, 128, paint);
  const ring = React.useRef(null);
  useFrame(({ clock }) => {
    if (ring.current) ring.current.scale.setScalar(1 + 0.12 * Math.sin(clock.elapsedTime * 3));
  });
  return (
    <group position={[SWEET_SPOT[0], 0.05, SWEET_SPOT[2]]}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.7, 0.95, 48]} />
        <meshBasicMaterial color={theme.accent} toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, Math.PI * 0.75]} position={[1.3, 0, 1.3]}>
        <planeGeometry args={[2.4, 0.6]} />
        <meshBasicMaterial map={label} transparent toneMapped={false} />
      </mesh>
    </group>
  );
}

// Footprint x ∈ [-30, 0], z ∈ [-30, 0], its street corner rounded to match the screen.
function CornerBuilding() {
  const material = useWindowMaterial(0, 0, { worldUv: true });
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-30, 0);
    shape.lineTo(-RADIUS, 0);
    shape.absarc(-RADIUS, RADIUS, RADIUS, -Math.PI / 2, 0, false);
    shape.lineTo(0, 30);
    shape.lineTo(-30, 30);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: 42, bevelEnabled: false, curveSegments: 12 });
    // Shape (x, s) extruded along z becomes world (x, height, -s).
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} material={material} />;
}

const LAMPS = [
  [-20, 3],
  [-34, 3],
  [3, -20],
  [3, -34],
  [28, 3],
  [3, 28],
];

export function AnamorphicScene() {
  return (
    <group>
      <Atmosphere background="#05060b" fog="#140f22" density={0.006} />
      <NightSky />
      <hemisphereLight args={["#3b3f66", "#0a0a0a", 0.45]} />
      <ambientLight intensity={0.1} />
      <Ground />
      <Road axis="x" offset={9} />
      <Road axis="z" offset={9} />
      <Traffic axis="x" offset={9} seed={8} perLane={7} />
      <Traffic axis="z" offset={9} seed={12} perLane={7} />
      <StreetLamps positions={LAMPS} />
      <CornerBuilding />
      <AnamorphicScreen />
      <SweetSpotMarker />
      <CityBlocks seed={23} inner={70} />
    </group>
  );
}
