"use client";

// The lanyard's motion, as a plain verlet rope. Vercel's 3D badge article models
// the strap as three rope joints between Rapier rigid bodies; this reaches the
// same behaviour — a chain that hangs, swings and can be dragged by its end —
// with a solver small enough to read in one sitting and no WASM physics engine
// on a screen that only ever simulates five particles.
//
// Everything here is framework- and renderer-agnostic: plain {x,y,z} points the
// scene copies into a curve each frame.

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

const vec = (x = 0, y = 0, z = 0) => ({ x, y, z });

// A rope of `nodes` particles hanging from `anchor`. Node 0 is pinned; the last
// node is the clip the card hangs from, and is what a drag steers.
export function createRope({
  nodes = 5,
  segment = 0.42,
  anchor = vec(0, 2.6, 0),
  gravity = -14,
  // Velocity retained per frame. Low enough that a flicked pass settles in a
  // couple of seconds rather than swinging forever.
  damping = 0.94,
  // Constraint relaxation passes. More is stiffer; 12 makes the strap read as
  // webbing rather than elastic.
  iterations = 12,
} = {}) {
  const points = [];
  const previous = [];
  for (let i = 0; i < nodes; i += 1) {
    points.push(vec(anchor.x, anchor.y - segment * i, anchor.z));
    previous.push(vec(anchor.x, anchor.y - segment * i, anchor.z));
  }

  const last = nodes - 1;
  // Set while dragging: the clip is steered instead of simulated, mirroring the
  // article's swap from a dynamic body to a kinematic one.
  let held = null;

  const integrate = (dt) => {
    for (let i = 1; i < nodes; i += 1) {
      if (held && i === last) continue;
      const p = points[i];
      const prev = previous[i];
      const vx = (p.x - prev.x) * damping;
      const vy = (p.y - prev.y) * damping;
      const vz = (p.z - prev.z) * damping;
      prev.x = p.x;
      prev.y = p.y;
      prev.z = p.z;
      p.x += vx;
      p.y += vy + gravity * dt * dt;
      p.z += vz;
    }
  };

  const constrain = () => {
    for (let pass = 0; pass < iterations; pass += 1) {
      for (let i = 0; i < last; i += 1) {
        const a = points[i];
        const b = points[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dz = b.z - a.z;
        const dist = Math.hypot(dx, dy, dz) || 1e-6;
        const shift = (dist - segment) / dist / 2;
        const ox = dx * shift;
        const oy = dy * shift;
        const oz = dz * shift;
        // The anchor never moves, and neither does a held clip — those ends take
        // none of the correction, so the whole of it lands on their neighbour.
        const aFixed = i === 0;
        const bFixed = held && i + 1 === last;
        if (!aFixed) {
          a.x += ox * (bFixed ? 2 : 1);
          a.y += oy * (bFixed ? 2 : 1);
          a.z += oz * (bFixed ? 2 : 1);
        }
        if (!bFixed) {
          b.x -= ox * (aFixed ? 2 : 1);
          b.y -= oy * (aFixed ? 2 : 1);
          b.z -= oz * (aFixed ? 2 : 1);
        }
      }
      points[0].x = anchor.x;
      points[0].y = anchor.y;
      points[0].z = anchor.z;
      if (held) {
        points[last].x = held.x;
        points[last].y = held.y;
        points[last].z = held.z;
      }
    }
  };

  return {
    points,
    // The clip the card hangs from.
    end: points[last],
    // Direction of the final segment, used to tilt the card with the strap.
    tilt() {
      const a = points[last - 1];
      const b = points[last];
      return Math.atan2(b.x - a.x, -(b.y - a.y));
    },
    // Horizontal speed of the clip this frame — feeds the card's spin so a
    // sideways flick sets it turning.
    sway() {
      return points[last].x - previous[last].x;
    },
    hold(target) {
      held = held || vec();
      held.x = target.x;
      held.y = target.y;
      held.z = target.z;
    },
    release() {
      held = null;
    },
    get isHeld() {
      return Boolean(held);
    },
    step(dt, { wind = 0 } = {}) {
      // A long frame (a background tab, a slow paint) would otherwise integrate
      // a huge step and fling the rope off-screen.
      const h = clamp(dt, 0, 1 / 30);
      if (held) {
        // Steering the clip by hand still writes a verlet step, so the drag's
        // speed *is* its velocity — let go mid-swing and the pass keeps going.
        previous[last].x = points[last].x;
        previous[last].y = points[last].y;
        previous[last].z = points[last].z;
        points[last].x = held.x;
        points[last].y = held.y;
        points[last].z = held.z;
      } else if (wind) {
        for (let i = 1; i < nodes; i += 1) points[i].x += wind * h * (i / last);
      }
      integrate(h);
      constrain();
    },
  };
}

// The card's turn about its own vertical axis. The article damps Rapier's
// angular velocity toward zero (`ang.y - rot.y * 0.25`) so a spun badge settles
// face-forward again; this is that behaviour as an explicit damped spring.
//
// `stiffness` is ω² in rad/s² and `damping` is a decay rate in 1/s, so the feel
// is the same whatever the frame rate. `maxSpeed` keeps a hard flick from
// blurring into a spin nobody can read.
export function createSpin({ stiffness = 9, damping = 1.2, maxSpeed = 12 } = {}) {
  let angle = 0;
  let velocity = 0;
  return {
    get angle() {
      return angle;
    },
    push(impulse) {
      velocity = clamp(velocity + impulse, -maxSpeed, maxSpeed);
    },
    step(dt) {
      const h = clamp(dt, 0, 1 / 30);
      velocity += -angle * stiffness * h;
      velocity *= Math.exp(-damping * h);
      angle += velocity * h;
      return angle;
    },
  };
}
