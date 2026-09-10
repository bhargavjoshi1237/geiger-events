import * as THREE from "three";

const SEGMENTS = 48;
const FOLD_SEGMENTS = 12;
const ROWS = SEGMENTS + FOLD_SEGMENTS + 1;
const FOLD_RADIUS = 0.085;
// The band lies face-on to the camera wherever the clip doesn't twist it.
const FACING = new THREE.Vector3(0, 0, 1);

// World-space webbing with a folded hem around the loop's top bar. Unlike a
// screen-facing line, this has surface normals and a real, lit attachment.
export function createRibbonGeometry(width, tileLength) {
  const geometry = new THREE.BufferGeometry();
  const position = new THREE.BufferAttribute(new Float32Array(ROWS * 6), 3);
  const uv = new THREE.BufferAttribute(new Float32Array(ROWS * 4), 2);
  position.setUsage(THREE.DynamicDrawUsage);
  uv.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("position", position);
  geometry.setAttribute("uv", uv);
  const indices = [];
  for (let i = 0; i < ROWS - 1; i += 1) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  geometry.setIndex(indices);

  const point = new THREE.Vector3();
  const previous = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const across = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const tip = new THREE.Vector3();
  const down = new THREE.Vector3();
  const endAcross = new THREE.Vector3();
  const endNormal = new THREE.Vector3();

  // `end` is the clip's frame ({ right, up, normal }); the band twists into it over its last stretch.
  function update(curve, end) {
    curve.getPoint(1, tip);
    down.set(-end.up.x, -end.up.y, -end.up.z);
    endAcross.set(end.right.x, end.right.y, end.right.z);
    endNormal.set(end.normal.x, end.normal.y, end.normal.z);
    let length = 0;
    for (let i = 0; i < ROWS; i += 1) {
      if (i <= SEGMENTS) {
        const t = i / SEGMENTS;
        curve.getPoint(t, point);
        curve.getTangent(t, tangent);
        across.crossVectors(FACING, tangent);
        if (across.lengthSq() < 1e-8) across.copy(endAcross);
        across.normalize().lerp(endAcross, THREE.MathUtils.smoothstep(t, 0.75, 1)).normalize();
        normal.crossVectors(tangent, across).normalize();
        point.addScaledVector(normal, FOLD_RADIUS);
      } else {
        const angle = ((i - SEGMENTS) / FOLD_SEGMENTS) * Math.PI;
        point.copy(tip)
          .addScaledVector(down, Math.sin(angle) * FOLD_RADIUS)
          .addScaledVector(endNormal, Math.cos(angle) * FOLD_RADIUS);
        across.copy(endAcross);
      }
      if (i) length += point.distanceTo(previous);
      previous.copy(point);
      for (let side = 0; side < 2; side += 1) {
        const offset = (side - 0.5) * width;
        position.setXYZ(i * 2 + side,
          point.x + across.x * offset, point.y + across.y * offset, point.z + across.z * offset);
        // Keep the existing tile orientation: u runs down, v=1 is screen-left.
        uv.setXY(i * 2 + side, length / tileLength, 1 - side);
      }
    }
    position.needsUpdate = true;
    uv.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
  }

  return { geometry, update };
}
