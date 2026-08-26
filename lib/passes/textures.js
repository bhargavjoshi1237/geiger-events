"use client";

import { passSvg } from "./render";
import { inlineTemplateImages } from "./inline";
import { sideBg } from "./layout";
import { stockSize, MM_PER_IN } from "./stock";

const FACE_PX = 1024;

const RIBBON_TILE = { w: 224, h: 192 };

export const RIBBON_TILE_ASPECT = RIBBON_TILE.w / RIBBON_TILE.h;

export const CARD_ATLAS = {
  width: 1280,
  height: 1184,
  faces: {
    front: { x: 0, y: 0, w: 0.5, h: 0.7575, mirror: false },
    back: { x: 0.5, y: 0, w: 0.5, h: 0.7575, mirror: true },
  },
};

function createCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

function faceDpi(stock) {
  const { wMm, hMm } = stockSize(stock);
  return Math.min(600, Math.max(96, FACE_PX / (Math.max(wMm, hMm) / MM_PER_IN)));
}

function svgToImage(svg) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("The pass couldn't be rasterized."));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

function drawFace(ctx, img, face, { wMm, hMm, background }) {
  const { width: W, height: H } = CARD_ATLAS;
  const rx = face.x * W;
  const ry = face.y * H;
  const rw = face.w * W;
  const rh = face.h * H;

  ctx.save();
  if (face.mirror) {
    ctx.translate(rx * 2 + rw, 0);
    ctx.scale(-1, 1);
  }
  ctx.fillStyle = background || "#111111";
  ctx.fillRect(rx, ry, rw, rh);

  if (img) {
    const scale = Math.min(rw / wMm, rh / hMm);
    const dw = wMm * scale;
    const dh = hMm * scale;
    ctx.drawImage(img, rx + (rw - dw) / 2, ry + (rh - dh) / 2, dw, dh);
  }
  ctx.restore();
}

export async function passAtlasCanvas(template, ctx = {}) {
  if (!template) return null;
  try {
    const { images } = await inlineTemplateImages(template);
    const dpi = faceDpi(template.stock);
    const { wMm, hMm } = stockSize(template.stock);

    const faces = await Promise.all(
      ["front", "back"].map(async (side) => ({
        side,
        img: await svgToImage(
          passSvg(
            template,
            { ...ctx, images, logoHref: images[template.logoUrl] || "" },
            { dpi, side },
          ),
        ),
      })),
    );

    const canvas = createCanvas(CARD_ATLAS.width, CARD_ATLAS.height);
    const c2d = canvas.getContext("2d");
    c2d.imageSmoothingQuality = "high";
    for (const { side, img } of faces) {
      drawFace(c2d, img, CARD_ATLAS.faces[side], {
        wMm,
        hMm,
        background: sideBg(template, side),
      });
    }
    return canvas;
  } catch (e) {
    console.error("[passes.cardAtlas]", e);
    return null;
  }
}

const MARK = {
  w: 467,
  h: 285,
  paths: [
    "M427.054 1.17427C431.046 1.15338 464.984 0.670938 466.079 1.40804C466.298 4.01125 464.421 3.92073 463.267 6.18971C450.436 31.3381 435.978 55.3181 422.003 79.8289L339.669 223C327.843 243.287 317.065 263.871 304.413 283.952L285.161 283.494C273.521 283.311 254.97 282.561 244.096 284C255.18 269.451 265.622 246.845 275.646 231.004C280.056 224.033 284.971 216.613 289.146 209.596C302.879 186.047 316.389 162.368 329.675 138.564C346.203 109.513 363.065 80.653 380.256 51.9898C390.11 35.4483 398.71 17.3651 409.366 1.55774C415.08 1.29513 421.301 1.29165 427.054 1.17427Z",
    "M218.309 1.31216L224 1.15608L193.641 50.3271L170.178 91.0997L136.561 149.51L124.008 172.428L103.37 206.726L77.2097 251.035L57.3197 283.677L6.18221 283.433L0 284.156L22.4687 244.331L54.6016 189.816L75.3213 152.467L94.3273 119.376L144.096 31L161 1.15608L218.309 1.31216Z",
    "M344.758 0L345.096 0.735049C326.643 33.9528 307.753 66.9251 288.428 99.6433C284.236 106.683 278.484 114.061 274.613 121.064C265.581 137.399 256.332 153.496 247.097 169.697L208.592 236.882C199.377 253.009 192.444 267.92 180.666 282.525C163.285 284.093 142.445 282.6 123.432 284L123.098 283.728C123.005 282.163 127.788 276.233 129.062 273.917C135.826 261.605 142.61 249.297 149.637 237.134L240.526 79.7429C249.025 64.9272 257.723 50.1984 266.187 35.3414C268.992 30.4177 277.596 15 285.096 0.735052C305.596 0.735046 325.596 0.735049 344.131 0.1168L344.758 0Z",
  ],
};

export function ribbonTileCanvas() {
  const { w, h } = RIBBON_TILE;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, w, h);

  const edge = ctx.createLinearGradient(0, 0, 0, h);
  edge.addColorStop(0, "rgba(255,255,255,0.14)");
  edge.addColorStop(0.12, "rgba(255,255,255,0)");
  edge.addColorStop(0.88, "rgba(255,255,255,0)");
  edge.addColorStop(1, "rgba(255,255,255,0.14)");
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-Math.PI / 2);
  const scale = (h * 0.66) / MARK.w;
  ctx.scale(scale, scale);
  ctx.translate(-MARK.w / 2, -MARK.h / 2);
  ctx.fillStyle = "#ffffff";
  for (const d of MARK.paths) ctx.fill(new Path2D(d));
  ctx.restore();

  return canvas;
}
