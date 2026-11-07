"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { EYE_HEIGHT_M, floorHeightAt, stepWalk } from "@/lib/event_design";

// The walkthrough's WebGL half. Loaded via next/dynamic from ./plan_3d_viewer.jsx only — three.js never reaches the server bundle.
// Plan (x, y, z-up) maps to three (x, z, y); a plan rotation of θ° clockwise is a three rotation of −θ about Y.

const PALETTE = {
  floor: { color: "#d9d5ce", roughness: 0.95 },
  wall: { color: "#ecebe7", roughness: 0.95 },
  ceiling: { color: "#f3f2ef", roughness: 1 },
  linen: { color: "#f6f5f1", roughness: 0.92 },
  wood: { color: "#6f5440", roughness: 0.7 },
  counter: { color: "#dcd8d0", roughness: 0.55 },
  stage: { color: "#2d2f33", roughness: 0.85 },
  dance: { color: "#1f2023", roughness: 0.35, metalness: 0.1 },
  dark: { color: "#34373c", roughness: 0.8 },
  screen: { color: "#f2f3f5", roughness: 0.6 },
  screenDark: { color: "#101113", roughness: 0.3 },
  frame: { color: "#24262a", roughness: 0.6 },
  metal: { color: "#9aa1ab", roughness: 0.4, metalness: 0.55 },
  drape: { color: "#2f3542", roughness: 1 },
  foliage: { color: "#557a4e", roughness: 0.9 },
  pot: { color: "#c8c2b7", roughness: 0.8 },
  upholstery: { color: "#7b8592", roughness: 0.95 },
  chair: { color: "#8a8e96", roughness: 0.75 },
  door: { color: "#8b7661", roughness: 0.7 },
  exitDoor: { color: "#617f6c", roughness: 0.7 },
  exitSign: { color: "#1f9d55", roughness: 0.6 },
  pillar: { color: "#cfcbc4", roughness: 0.9 },
  decor: { color: "#b9b3a8", roughness: 0.9 },
};

const rad = (deg) => ((Number(deg) || 0) * Math.PI) / 180;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function useKit() {
  const kit = useMemo(() => {
    const materials = Object.fromEntries(
      Object.entries(PALETTE).map(([key, p]) => [
        key,
        new THREE.MeshStandardMaterial({ color: p.color, roughness: p.roughness, metalness: p.metalness || 0 }),
      ]),
    );
    const leg = (x, z) => new THREE.BoxGeometry(0.03, 0.43, 0.03).translate(x, 0.215, z);
    return {
      materials,
      wallMaterial: new THREE.MeshStandardMaterial({ color: PALETTE.wall.color, roughness: 0.95 }),
      doorMaterials: {
        door: new THREE.MeshStandardMaterial({ color: PALETTE.door.color, roughness: 0.7 }),
        exitDoor: new THREE.MeshStandardMaterial({ color: PALETTE.exitDoor.color, roughness: 0.7 }),
      },
      gridMaterial: new THREE.LineBasicMaterial({ color: "#6b6f76", transparent: true, opacity: 0.22 }),
      box: new THREE.BoxGeometry(1, 1, 1),
      cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 40),
      sphere: new THREE.SphereGeometry(0.5, 28, 18),
      plane: new THREE.PlaneGeometry(1, 1),
      chairSeat: new THREE.BoxGeometry(0.44, 0.05, 0.42).translate(0, 0.455, 0),
      chairBack: new THREE.BoxGeometry(0.44, 0.42, 0.04).translate(0, 0.69, 0.19),
      chairLegs: mergeGeometries([leg(-0.19, -0.18), leg(0.19, -0.18), leg(-0.19, 0.18), leg(0.19, 0.18)]),
    };
  }, []);
  useEffect(
    () => () => {
      Object.values(kit.materials).forEach((m) => m.dispose());
      kit.wallMaterial.dispose();
      Object.values(kit.doorMaterials).forEach((m) => m.dispose());
      kit.gridMaterial.dispose();
      ["box", "cylinder", "sphere", "plane", "chairSeat", "chairBack", "chairLegs"].forEach((k) => kit[k].dispose());
    },
    [kit],
  );
  return kit;
}

function Floor({ room, grid, kit }) {
  const floor = useMemo(() => new THREE.ShapeGeometry(new THREE.Shape(room.map(([x, y]) => new THREE.Vector2(x, -y)))), [room]);
  const lines = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(grid.flatMap(([x1, y1, x2, y2]) => [x1, 0.004, y1, x2, 0.004, y2]), 3));
    return g;
  }, [grid]);
  useEffect(() => () => floor.dispose(), [floor]);
  useEffect(() => () => lines.dispose(), [lines]);
  return (
    <group>
      <mesh geometry={floor} material={kit.materials.floor} rotation={[-Math.PI / 2, 0, 0]} />
      <lineSegments geometry={lines} material={kit.gridMaterial} />
    </group>
  );
}

function Ceiling({ room, height, kit }) {
  const geometry = useMemo(() => new THREE.ShapeGeometry(new THREE.Shape(room.map(([x, y]) => new THREE.Vector2(x, y)))), [room]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} material={kit.materials.ceiling} rotation={[Math.PI / 2, 0, 0]} position={[0, height, 0]} />;
}

// Single-sided panels facing into the room: from outside (the dollhouse view) the near walls vanish.
function Walls({ walls, kit }) {
  return walls.map((w, i) => (
    <mesh
      key={i}
      geometry={kit.plane}
      material={w.material === "wall" ? kit.wallMaterial : kit.doorMaterials[w.material] || kit.wallMaterial}
      position={[w.cx, (w.bottom + w.top) / 2, w.cy]}
      rotation={[0, Math.atan2(w.nx, w.ny), 0]}
      scale={[w.len, Math.max(0.01, w.top - w.bottom), 1]}
    />
  ));
}

function Prism({ part, material }) {
  const geometry = useMemo(
    () =>
      new THREE.ExtrudeGeometry(new THREE.Shape(part.points.map(([x, y]) => new THREE.Vector2(x, -y))), {
        depth: part.h,
        bevelEnabled: false,
      }),
    [part],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} material={material} rotation={[-Math.PI / 2, 0, 0]} position={[0, part.z, 0]} />;
}

function Part({ part, kit }) {
  const material = kit.materials[part.material] || kit.materials.decor;
  if (part.shape === "prism") return <Prism part={part} material={material} />;
  return (
    <mesh
      geometry={kit[part.shape] || kit.box}
      material={material}
      position={[part.lx, part.z + part.h / 2, part.ly]}
      scale={[part.w, part.h, part.d]}
    />
  );
}

function SceneObject({ object, kit, onPick }) {
  return (
    <group
      position={[object.x, 0, object.y]}
      rotation={[0, -rad(object.rot), 0]}
      onClick={
        object.viewpoint && onPick
          ? (e) => {
              if (e.delta > 5) return;
              e.stopPropagation();
              onPick(object.viewpoint);
            }
          : undefined
      }
    >
      {object.parts.map((p, i) => (
        <Part key={i} part={p} kit={kit} />
      ))}
    </group>
  );
}

function Chairs({ chairs, kit }) {
  const seat = useRef(null);
  const back = useRef(null);
  const legs = useRef(null);
  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    chairs.forEach((c, i) => {
      dummy.position.set(c.x, 0, c.y);
      dummy.rotation.set(0, -rad(c.rot), 0);
      dummy.updateMatrix();
      for (const ref of [seat, back, legs]) ref.current?.setMatrixAt(i, dummy.matrix);
    });
    for (const ref of [seat, back, legs]) {
      if (!ref.current) continue;
      ref.current.instanceMatrix.needsUpdate = true;
      ref.current.computeBoundingSphere();
    }
  }, [chairs]);
  if (!chairs.length) return null;
  return (
    <group key={chairs.length}>
      <instancedMesh ref={seat} args={[kit.chairSeat, kit.materials.chair, chairs.length]} />
      <instancedMesh ref={back} args={[kit.chairBack, kit.materials.chair, chairs.length]} />
      <instancedMesh ref={legs} args={[kit.chairLegs, kit.materials.metal, chairs.length]} />
    </group>
  );
}

function labelTexture(text) {
  const canvas = document.createElement("canvas");
  const font = "600 44px ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif";
  const ctx = canvas.getContext("2d");
  ctx.font = font;
  const width = Math.ceil(ctx.measureText(text).width) + 48;
  canvas.width = width;
  canvas.height = 76;
  ctx.font = font;
  ctx.fillStyle = "rgba(24, 24, 27, 0.82)";
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(0, 0, width, 76, 18);
  else ctx.rect(0, 0, width, 76);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, width / 2, 40);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { texture, aspect: width / 76 };
}

function Label({ label }) {
  const made = useMemo(() => labelTexture(label.text), [label.text]);
  useEffect(() => () => made.texture.dispose(), [made]);
  const h = 0.3;
  return (
    <sprite position={[label.x, label.z, label.y]} scale={[h * made.aspect, h, 1]} renderOrder={2}>
      <spriteMaterial map={made.texture} transparent depthWrite={false} />
    </sprite>
  );
}

// Camera: orbit (dollhouse) with fly-to, or walk (first person, collision, stages lift the eye). Also takes screenshots.
function Rig({ mode, scene, world, viewpoints, goto, resetNonce, shotNonce, readInput, onShot }) {
  const camera = useThree((s) => s.camera);
  const dom = useThree((s) => s.gl.domElement);
  const controls = useRef(null);
  const flight = useRef(null);
  const walk = useRef(null);
  const walkFlight = useRef(null);
  const euler = useRef(new THREE.Euler(0, 0, 0, "YXZ"));
  const applied = useRef({ goto: null, reset: resetNonce, shot: shotNonce, mode: null });
  const pendingShot = useRef(false);

  const overview = viewpoints.find((v) => v.key === "overview");
  const entrance = viewpoints.find((v) => v.key === "entrance") || viewpoints.find((v) => v.mode === "walk");

  useEffect(() => {
    const c = new OrbitControls(camera, dom);
    Object.assign(c, {
      enableDamping: true,
      dampingFactor: 0.08,
      rotateSpeed: 0.6,
      zoomSpeed: 0.9,
      panSpeed: 0.7,
      minDistance: 1.5,
      maxDistance: Math.max(20, scene.span * 3),
      maxPolarAngle: Math.PI / 2 - 0.04,
      enabled: applied.current.mode !== "walk",
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
  }, [camera, dom, scene.span]);

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const state = applied.current;
    // The walker as the camera stands now — where a fly-in starts from.
    const fromCamera = () => {
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      return {
        x: camera.position.x,
        y: camera.position.z,
        eye: camera.position.y,
        eyeTarget: camera.position.y,
        yaw: Math.atan2(-fwd.x, -fwd.z),
        pitch: Math.asin(clamp(fwd.y, -1, 1)),
      };
    };

    let target = null;
    if (goto && goto.nonce !== state.goto) {
      state.goto = goto.nonce;
      target = viewpoints.find((v) => v.key === goto.key) || null;
    }
    if (resetNonce !== state.reset) {
      state.reset = resetNonce;
      target = mode === "walk" ? entrance : overview;
    }
    const previous = state.mode;
    const switched = mode !== previous;
    state.mode = mode;
    c.enabled = mode === "orbit";

    if (switched && (!target || target.mode !== mode)) {
      if (mode === "walk" && walk.current && previous !== null) {
        // Back to walking: fly from the orbit camera to where the walker left off.
        const resume = { ...walk.current };
        walk.current = fromCamera();
        walkFlight.current = { from: { ...walk.current }, to: resume, t: 0 };
        return;
      }
      target = mode === "walk" ? entrance : overview;
    }
    if (!target) return;

    if (target.mode === "orbit") {
      const toPos = new THREE.Vector3(target.at[0], target.at[2], target.at[1]);
      const toTarget = new THREE.Vector3(target.look[0], target.look[2], target.look[1]);
      if (previous === null) {
        camera.position.copy(toPos);
        c.target.copy(toTarget);
        c.update();
        return;
      }
      let fromTarget = c.target.clone();
      if (switched) {
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        fromTarget = camera.position.clone().add(forward.multiplyScalar(4));
      }
      flight.current = { fromPos: camera.position.clone(), fromTarget, toPos, toTarget, t: 0 };
      return;
    }

    const [x, y, eye] = target.at;
    const [lx, ly, lz] = target.look;
    const to = {
      x,
      y,
      eye,
      eyeTarget: eye,
      yaw: Math.atan2(-(lx - x), -(ly - y)),
      pitch: Math.atan2(lz - eye, Math.max(0.01, Math.hypot(lx - x, ly - y))),
    };
    if (switched || !walk.current) walk.current = fromCamera();
    walkFlight.current = { from: { ...walk.current }, to, t: 0 };
  }, [mode, goto, resetNonce, viewpoints, overview, entrance, camera]);

  useEffect(() => {
    if (shotNonce !== applied.current.shot) {
      applied.current.shot = shotNonce;
      pendingShot.current = true;
    }
  }, [shotNonce]);

  useFrame((state, dt) => {
    const c = controls.current;
    const step = Math.min(dt, 0.1);
    const input = readInput();

    if (mode === "orbit" && c) {
      const f = flight.current;
      if (f) {
        f.t = Math.min(1, f.t + step / 1.2);
        const k = ease(f.t);
        state.camera.position.lerpVectors(f.fromPos, f.toPos, k);
        c.target.lerpVectors(f.fromTarget, f.toTarget, k);
        if (f.t >= 1) flight.current = null;
      }
      c.target.set(
        clamp(c.target.x, scene.bounds.minX, scene.bounds.maxX),
        clamp(c.target.y, 0, scene.ceilingM),
        clamp(c.target.z, scene.bounds.minY, scene.bounds.maxY),
      );
      c.update(step);
      if (state.camera.position.y < 0.3) state.camera.position.setY(0.3);
    } else if (mode === "walk" && walk.current) {
      const w = walk.current;
      const wf = walkFlight.current;
      if (wf) {
        wf.t = Math.min(1, wf.t + step / 0.8);
        const k = ease(wf.t);
        w.x = wf.from.x + (wf.to.x - wf.from.x) * k;
        w.y = wf.from.y + (wf.to.y - wf.from.y) * k;
        w.eye = wf.from.eye + (wf.to.eye - wf.from.eye) * k;
        w.eyeTarget = w.eye;
        w.yaw = wf.from.yaw + wrapAngle(wf.to.yaw - wf.from.yaw) * k;
        w.pitch = wf.from.pitch + (wf.to.pitch - wf.from.pitch) * k;
        if (wf.t >= 1) walkFlight.current = null;
      } else {
        w.yaw -= input.lookDX * 0.0035 + input.turn * 1.8 * step;
        w.pitch = Math.max(-1.25, Math.min(1.25, w.pitch - input.lookDY * 0.0035));
        let fwd = input.forward + input.joyY;
        let side = input.strafe + input.joyX;
        const mag = Math.hypot(fwd, side);
        if (mag > 1) {
          fwd /= mag;
          side /= mag;
        }
        if (mag > 0.01) {
          const speed = (input.run ? 3.2 : 1.5) * step;
          const dx = (-Math.sin(w.yaw) * fwd + Math.cos(w.yaw) * side) * speed;
          const dy = (-Math.cos(w.yaw) * fwd - Math.sin(w.yaw) * side) * speed;
          const [nx, ny] = stepWalk(world, [w.x, w.y], [dx, dy]);
          w.x = nx;
          w.y = ny;
          w.eyeTarget = floorHeightAt(world, [nx, ny]) + EYE_HEIGHT_M;
        }
        w.eye += (w.eyeTarget - w.eye) * Math.min(1, step * 6);
      }
      state.camera.position.set(w.x, w.eye, w.y);
      state.camera.quaternion.setFromEuler(euler.current.set(w.pitch, w.yaw, 0, "YXZ"));
    }

    if (pendingShot.current) {
      pendingShot.current = false;
      state.gl.render(state.scene, state.camera);
      onShot?.(state.gl.domElement.toDataURL("image/png"));
    }
  });

  return null;
}

export default function Plan3DScene({
  scene,
  world,
  viewpoints,
  mode,
  goto,
  resetNonce,
  shotNonce,
  showChairs,
  showLabels,
  showCeiling,
  dark,
  readInput,
  onShot,
  onPick,
}) {
  const overview = viewpoints.find((v) => v.key === "overview");
  const background = dark ? "#18191c" : "#eef0f2";
  return (
    <Canvas
      camera={{ position: [overview.at[0], overview.at[2], overview.at[1]], fov: 60, near: 0.05, far: 4000 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NeutralToneMapping;
      }}
    >
      <color key={background} attach="background" args={[background]} />
      <hemisphereLight args={["#ffffff", "#b8b2a6", 1.35]} />
      <directionalLight position={[scene.centre[0] + scene.span, scene.span * 1.5, scene.centre[1] + scene.span * 0.6]} intensity={1.1} />
      <ambientLight intensity={0.25} />
      <SceneContent
        scene={scene}
        showChairs={showChairs}
        showLabels={showLabels}
        showCeiling={showCeiling}
        onPick={onPick}
      />
      <Rig
        mode={mode}
        scene={scene}
        world={world}
        viewpoints={viewpoints}
        goto={goto}
        resetNonce={resetNonce}
        shotNonce={shotNonce}
        readInput={readInput}
        onShot={onShot}
      />
    </Canvas>
  );
}

function SceneContent({ scene, showChairs, showLabels, showCeiling, onPick }) {
  const kit = useKit();
  return (
    <group>
      <Floor room={scene.room} grid={scene.grid} kit={kit} />
      {showCeiling ? <Ceiling room={scene.room} height={scene.ceilingM} kit={kit} /> : null}
      <Walls walls={scene.walls} kit={kit} />
      {scene.objects.map((o) => (
        <SceneObject key={o.id} object={o} kit={kit} onPick={onPick} />
      ))}
      {showChairs ? <Chairs chairs={scene.chairs} kit={kit} /> : null}
      {showLabels ? scene.labels.map((l) => <Label key={l.id} label={l} />) : null}
    </group>
  );
}
