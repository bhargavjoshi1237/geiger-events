"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Canvas, events, useFrame, useLoader } from "@react-three/fiber";
import { createRibbonGeometry } from "./ribbon_geometry";
import { StudioEnvironment, useHolderMaterials } from "./lanyard_materials";

import { createLanyard } from "@/lib/passes/lanyard_physics";
import { usePassTexture, useRibbonTexture } from "./use_pass_textures";

// The hanging pass scene only; physics in lib/passes/lanyard_physics.js, loaded client-only via ./lanyard_badge.jsx.

const MODEL_URL = `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/models/tag.glb`;

// Landmarks measured off tag.glb, in its own units. The card hangs from a
// plastic clamp, which hangs from a metal clip; the strap threads the clip's
// loop.
const MODEL = {
  cardTop: 1.023,
  cardBottom: 0.023,
  cardHalfWidth: 0.3582,
  // The clamp's top and the clip's bottom meet exactly here: it is the swivel
  // the holder turns on. Everything below it spins with the card, the clip
  // above it stays lined up with the strap, the way real badge hardware works.
  hinge: 1.1183,
  loopTop: 1.2294,
};
const CARD_CENTRE = (MODEL.cardTop + MODEL.cardBottom) / 2;

// The tutorial model's clip is far too small for webbing this wide — its loop
// is barely a third of the strap's width, which is why threading it once needed
// the band tapered down to a tail. Enlarging the clip about the hinge instead
// brings the opening out to the strap's own width and leaves the hook reading a
// little wider than the webbing, the way real lanyard hardware is proportioned.
const CLIP_SCALE = 1.65;
const CLAMP_GIRTH = 1.5;
const atClip = (y) => MODEL.hinge + (y - MODEL.hinge) * CLIP_SCALE;

// Attach to the upper bar; the folded hem leaves the loop opening clear.
const STRAP_THROUGH = atClip(MODEL.loopTop) - 0.004;

// How tall the whole holder should be on screen, and where its card should sit.
// The camera frames roughly y -2.9 .. 2.9; at 3.7 the card fills a little over
// half of that and the strap takes the rest, which is the proportion a worn
// badge actually reads at.
const ASSEMBLY_HEIGHT = 3.7;
const MODEL_SCALE = ASSEMBLY_HEIGHT / (STRAP_THROUGH - MODEL.cardBottom);
const CARD_CENTRE_Y = -0.55;
// Where the strap ends and the holder pivots.
const PIVOT_Y = CARD_CENTRE_Y - MODEL_SCALE * (CARD_CENTRE - STRAP_THROUGH);
// Just past the top of the frame, so the strap runs off the edge rather than
// starting at a visible knot.
const ANCHOR_Y = 2.9;
const STRAP = ANCHOR_Y - PIVOT_Y;
// The clip is a link from the strap to the swivel; the card hangs off the swivel, all in world units.
const CLIP_LENGTH = (STRAP_THROUGH - MODEL.hinge) * MODEL_SCALE;
const CARD_DROP = (MODEL.hinge - CARD_CENTRE) * MODEL_SCALE;
const CARD_HALF_WIDTH = MODEL.cardHalfWidth * MODEL_SCALE;

const STRAP_NODES = 12;
// Camera framing; ribbon width is measured in world units.
const CAMERA_FOV = 25;
const CAMERA_Z = 13;
// Roughly a quarter of the card's width, the way real webbing sits against a
// badge holder.
const BAND_WIDTH = 0.56;

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

function Lanyard({ template, event, attendee, qrSettings, facing = "front" }) {
  const holder = useHolder();
  const texture = usePassTexture({ template, event, attendee, qrSettings });
  const ribbon = useRibbonTexture();
  const { card: cardMaterial, clip: clipMaterial, clamp: clampMaterial } = useHolderMaterials(texture);
  const clipBody = useRef(null);
  const cardBody = useRef(null);

  // Keep the full wordmark above the folded hem at rest, with fixed print
  // spacing as the rope stretches during a drag.
  const tileLength = useMemo(() => {
    const image = ribbon?.image;
    return image?.height ? (image.width / image.height) * BAND_WIDTH * 0.9 : BAND_WIDTH;
  }, [ribbon]);
  const band = useMemo(() => createRibbonGeometry(BAND_WIDTH, tileLength), [tileLength]);
  useEffect(() => () => band.geometry.dispose(), [band]);
  const [grabbed, setGrabbed] = useState(false);
  const [hovering, setHovering] = useState(false);

  const lanyard = useMemo(
    () =>
      createLanyard({
        anchor: { x: 0, y: ANCHOR_Y, z: 0 },
        strapLength: STRAP,
        strapNodes: STRAP_NODES,
        clipLength: CLIP_LENGTH,
        cardDrop: CARD_DROP,
        cardHalfWidth: CARD_HALF_WIDTH,
      }),
    [],
  );

  const curve = useMemo(() => {
    const built = new THREE.CatmullRomCurve3(
      lanyard.strap.map((p) => new THREE.Vector3(p.x, p.y, p.z)),
    );
    built.curveType = "chordal";
    return built;
  }, [lanyard]);

  // Scratch objects, kept out of the frame loop so it allocates nothing.
  const scratch = useMemo(
    () => ({
      ray: new THREE.Raycaster(),
      plane: new THREE.Plane(),
      point: new THREE.Vector3(),
      basis: new THREE.Matrix4(),
      right: new THREE.Vector3(),
      up: new THREE.Vector3(),
      normal: new THREE.Vector3(),
    }),
    [],
  );

  useEffect(() => {
    lanyard.setFacing(facing === "back" ? Math.PI : 0);
  }, [facing, lanyard]);

  // Releasing the pointer outside the canvas would otherwise leave the card stuck to the cursor.
  useEffect(() => {
    if (!grabbed) return undefined;
    const drop = () => {
      lanyard.release();
      setGrabbed(false);
    };
    window.addEventListener("pointerup", drop);
    window.addEventListener("pointercancel", drop);
    return () => {
      window.removeEventListener("pointerup", drop);
      window.removeEventListener("pointercancel", drop);
    };
  }, [grabbed, lanyard]);

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

  // Poses a body group from a solver frame ({ origin, right, up, normal }).
  const place = (object, frame) => {
    const { basis, right, up, normal } = scratch;
    basis.makeBasis(right.copy(frame.right), up.copy(frame.up), normal.copy(frame.normal));
    object.position.copy(frame.origin);
    object.quaternion.setFromRotationMatrix(basis);
  };

  useFrame((state, delta) => {
    if (grabbed) {
      // The pointer's ray, met with the depth plane the card was grabbed at.
      const { ray, plane, point } = scratch;
      ray.setFromCamera(state.pointer, state.camera);
      if (ray.ray.intersectPlane(plane, point)) lanyard.drag(point);
    }

    lanyard.step(delta);

    lanyard.strap.forEach((node, i) => curve.points[i].set(node.x, node.y, node.z));
    band.update(curve, lanyard.clip);

    if (clipBody.current) place(clipBody.current, lanyard.clip);
    if (cardBody.current) place(cardBody.current, lanyard.card);
  });

  const startDrag = (e) => {
    e.stopPropagation();
    // The grabbed point stays under the pointer, dragged in the screen-parallel plane it was picked at.
    const depth = lanyard.grab(e.point);
    scratch.plane.set(scratch.normal.set(0, 0, 1), -depth);
    setGrabbed(true);
  };

  return (
    <>
      <mesh geometry={band.geometry} frustumCulled={false}>
        <meshStandardMaterial map={ribbon} roughness={0.95} metalness={0} side={THREE.DoubleSide} envMapIntensity={0.6} />
      </mesh>

      {/* The clip, swinging from the strap's end; enlarged about the hinge so its loop matches the webbing. */}
      <group ref={clipBody}>
        <group scale={MODEL_SCALE} position={[0, -STRAP_THROUGH * MODEL_SCALE, 0]}>
          <group position={[0, MODEL.hinge, 0]} scale={CLIP_SCALE}>
            <group position={[0, -MODEL.hinge, 0]}>
              <mesh geometry={holder.clip?.geometry} material={clipMaterial} />
            </group>
          </group>
        </group>
      </group>

      {/* The clamp and card, one rigid body hung from the swivel at the clip's foot. */}
      <group ref={cardBody}>
        <group scale={MODEL_SCALE} position={[0, -MODEL.hinge * MODEL_SCALE, 0]}>
          {/* Thickened across only, so the gripper doesn't read as wire without pushing the card down. */}
          <mesh
            geometry={holder.clamp?.geometry}
            material={clampMaterial}
            scale={[CLAMP_GIRTH, 1, CLAMP_GIRTH]}
          />
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

function ViewerCamera({ zoom, fitToViewport }) {
  useFrame(({ camera, size }, delta) => {
    const fit = fitToViewport ? Math.min(1, size.width / size.height / 0.72) : 1;
    const target = fit * zoom;
    if (Math.abs(camera.zoom - target) < 0.0001) return;
    camera.zoom = THREE.MathUtils.damp(camera.zoom, target, 10, delta);
    camera.updateProjectionMatrix();
  });
  return null;
}

// R3F finishes configuring its root asynchronously. Closing a dialog can
// detach the canvas before its pending event connection runs.
function sceneEvents(store) {
  const manager = events(store);
  return {
    ...manager,
    connect(target) {
      if (target?.isConnected) manager.connect(target);
    },
  };
}

export default function LanyardScene({ dpr = [1, 2], zoom = 1, fitToViewport = false, ...props }) {
  return (
    <Canvas
      camera={{ position: [0, 0, CAMERA_Z], fov: CAMERA_FOV }}
      gl={{ alpha: true, antialias: true }}
      dpr={dpr}
      events={sceneEvents}
    >
      <ViewerCamera zoom={zoom} fitToViewport={fitToViewport} />
      <StudioEnvironment />
      <ambientLight intensity={0.25} />
      <spotLight position={[-3, 4, 5]} angle={0.65} penumbra={1} intensity={50} decay={2} />
      <pointLight position={[4, -1, 5]} intensity={5} decay={2} />
      <directionalLight position={[0, 2.5, -6]} intensity={0.7} />
      <Suspense fallback={null}>
        <Lanyard {...props} />
      </Suspense>
    </Canvas>
  );
}
