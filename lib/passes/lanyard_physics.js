"use client";

// Position-based lanyard: a mass-weighted strap, the clip as its own swinging link, and the card as a
// rigid triangle hung off a free ball-joint swivel, so it lags, tumbles and spins through full turns.

const SUBSTEP = 1 / 240;
const MAX_SUBSTEPS = 10;

const vec = (x = 0, y = 0, z = 0) => ({ x, y, z });
const set = (o, x, y, z) => { o.x = x; o.y = y; o.z = z; return o; };
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a) => Math.hypot(a.x, a.y, a.z);
const sub = (o, a, b) => set(o, a.x - b.x, a.y - b.y, a.z - b.z);
const cross = (o, a, b) => set(o, a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
const normalize = (o) => { const l = len(o) || 1; return set(o, o.x / l, o.y / l, o.z / l); };
const addScaled = (o, a, s) => set(o, o.x + a.x * s, o.y + a.y * s, o.z + a.z * s);

export function createLanyard({
  anchor = vec(0, 2.9, 0),
  strapLength = 1.2,
  strapNodes = 12,
  clipLength = 0.5,
  // Hinge to card centre, and the card's half width, in world units.
  cardDrop = 1.7,
  cardHalfWidth = 1,
  gravity = -40,
  strapMass = 0.02,
  clipMass = 0.03,
  cardMass = 0.5,
  // Air drag (1/s): general, extra on the strap, and against the card's face.
  airDrag = 0.12,
  strapDrag = 1.4,
  faceDrag = 1.1,
  // Flat-plate lift (∝ v²·sin α), centred a quarter-chord ahead of the card's middle: what turns a swung card.
  faceLift = 0.5,
  pressureCentre = 0.5,
  releaseTwist = 0.45,
  // The hand is a stiff spring rather than a rod, so a card pulled past the strap's reach doesn't stretch it.
  grip = 0.4,
  // The strap's gentle preference to lie flat (rad/s² at 90°) and the swivel's bearing friction (1/s).
  twistStiffness = 2.5,
  swivelFriction = 0.25,
  heldSwivelFriction = 6,
  wind = 0.6,
  maxSpeed = 45,
  iterations = 4,
} = {}) {
  const segment = strapLength / (strapNodes - 1);
  const S = strapNodes - 1;
  const J = strapNodes;
  const A = strapNodes + 1;
  const B = strapNodes + 2;
  const count = strapNodes + 3;
  // Card particles sit at ±w/√3 so their yaw inertia matches a flat plate's m·w²/12.
  const spread = (cardHalfWidth * 2) / (2 * Math.sqrt(3));

  const pos = [];
  const prev = [];
  const vel = [];
  const invMass = [];
  for (let i = 0; i < count; i += 1) {
    pos.push(vec());
    prev.push(vec());
    vel.push(vec());
  }
  for (let i = 0; i < strapNodes; i += 1) invMass.push(i === 0 ? 0 : 1 / strapMass);
  invMass.push(1 / clipMass, 2 / cardMass, 2 / cardMass);

  const constraints = [];
  for (let i = 0; i < S; i += 1) constraints.push({ i, j: i + 1, rest: segment, min: false });
  // A strap bends but does not crease: neighbours-but-one keep a minimum spacing.
  for (let i = 0; i < S - 1; i += 1) constraints.push({ i, j: i + 2, rest: segment * 1.25, min: true });
  constraints.push({ i: S, j: J, rest: clipLength, min: false });
  const cardRest = Math.hypot(spread, cardDrop);
  constraints.push({ i: J, j: A, rest: cardRest, min: false });
  constraints.push({ i: J, j: B, rest: cardRest, min: false });
  constraints.push({ i: A, j: B, rest: spread * 2, min: false });
  // Tethers to the anchor: a heavy card on a light strap otherwise stretches it under load.
  for (let i = 2; i < count; i += 1) {
    const reach = i <= S ? segment * i : strapLength + clipLength + (i === J ? 0 : cardRest);
    constraints.push({ i: 0, j: i, rest: reach, max: true });
  }

  let facing = 0;
  let turning = 0;
  // A random phase per badge, so no two showcases (or two visits) sway in step.
  let time = Math.random() * 100;
  let accumulator = 0;
  let held = null;

  const t1 = vec();
  const t2 = vec();
  const mid = vec();
  const worldZ = vec(0, 0, 1);
  const card = { origin: pos[J], right: vec(1, 0, 0), up: vec(0, 1, 0), normal: vec(0, 0, 1), yaw: 0, spin: 0 };
  const clip = { origin: pos[S], right: vec(1, 0, 0), up: vec(0, 1, 0), normal: vec(0, 0, 1) };

  function reset(yaw = facing) {
    for (let i = 0; i < strapNodes; i += 1) set(pos[i], anchor.x, anchor.y - segment * i, anchor.z);
    const hinge = anchor.y - strapLength - clipLength;
    set(pos[J], anchor.x, hinge, anchor.z);
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    set(pos[A], anchor.x - spread * c, hinge - cardDrop, anchor.z + spread * s);
    set(pos[B], anchor.x + spread * c, hinge - cardDrop, anchor.z - spread * s);
    for (let i = 0; i < count; i += 1) {
      set(prev[i], pos[i].x, pos[i].y, pos[i].z);
      set(vel[i], 0, 0, 0);
    }
    updateFrames();
  }

  // Card basis from its three particles; yaw is measured against the camera-facing direction.
  function updateFrames() {
    set(mid, (pos[A].x + pos[B].x) / 2, (pos[A].y + pos[B].y) / 2, (pos[A].z + pos[B].z) / 2);
    normalize(sub(card.up, pos[J], mid));
    sub(card.right, pos[B], pos[A]);
    addScaled(card.right, card.up, -dot(card.right, card.up));
    normalize(card.right);
    cross(card.normal, card.right, card.up);

    addScaled(set(t1, 0, 0, 1), card.up, -dot(worldZ, card.up));
    normalize(t1);
    cross(t2, card.up, t1);
    card.yaw = Math.atan2(dot(card.normal, t2), dot(card.normal, t1));
    sub(t1, vel[B], vel[A]);
    card.spin = -dot(t1, card.normal) / (spread * 2);

    normalize(sub(clip.up, pos[S], pos[J]));
    addScaled(set(clip.normal, 0, 0, 1), clip.up, -clip.up.z);
    normalize(clip.normal);
    cross(clip.right, clip.up, clip.normal);
  }

  function spinBy(delta) {
    for (const k of [A, B]) {
      sub(t1, pos[k], mid);
      cross(t2, card.up, t1);
      addScaled(vel[k], t2, delta);
    }
  }

  function forces(h) {
    for (let i = 1; i < count; i += 1) {
      const drag = Math.exp(-(airDrag + (i < J ? strapDrag : 0)) * h);
      vel[i].x *= drag;
      vel[i].y = (vel[i].y + gravity * h) * drag;
      vel[i].z *= drag;
    }

    updateFrames();

    // Air on the card's face. Its centre of pressure leads the middle, so a card swung even slightly
    // edge-on is turned towards broadside — and carried past it — by its own motion.
    set(t1, (vel[A].x + vel[B].x) / 2, (vel[A].y + vel[B].y) / 2, (vel[A].z + vel[B].z) / 2);
    const vn = dot(t1, card.normal);
    const drift = dot(t1, card.right);
    const push = -(faceDrag + faceLift * len(t1)) * vn;
    for (const k of [A, B]) addScaled(vel[k], card.normal, push * h);
    const lever = Math.sign(drift) * pressureCentre * cardHalfWidth;
    spinBy((-lever * push * h) / (spread * spread));

    // The swivel: bearing friction plus the strap's weak, periodic pull back to the facing it prefers.
    const off = card.yaw - facing;
    const friction = held ? heldSwivelFriction : swivelFriction;
    const free = -twistStiffness * Math.sin(off) - friction * card.spin;
    // A flip is turned by hand, the short way round and well damped, then handed back to the free swivel.
    turning *= Math.exp(-h / 1.4);
    const guided = -18 * Math.atan2(Math.sin(off), Math.cos(off)) - 7 * card.spin;
    spinBy((free + turning * (guided - free)) * h);

    if (!held && wind) {
      const gust = wind * (Math.sin(time * 0.7) + 0.5 * Math.sin(time * 1.93 + 1.2));
      const drift2 = wind * 0.6 * Math.sin(time * 0.53 + 2.1);
      for (const k of [A, B]) {
        vel[k].x += gust * h;
        vel[k].z += drift2 * h;
      }
      spinBy(wind * 0.35 * Math.sin(time * 0.41 + 0.6) * h);
    }

    for (let i = 1; i < count; i += 1) {
      const speed = len(vel[i]);
      if (speed > maxSpeed) addScaled(vel[i], vel[i], maxSpeed / speed - 1);
    }
  }

  function solveDistance(c) {
    const a = pos[c.i];
    const b = pos[c.j];
    const wa = invMass[c.i];
    const wb = invMass[c.j];
    const w = wa + wb;
    if (!w) return;
    sub(t1, b, a);
    const d = len(t1) || 1e-6;
    const error = d - c.rest;
    if ((c.min && error >= 0) || (c.max && error <= 0)) return;
    const k = error / (d * w);
    addScaled(a, t1, k * wa);
    addScaled(b, t1, -k * wb);
  }

  // The hand pins one point on the card, expressed as an affine blend of its three particles.
  function solveHold() {
    const { weights, target } = held;
    let px = 0;
    let py = 0;
    let pz = 0;
    let denom = 0;
    for (let n = 0; n < 3; n += 1) {
      const p = pos[J + n];
      px += p.x * weights[n];
      py += p.y * weights[n];
      pz += p.z * weights[n];
      denom += invMass[J + n] * weights[n] * weights[n];
    }
    set(t2, target.x - px, target.y - py, target.z - pz);
    for (let n = 0; n < 3; n += 1) addScaled(pos[J + n], t2, (grip * invMass[J + n] * weights[n]) / denom);
  }

  function substep(h) {
    time += h;
    forces(h);
    for (let i = 1; i < count; i += 1) {
      set(prev[i], pos[i].x, pos[i].y, pos[i].z);
      addScaled(pos[i], vel[i], h);
    }
    for (let pass = 0; pass < iterations; pass += 1) {
      if (held) solveHold();
      for (const c of constraints) solveDistance(c);
    }
    for (let i = 1; i < count; i += 1) {
      set(vel[i], (pos[i].x - prev[i].x) / h, (pos[i].y - prev[i].y) / h, (pos[i].z - prev[i].z) / h);
    }
  }

  reset();

  return {
    strap: pos.slice(0, strapNodes),
    card,
    clip,
    get isHeld() {
      return Boolean(held);
    },
    setFacing(angle) {
      if (angle === facing) return;
      facing = angle;
      turning = 1;
      // Sitting exactly on the old facing is a balance point of the new one; a nudge sends it round.
      updateFrames();
      spinBy(1.5);
    },
    // Grab the card at a world point; returns the depth the hand should drag in.
    grab(point) {
      turning = 0;
      updateFrames();
      sub(t1, point, pos[J]);
      const x = dot(t1, card.right) / spread;
      const y = -dot(t1, card.up) / cardDrop;
      const wB = (y + x) / 2;
      const wA = (y - x) / 2;
      held = { weights: [1 - wA - wB, wA, wB], target: vec(point.x, point.y, point.z) };
      return point.z;
    },
    drag(target) {
      if (held) set(held.target, target.x, target.y, target.z);
    },
    release() {
      if (!held) return;
      held = null;
      // Fingers never let go perfectly evenly: a fast release leaves a little twist behind.
      updateFrames();
      set(t1, (vel[A].x + vel[B].x) / 2, (vel[A].y + vel[B].y) / 2, (vel[A].z + vel[B].z) / 2);
      spinBy((Math.random() * 2 - 1) * releaseTwist * len(t1));
    },
    step(dt) {
      accumulator += Math.min(dt, 0.1);
      let steps = 0;
      while (accumulator >= SUBSTEP && steps < MAX_SUBSTEPS) {
        substep(SUBSTEP);
        accumulator -= SUBSTEP;
        steps += 1;
      }
      if (steps === MAX_SUBSTEPS) accumulator = 0;
      updateFrames();
    },
    reset,
  };
}
