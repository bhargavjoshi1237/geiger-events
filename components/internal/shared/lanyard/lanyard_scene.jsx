"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { Canvas, extend, useFrame, useLoader, useThree } from "@react-three/fiber";
import { MeshLineGeometry, MeshLineMaterial } from "meshline";

import { createRope, createSpin } from "@/lib/passes/lanyard_physics";
import { RIBBON_TILE_ASPECT } from "@/lib/passes/textures";
import { usePassTexture, useRibbonTexture } from "./use_pass_textures";

// The hanging pass, after Vercel's interactive 3D event badge: the real badge
// holder — card, plastic clamp and metal clip ring — on a strap solved as a
// rope, with a drag that steers the clip by hand until you let go.
//
// The solver lives in lib/passes/lanyard_physics.js and the card artwork in
// lib/passes/textures.js; this file is only the scene. Loaded through
// next/dynamic by ./lanyard_badge.jsx — three.js must never reach the server
// render or the shared client bundle.

extend({ MeshLineGeometry, MeshLineMaterial });

const MODEL_URL = `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/models/tag.glb`;

// Landmarks measured off tag.glb, in its own units. The card hangs from a
// plastic clamp, which hangs from a metal ring; the strap threads through the
// ring a little above its centre.
const MODEL = {
  cardTop: 1.023,
  cardBottom: 0.023,
  strapThrough: 1.19,
};
const CARD_CENTRE = (MODEL.cardTop + MODEL.cardBottom) / 2;

// How tall the whole holder should be on screen, and where its card should sit.
// The camera frames roughly y -2.9 .. 2.9; at 3.7 the card fills a little over
// half of that and the strap takes the rest, which is the proportion a worn
// badge actually reads at.
const ASSEMBLY_HEIGHT = 3.7;
const MODEL_SCALE = ASSEMBLY_HEIGHT / (MODEL.strapThrough - MODEL.cardBottom);
const CARD_CENTRE_Y = -0.55;
// Where the strap ends and the holder pivots.
const PIVOT_Y = CARD_CENTRE_Y - MODEL_SCALE * (CARD_CENTRE - MODEL.strapThrough);
// Just past the top of the frame, so the strap runs off the edge rather than
// starting at a visible knot.
const ANCHOR_Y = 2.9;
const STRAP = ANCHOR_Y - PIVOT_Y;

const ROPE_NODES = 5;
// Roughly a fifth of the card's width, the way real webbing sits against a
// badge holder.
const BAND_WIDTH = 0.42;

// A breath of air, so an untouched pass reads as hanging rather than pinned to
// the glass. Tuned to drift under a tenth of a world unit — any more and it
// looks like it is being blown around.
const WIND = 0.01;
const WIND_RATE = 0.7;
// How hard a sideways swing sets the card turning. At 8 a firm flick carries it
// past 90° so the back comes into view, while a nudge barely moves it.
const SPIN_PER_SWAY = 8;

// A neutral studio reflection, generated on the GPU rather than fetched, so the
// card's clearcoat has something to catch without shipping an HDR asset.
// Attached declaratively, so R3F puts it on the scene and takes it off again.
function StudioEnvironment() {
  const gl = useThree((state) => state.gl);

  const target = useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const built = pmrem.fromScene(new RoomEnvironment(), 0.04);
    pmrem.dispose();
    return built;
  }, [gl]);

  useEffect(() => () => target.dispose(), [target]);

  return <primitive attach="environment" object={target.texture} />;
}

// The three meshes of the badge holder, pulled out of the loaded model by name.
// `useLoader` caches the glTF across every showcase on the page, so nothing it
// returns may be mutated — the materials below are all our own.
function useHolder() {
  const gltf = useLoader(GLTFLoader, MODEL_URL);
  return useMemo(() => {
    const parts = {};
    gltf.scene.traverse((object) => {
      if (object.isMesh) parts[object.name] = object;
    });
    return parts;
  }, [gltf]);
}

// Laminated card stock: a clearcoat over the print, with a faint iridescence so
// turning it catches the light the way a real laminate does.
function useCardMaterial(texture) {
  const material = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        map: texture || null,
        color: texture ? "#ffffff" : "#1b1b1b",
        roughness: 0.28,
        metalness: 0.12,
        clearcoat: 1,
        clearcoatRoughness: 0.14,
        iridescence: 0.35,
        iridescenceIOR: 1.28,
        side: THREE.DoubleSide,
      }),
    [texture],
  );
  useEffect(() => () => material.dispose(), [material]);
  return material;
}

// Dark anodised hardware for the clip ring and the clamp.
function useHardwareMaterial() {
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#2b2d31",
        metalness: 0.92,
        roughness: 0.26,
        side: THREE.DoubleSide,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);
  return material;
}

function Lanyard({ template, event, attendee, qrSettings }) {
  const holder = useHolder();
  const texture = usePassTexture({ template, event, attendee, qrSettings });
  const ribbon = useRibbonTexture();
  const cardMaterial = useCardMaterial(texture);
  const hardware = useHardwareMaterial();

  const size = useThree((state) => state.size);

  const band = useRef(null);
  const pivot = useRef(null);
  const [grabbed, setGrabbed] = useState(false);
  const [hovering, setHovering] = useState(false);

  const rope = useMemo(
    () =>
      createRope({
        nodes: ROPE_NODES,
        segment: STRAP / (ROPE_NODES - 1),
        anchor: { x: 0, y: ANCHOR_Y, z: 0 },
      }),
    [],
  );
  const spin = useMemo(() => createSpin(), []);

  const curve = useMemo(() => {
    const built = new THREE.CatmullRomCurve3(
      Array.from({ length: ROPE_NODES }, () => new THREE.Vector3()),
    );
    built.curveType = "chordal";
    return built;
  }, []);

  // The band is rebuilt from the rope every frame, but it must not be handed to
  // the renderer empty on the very first one — seed it with the hanging pose.
  const seedPoints = useMemo(
    () => rope.points.map((p) => new THREE.Vector3(p.x, p.y, p.z)),
    [rope],
  );

  // Scratch vectors, kept out of the frame loop so it allocates nothing.
  const scratch = useMemo(
    () => ({
      point: new THREE.Vector3(),
      dir: new THREE.Vector3(),
      grab: new THREE.Vector3(),
    }),
    [],
  );

  // Releasing the pointer outside the canvas would otherwise leave the card
  // stuck to the cursor, so the drag ends on a window-level release.
  useEffect(() => {
    if (!grabbed) return undefined;
    const drop = () => {
      rope.release();
      setGrabbed(false);
    };
    window.addEventListener("pointerup", drop);
    window.addEventListener("pointercancel", drop);
    return () => {
      window.removeEventListener("pointerup", drop);
      window.removeEventListener("pointercancel", drop);
    };
  }, [grabbed, rope]);

  // One place decides the cursor, so a drag that ends over the card falls back
  // to "grab" rather than to nothing.
  useEffect(() => {
    const cursor = grabbed ? "grabbing" : hovering ? "grab" : "";
    if (!cursor) return undefined;
    document.body.style.cursor = cursor;
    return () => {
      document.body.style.cursor = "";
    };
  }, [grabbed, hovering]);

  useFrame((state, delta) => {
    if (grabbed) {
      // Where the pointer is, on the plane the card hangs in.
      const { point, dir } = scratch;
      point.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera);
      dir.copy(point).sub(state.camera.position).normalize();
      point.add(dir.multiplyScalar(state.camera.position.length()));
      rope.hold({ x: point.x - scratch.grab.x, y: point.y - scratch.grab.y, z: 0 });
    }

    rope.step(delta, { wind: Math.sin(state.clock.elapsedTime * WIND_RATE) * WIND });

    // A sideways swing sets the card turning; the spring walks it back to facing
    // forward once the swinging stops.
    spin.push(rope.sway() * SPIN_PER_SWAY);
    const turn = spin.step(delta);

    if (band.current) {
      for (let i = 0; i < ROPE_NODES; i += 1) {
        const node = rope.points[i];
        curve.points[i].set(node.x, node.y, node.z);
      }
      band.current.geometry.setPoints(curve.getPoints(48));
    }

    if (pivot.current) {
      pivot.current.position.set(rope.end.x, rope.end.y, rope.end.z);
      // ZYX applies the spin in the holder's own frame and the strap's lean in
      // the screen plane on top of it, so a turned card still hangs off the
      // strap correctly instead of tipping into depth.
      pivot.current.rotation.set(0, turn, rope.tilt(), "ZYX");
    }
  });

  const startDrag = (e) => {
    e.stopPropagation();
    // Grabbing the card by a corner has to keep that corner under the pointer,
    // so the offset from the pivot is held for the length of the drag.
    scratch.grab.copy(e.point).sub(pivot.current.position);
    setGrabbed(true);
  };

  return (
    <>
      <mesh ref={band}>
        <meshLineGeometry points={seedPoints} />
        <meshLineMaterial
          map={ribbon}
          useMap={1}
          // Tile along the strap at the texture's own aspect, so the mark
          // repeats evenly instead of stretching.
          repeat={[STRAP / (BAND_WIDTH * RIBBON_TILE_ASPECT), 1]}
          lineWidth={BAND_WIDTH}
          resolution={[size.width, size.height]}
          color="#ffffff"
        />
      </mesh>

      {/* The holder, hung so the point the strap threads through sits on the
          pivot the rope steers. */}
      <group ref={pivot}>
        <group scale={MODEL_SCALE} position={[0, -MODEL.strapThrough * MODEL_SCALE, 0]}>
          <mesh geometry={holder.clip?.geometry} material={hardware} />
          <mesh geometry={holder.clamp?.geometry} material={hardware} />
          <mesh
            geometry={holder.card?.geometry}
            material={cardMaterial}
            onPointerDown={startDrag}
            onPointerOver={() => setHovering(true)}
            onPointerOut={() => setHovering(false)}
          />
        </group>
      </group>
    </>
  );
}

export default function LanyardScene(props) {
  return (
    <Canvas
      camera={{ position: [0, 0, 13], fov: 25 }}
      gl={{ alpha: true, antialias: true }}
      dpr={[1, 2]}
    >
      <StudioEnvironment />
      <ambientLight intensity={0.55} />
      {/* Key, fill, and a rim behind the card to pick out its edge — the lift
          that makes the laminate read as a physical object. */}
      <directionalLight position={[4, 6, 6]} intensity={2.2} />
      <directionalLight position={[-5, 1, 3]} intensity={0.6} />
      <directionalLight position={[0, 2, -6]} intensity={1.6} />
      <Suspense fallback={null}>
        <Lanyard {...props} />
      </Suspense>
    </Canvas>
  );
}
