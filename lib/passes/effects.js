"use client";

export const FINISH_OPTIONS = [
  { value: "none", label: "None" },
  { value: "gloss", label: "Gloss / spot UV" },
  { value: "matte", label: "Matte" },
  { value: "linen", label: "Linen texture" },
  { value: "foil", label: "Metallic foil" },
  { value: "holographic", label: "Holographic" },
];

export const ANGLED_FINISHES = new Set(["gloss", "foil", "holographic"]);

export const defaultEffects = () => ({
  finish: "none",
  foilColor: "#d4af37",
  glowColor: "",
});

export const isDefaultEffects = (e) =>
  !e ||
  (((e.finish || "none") === "none" || (Number(e.finishStrength) || 0) === 0) &&
    (!e.glowColor || (Number(e.glowStrength) || 0) === 0) &&
    (Number(e.emboss) || 0) === 0 &&
    (Number(e.vignette) || 0) === 0 &&
    (Number(e.grain) || 0) === 0);

const clamp01 = (n) => Math.min(1, Math.max(0, Number(n) || 0));

function mix(hex, target, amount) {
  const parse = (h) => {
    const clean = String(h || "").replace("#", "");
    const full =
      clean.length === 3
        ? clean.split("").map((c) => c + c).join("")
        : clean.padEnd(6, "0").slice(0, 6);
    const n = parseInt(full, 16);
    return Number.isNaN(n) ? [170, 170, 170] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const a = parse(hex);
  const b = parse(target);
  return `#${a
    .map((v, i) => Math.round(v + (b[i] - v) * amount).toString(16).padStart(2, "0"))
    .join("")}`;
}

function gradientCoords(angle) {
  const a = ((Number(angle) || 0) * Math.PI) / 180;
  const dx = Math.cos(a) / 2;
  const dy = Math.sin(a) / 2;
  return (
    `x1="${(0.5 - dx).toFixed(4)}" y1="${(0.5 - dy).toFixed(4)}"` +
    ` x2="${(0.5 + dx).toFixed(4)}" y2="${(0.5 + dy).toFixed(4)}"`
  );
}

const stop = (offset, color, opacity) =>
  `<stop offset="${offset}" stop-color="${color}" stop-opacity="${clamp01(opacity).toFixed(3)}"/>`;

function finishStops(finish, strength, foilColor) {
  if (finish === "gloss") {
    return [
      [0, "#ffffff", 0],
      [0.3, "#ffffff", 0],
      [0.4, "#ffffff", strength],
      [0.47, "#ffffff", 0],
      [0.6, "#ffffff", 0],
      [0.67, "#ffffff", strength * 0.5],
      [0.73, "#ffffff", 0],
      [1, "#ffffff", 0],
    ];
  }
  if (finish === "foil") {
    const light = mix(foilColor, "#ffffff", 0.6);
    const dark = mix(foilColor, "#000000", 0.4);
    return [
      [0, dark, strength * 0.6],
      [0.16, light, strength],
      [0.3, dark, strength * 0.55],
      [0.45, light, strength * 0.9],
      [0.6, dark, strength * 0.65],
      [0.78, light, strength],
      [1, dark, strength * 0.55],
    ];
  }
  if (finish === "holographic") {
    const s = strength * 0.55;
    return [
      [0, "#ff5f6d", s],
      [0.17, "#ffc371", s],
      [0.34, "#7bed9f", s],
      [0.5, "#70a1ff", s],
      [0.67, "#a29bfe", s],
      [0.84, "#ff9ff3", s],
      [1, "#ff5f6d", s],
    ];
  }
  return null;
}

export function effectsSvg(effects, { w, h, radius = 0, uid = "fx" } = {}) {
  const e = { ...defaultEffects(), ...(effects || {}) };
  if (isDefaultEffects(e) || !w || !h) return "";

  const defs = [];
  const over = [];
  const rx = Number(radius) ? ` rx="${Number(radius).toFixed(2)}"` : "";
  const card = (attrs) =>
    `<rect x="0" y="0" width="${w.toFixed(2)}" height="${h.toFixed(2)}"${rx} ${attrs}/>`;

  const finish = e.finish || "none";
  const strength = clamp01((Number(e.finishStrength) || 0) / 100);
  const stops = strength ? finishStops(finish, strength, e.foilColor) : null;
  if (stops) {
    const id = `${uid}-finish`;
    defs.push(
      `<linearGradient id="${id}" ${gradientCoords(e.sheenAngle)}>` +
        stops.map(([o, c, op]) => stop(o, c, op)).join("") +
        `</linearGradient>`,
    );
    over.push(card(`fill="url(#${id})"`));
  }

  if (strength && (finish === "matte" || finish === "linen")) {
    const id = `${uid}-tex`;
    const freq = finish === "linen" ? "0.08 1.8" : "0.9";
    defs.push(
      `<filter id="${id}" x="0" y="0" width="100%" height="100%">` +
        `<feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="2" stitchTiles="stitch"/>` +
        `<feColorMatrix type="saturate" values="0"/></filter>`,
    );
    over.push(card(`fill="#ffffff" opacity="${(strength * 0.1).toFixed(3)}"`));
    over.push(card(`fill="#808080" filter="url(#${id})" opacity="${(strength * 0.35).toFixed(3)}"`));
  }

  const glow = clamp01((Number(e.glowStrength) || 0) / 100);
  if (e.glowColor && glow) {
    const id = `${uid}-glow`;
    const spread = Math.max(0.2, Number(e.glowSpread) || 2.5);
    defs.push(
      `<filter id="${id}" x="-25%" y="-25%" width="150%" height="150%">` +
        `<feGaussianBlur stdDeviation="${(spread * 0.6).toFixed(2)}"/></filter>`,
    );
    over.push(
      card(
        `fill="none" stroke="${e.glowColor}" stroke-width="${(spread * 2).toFixed(2)}"` +
          ` filter="url(#${id})" opacity="${glow.toFixed(3)}"`,
      ),
    );
    over.push(card(`fill="${e.glowColor}" opacity="${(glow * 0.1).toFixed(3)}"`));
  }

  const emboss = clamp01((Number(e.emboss) || 0) / 100);
  if (emboss) {
    const id = `${uid}-emboss`;
    defs.push(
      `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">` +
        stop(0, "#ffffff", emboss * 0.9) +
        stop(0.5, "#ffffff", 0) +
        stop(1, "#000000", emboss * 0.75) +
        `</linearGradient>`,
    );
    over.push(card(`fill="none" stroke="url(#${id})" stroke-width="1.6"`));
  }

  const vignette = clamp01((Number(e.vignette) || 0) / 100);
  if (vignette) {
    const id = `${uid}-vig`;
    defs.push(
      `<radialGradient id="${id}" cx="0.5" cy="0.5" r="0.75">` +
        stop(0.4, "#000000", 0) +
        stop(1, "#000000", vignette * 0.85) +
        `</radialGradient>`,
    );
    over.push(card(`fill="url(#${id})"`));
  }

  const grain = clamp01((Number(e.grain) || 0) / 100);
  if (grain) {
    const id = `${uid}-grain`;
    defs.push(
      `<filter id="${id}" x="0" y="0" width="100%" height="100%">` +
        `<feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="3" stitchTiles="stitch"/>` +
        `<feColorMatrix type="saturate" values="0"/></filter>`,
    );
    over.push(card(`fill="#808080" filter="url(#${id})" opacity="${(grain * 0.55).toFixed(3)}"`));
  }

  if (!over.length) return "";

  const clip = `${uid}-clip`;
  defs.push(
    `<clipPath id="${clip}"><rect x="0" y="0" width="${w.toFixed(2)}"` +
      ` height="${h.toFixed(2)}"${rx}/></clipPath>`,
  );

  return (
    `<defs>${defs.join("")}</defs>` +
    `<g clip-path="url(#${clip})" pointer-events="none">${over.join("")}</g>`
  );
}
