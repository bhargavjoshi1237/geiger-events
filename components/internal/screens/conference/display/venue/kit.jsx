"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";

import { useVenue } from "./context";

// Scene background + haze. Set on the scene itself because scenes render
// inside groups, where `attach="background"` would miss the root.
export function Atmosphere({ background, fog, density }) {
  const get = useThree((s) => s.get);
  useEffect(() => {
    const { scene } = get();
    const previous = { background: scene.background, fog: scene.fog };
    scene.background = new THREE.Color(background);
    scene.fog = new THREE.FogExp2(fog, density);
    return () => {
      scene.background = previous.background;
      scene.fog = previous.fog;
    };
  }, [get, background, fog, density]);
  return null;
}

// Shared building blocks for the venue scenes: LED surfaces, crowds, moving
// lights, walkers and the night sky. Units are metres, y is up.

// Deterministic PRNG so crowds and cities don't reshuffle on every mount.
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function useDisposable(object) {
  useEffect(() => () => object?.dispose?.(), [object]);
  return object;
}

const LED_VERT = /* glsl */ `
  varying vec2 vUv;
  #ifdef USE_TINT
    attribute vec3 tint;
    varying vec3 vTint;
  #endif
  void main() {
    vUv = uv;
    #ifdef USE_TINT
      vTint = tint;
    #endif
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Up close each LED is a visible dot on black; once a pixel shrinks below a
// screen pixel the dots fade into the plain image, so distance reads correctly.
const LED_FRAG = /* glsl */ `
  uniform sampler2D map;
  uniform vec2 grid;
  uniform float gain;
  uniform vec4 uvRect;
  varying vec2 vUv;
  #ifdef USE_TINT
    varying vec3 vTint;
  #endif
  void main() {
    vec2 cell = vUv * grid;
    vec2 w = fwidth(cell);
    float blend = clamp(max(w.x, w.y) * 2.5 - 0.35, 0.0, 1.0);
    float dotMask = smoothstep(0.5, 0.25, length(fract(cell) - 0.5)) * 2.2;
    float mask = mix(dotMask, 1.0, blend);
    vec2 q = mix((floor(cell) + 0.5) / grid, vUv, blend);
    vec3 color = texture2D(map, uvRect.xy + q * uvRect.zw).rgb * mask * gain;
    #ifdef USE_TINT
      color *= vTint;
    #endif
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

// grid = LED count across the surface's uv; uvRect = texture offset.xy + scale.zw.
export function useLedMaterial(
  texture,
  { grid = [1920, 1080], gain = 1.2, uvRect = [0, 0, 1, 1], tint = false, side = THREE.FrontSide } = {},
) {
  // Callers pass fresh arrays every render, so the material is keyed on their values.
  const key = JSON.stringify([grid, gain, uvRect]);
  const material = useMemo(() => {
    const [g, k, r] = JSON.parse(key);
    return new THREE.ShaderMaterial({
      uniforms: {
        map: { value: texture },
        grid: { value: new THREE.Vector2(g[0], g[1]) },
        gain: { value: k },
        uvRect: { value: new THREE.Vector4(r[0], r[1], r[2], r[3]) },
      },
      vertexShader: LED_VERT,
      fragmentShader: LED_FRAG,
      defines: tint ? { USE_TINT: "" } : {},
      side,
      toneMapped: false,
    });
  }, [texture, tint, side, key]);
  return useDisposable(material);
}

// Ref for an LED mesh whose texture slides sideways every frame, for tickers.
export function useScroll(speed) {
  const mesh = useRef(null);
  useFrame((_, dt) => {
    const uniforms = mesh.current?.material?.uniforms;
    if (uniforms?.uvRect) uniforms.uvRect.value.x += dt * speed;
  });
  return mesh;
}

// pitch in mm; pass null for an LCD, which never shows a pixel grid.
export const ledGrid = (width, height, pitch) =>
  pitch ? [(width * 1000) / pitch, (height * 1000) / pitch] : [1e5, 1e5];

export function LedScreen({
  texture,
  width,
  height,
  pitch = 4,
  gain = 1.2,
  uvRect,
  bezel = 0.08,
  depth = 0.2,
  frameColor = "#0b0c0f",
  ...group
}) {
  const material = useLedMaterial(texture, { grid: ledGrid(width, height, pitch), gain, uvRect });
  return (
    <group {...group}>
      {bezel ? (
        <mesh position={[0, 0, -depth / 2 - 0.004]}>
          <boxGeometry args={[width + bezel * 2, height + bezel * 2, depth]} />
          <meshStandardMaterial color={frameColor} roughness={0.5} metalness={0.5} />
        </mesh>
      ) : null}
      <mesh material={material}>
        <planeGeometry args={[width, height]} />
      </mesh>
    </group>
  );
}

// A cylinder between two points — truss members, cables, poles.
export function Strut({ from, to, radius = 0.06, color = "#2a2c33", metalness = 0.8 }) {
  const { position, quaternion, length } = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const dir = b.clone().sub(a);
    return {
      length: dir.length(),
      position: a.clone().add(b).multiplyScalar(0.5),
      quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()),
    };
  }, [from, to]);
  return (
    <mesh position={position} quaternion={quaternion}>
      <cylinderGeometry args={[radius, radius, length, 8]} />
      <meshStandardMaterial color={color} metalness={metalness} roughness={0.35} />
    </mesh>
  );
}

const CROWD_VERT = /* glsl */ `
  attribute float phase;
  attribute float flash;
  attribute vec3 tone;
  uniform float time;
  uniform float size;
  uniform float lights;
  varying vec3 vColor;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float twinkle = flash * lights * (0.55 + 0.45 * sin(time * 2.3 + phase * 6.2831));
    vColor = tone + vec3(twinkle * 2.4);
    gl_PointSize = min(40.0, size * (1.0 + flash * lights * 0.6) * (300.0 / -mv.z));
  }
`;

const CROWD_FRAG = /* glsl */ `
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(vColor * (1.0 - d * 1.2), 1.0);
    #include <colorspace_fragment>
  }
`;

const CROWD_TONES = [
  [0.05, 0.04, 0.035],
  [0.025, 0.03, 0.06],
  [0.07, 0.025, 0.025],
  [0.035, 0.035, 0.035],
  [0.06, 0.055, 0.045],
];

// Seated crowd as points; a share of them hold up phone lights that twinkle.
export function Crowd({ positions, flashRatio = 0.05, size = 0.3, seed = 7 }) {
  const { showLights } = useVenue();

  const geometry = useMemo(() => {
    const n = positions.length / 3;
    const r = rng(seed);
    const phase = new Float32Array(n);
    const flash = new Float32Array(n);
    const tone = new Float32Array(n * 3);
    for (let i = 0; i < n; i += 1) {
      phase[i] = r();
      flash[i] = r() < flashRatio ? 1 : 0;
      const t = CROWD_TONES[Math.floor(r() * CROWD_TONES.length)];
      const k = 0.6 + r() * 0.9;
      tone.set([t[0] * k, t[1] * k, t[2] * k], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("phase", new THREE.BufferAttribute(phase, 1));
    g.setAttribute("flash", new THREE.BufferAttribute(flash, 1));
    g.setAttribute("tone", new THREE.BufferAttribute(tone, 3));
    return g;
  }, [positions, flashRatio, seed]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { time: { value: 0 }, size: { value: size }, lights: { value: 1 } },
        vertexShader: CROWD_VERT,
        fragmentShader: CROWD_FRAG,
      }),
    [size],
  );

  const points = useRef(null);
  useFrame(({ clock }) => {
    const uniforms = points.current?.material.uniforms;
    if (!uniforms) return;
    uniforms.time.value = clock.elapsedTime;
    uniforms.lights.value = showLights ? 1 : 0.2;
  });

  useDisposable(geometry);
  useDisposable(material);
  return <points ref={points} geometry={geometry} material={material} />;
}

const BEAM_VERT = /* glsl */ `
  uniform float beamLength;
  varying float vFade;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vFade = clamp(-position.y / beamLength, 0.0, 1.0);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const BEAM_FRAG = /* glsl */ `
  uniform vec3 color;
  uniform float intensity;
  varying float vFade;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float rim = pow(abs(dot(vNormal, vView)), 2.0);
    float a = pow(1.0 - vFade, 1.6) * rim * intensity;
    gl_FragColor = vec4(color, a);
    #include <colorspace_fragment>
  }
`;

// A moving-head light: a volumetric cone in haze, aimed at a point and swept.
export function Beam({
  position,
  aim,
  color = "#ffffff",
  length = 20,
  radius = 2,
  sweep = [0.2, 0.2],
  speed = 0.5,
  phase = 0,
  intensity = 0.3,
}) {
  const { showLights } = useVenue();
  const head = useRef(null);

  const geometry = useMemo(() => {
    const g = new THREE.ConeGeometry(radius, length, 32, 1, true);
    g.translate(0, -length / 2, 0);
    return g;
  }, [radius, length]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          color: { value: new THREE.Color(color) },
          intensity: { value: intensity },
          beamLength: { value: length },
        },
        vertexShader: BEAM_VERT,
        fragmentShader: BEAM_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    [color, intensity, length],
  );

  const quaternion = useMemo(() => {
    const dir = new THREE.Vector3(...aim).sub(new THREE.Vector3(...position)).normalize();
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
  }, [aim, position]);

  useFrame(({ clock }) => {
    if (!head.current) return;
    const t = clock.elapsedTime * speed + phase;
    head.current.rotation.x = Math.sin(t) * sweep[0];
    head.current.rotation.z = Math.cos(t * 0.8) * sweep[1];
  });

  useDisposable(geometry);
  useDisposable(material);
  if (!showLights) return null;
  return (
    <group position={position} quaternion={quaternion}>
      <group ref={head}>
        <mesh geometry={geometry} material={material} />
        <mesh>
          <sphereGeometry args={[0.22, 12, 8]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

// Ring of lamps on a truss; when show lights are on they run a chase.
export function BulbRing({ radius, y, count = 64, color = "#ffd9a0", size = 0.1, glow = 3 }) {
  const { showLights } = useVenue();
  const mesh = useRef(null);
  const base = useMemo(() => new THREE.Color(color), [color]);
  const tmp = useMemo(() => new THREE.Color(), []);

  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const o = new THREE.Object3D();
    for (let i = 0; i < count; i += 1) {
      const a = (i / count) * Math.PI * 2;
      o.position.set(Math.sin(a) * radius, y, Math.cos(a) * radius);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, base);
    }
    m.instanceMatrix.needsUpdate = true;
  }, [count, radius, y, base]);

  useFrame(({ clock }) => {
    const m = mesh.current;
    if (!m) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < count; i += 1) {
      const k = showLights ? 0.25 + 0.75 * Math.pow(0.5 + 0.5 * Math.sin(t * 3 - i * 0.45), 4) : 0.8;
      m.setColorAt(i, tmp.copy(base).multiplyScalar(k * glow));
    }
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
      <sphereGeometry args={[size, 8, 6]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

const WALKER_TONES = ["#2b2f3a", "#3a2f2a", "#23262d", "#402a30", "#2d3a35", "#4a4a52"];

// Pedestrians crossing along x, wrapping at the ends of their span.
export function Walkers({ count = 12, span = [-10, 10], lanes = [2, 8], seed = 3, y = 0, axis = "x" }) {
  const mesh = useRef(null);
  const [people] = useState(() => {
    const r = rng(seed);
    return Array.from({ length: count }, () => ({
      along: span[0] + r() * (span[1] - span[0]),
      across: lanes[0] + r() * (lanes[1] - lanes[0]),
      speed: (0.9 + r() * 0.6) * (r() > 0.5 ? 1 : -1),
      height: 1.55 + r() * 0.35,
      bob: r() * 6.28,
      tone: WALKER_TONES[Math.floor(r() * WALKER_TONES.length)],
    }));
  });
  const along = useRef(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    along.current = Float32Array.from(people.map((p) => p.along));
    const m = mesh.current;
    const c = new THREE.Color();
    people.forEach((p, i) => m.setColorAt(i, c.set(p.tone)));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [people]);

  useFrame((_, dt) => {
    const m = mesh.current;
    const pos = along.current;
    if (!m || !pos) return;
    const width = span[1] - span[0];
    people.forEach((p, i) => {
      pos[i] += p.speed * Math.min(dt, 0.05);
      if (pos[i] > span[1]) pos[i] -= width;
      if (pos[i] < span[0]) pos[i] += width;
      const lift = Math.abs(Math.sin(pos[i] * 3 + p.bob)) * 0.03;
      if (axis === "x") dummy.position.set(pos[i], y + p.height / 2 + lift, p.across);
      else dummy.position.set(p.across, y + p.height / 2 + lift, pos[i]);
      dummy.scale.set(1, p.height / 1.4, 1);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} frustumCulled={false}>
      <capsuleGeometry args={[0.2, 1, 4, 10]} />
      <meshStandardMaterial roughness={0.85} />
    </instancedMesh>
  );
}

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAG = /* glsl */ `
  uniform vec3 horizon;
  uniform vec3 zenith;
  uniform vec3 glow;
  varying vec3 vDir;
  void main() {
    float h = max(vDir.y, 0.0);
    vec3 c = mix(horizon, zenith, pow(h, 0.45));
    c += glow * exp(-h * 9.0) * 0.8;
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }
`;

// Night gradient dome with city glow on the horizon and a field of stars.
export function NightSky({ horizon = "#1d1733", zenith = "#020309", glow = "#40243a" }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          horizon: { value: new THREE.Color(horizon) },
          zenith: { value: new THREE.Color(zenith) },
          glow: { value: new THREE.Color(glow) },
        },
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    [horizon, zenith, glow],
  );

  const stars = useMemo(() => {
    const r = rng(42);
    const pts = new Float32Array(1400 * 3);
    for (let i = 0; i < 1400; i += 1) {
      const a = r() * Math.PI * 2;
      const y = 0.12 + r() * 0.88;
      const s = Math.sqrt(1 - y * y);
      pts.set([Math.cos(a) * s * 420, y * 420, Math.sin(a) * s * 420], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pts, 3));
    return g;
  }, []);

  useDisposable(material);
  useDisposable(stars);
  return (
    <group>
      <mesh material={material} renderOrder={-1}>
        <sphereGeometry args={[450, 32, 16]} />
      </mesh>
      <points geometry={stars}>
        <pointsMaterial color="#cdd6ff" size={1.3} sizeAttenuation={false} fog={false} />
      </points>
    </group>
  );
}
