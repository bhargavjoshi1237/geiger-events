"use client";

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

const vec = (x = 0, y = 0, z = 0) => ({ x, y, z });

export function createRope({
  nodes = 5,
  segment = 0.42,
  anchor = vec(0, 2.6, 0),
  gravity = -14,
  damping = 0.94,
  iterations = 12,
} = {}) {
  const points = [];
  const previous = [];
  for (let i = 0; i < nodes; i += 1) {
    points.push(vec(anchor.x, anchor.y - segment * i, anchor.z));
    previous.push(vec(anchor.x, anchor.y - segment * i, anchor.z));
  }

  const last = nodes - 1;
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
    end: points[last],
    tilt() {
      const a = points[last - 1];
      const b = points[last];
      return Math.atan2(b.x - a.x, -(b.y - a.y));
    },
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
      const h = clamp(dt, 0, 1 / 30);
      if (held) {
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
