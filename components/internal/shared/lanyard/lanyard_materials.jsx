"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";

// A dark studio with a broad key and narrow edge reflections. RoomEnvironment
// fills nearly every reflection direction and turns black laminate grey.
export function StudioEnvironment() {
  const gl = useThree((state) => state.gl);
  const target = useMemo(() => {
    const studio = new THREE.Scene();
    studio.background = new THREE.Color("#000000");
    const panels = [
      { position: [0, 0, 6], size: [6, 8], intensity: 0.25 },
      { position: [-3, 4, 5], size: [3, 4], intensity: 2 },
      { position: [5, 1, 1], size: [2.5, 5], intensity: 2 },
      { position: [-4, 0, -3], size: [2, 4], intensity: 1 },
    ].map(({ position, size, intensity }) => {
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(...size),
        new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(intensity), side: THREE.DoubleSide }),
      );
      panel.position.set(...position);
      panel.lookAt(0, 0, 0);
      studio.add(panel);
      return panel;
    });
    const pmrem = new THREE.PMREMGenerator(gl);
    const built = pmrem.fromScene(studio, 0.025);
    pmrem.dispose();
    for (const panel of panels) {
      panel.geometry.dispose();
      panel.material.dispose();
    }
    return built;
  }, [gl]);
  useEffect(() => () => target.dispose(), [target]);
  return <primitive attach="environment" object={target.texture} />;
}

export function useHolderMaterials(texture) {
  const materials = useMemo(() => ({
    card: new THREE.MeshPhysicalMaterial({
      map: texture || null,
      color: texture ? "#ffffff" : "#101010",
      roughness: 0.48, metalness: 0,
      clearcoat: 0.28, clearcoatRoughness: 0.32,
      envMapIntensity: 0.6,
    }),
    clip: new THREE.MeshStandardMaterial({
      color: "#555555", metalness: 0.8, roughness: 0.32, envMapIntensity: 1.3,
      side: THREE.DoubleSide,
    }),
    clamp: new THREE.MeshStandardMaterial({
      color: "#242424", metalness: 0.15, roughness: 0.48, envMapIntensity: 0.8,
      side: THREE.DoubleSide,
    }),
  }), [texture]);
  useEffect(() => () => Object.values(materials).forEach((material) => material.dispose()), [materials]);
  return materials;
}
