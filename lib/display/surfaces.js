import { minutesToLabel, sessionStart, sessionsForDay, splitNowNext } from "@/lib/agenda/sessions";
import { BOARD_H, BOARD_W } from "./constants";

// Venue simulator compositors: re-lay the board canvas for screens that aren't
// 16:9 (portrait totems, ribbons, IMAG). Slides themselves are only ever
// painted by renderer.js — these draw that canvas, never a slide.

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const font = (weight, size) => `${weight} ${size}px ${FONT}`;

const nowMinutes = (now) => now.getHours() * 60 + now.getMinutes();
const clockLabel = (now) => now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

// Live and upcoming sessions for today's ticker and portrait footer.
export function scheduleSnapshot(sessions, now = new Date()) {
  const { live, upcoming } = splitNowNext(sessionsForDay(sessions, ""), nowMinutes(now));
  return { live, upcoming };
}

// Tiny downscale then upscale is a near-free blur for the letterbox backdrop.
const blurScratch = typeof document === "undefined" ? null : document.createElement("canvas");
function drawBlurredBackdrop(ctx, source, w, h) {
  if (!blurScratch) return;
  blurScratch.width = 48;
  blurScratch.height = 27;
  const b = blurScratch.getContext("2d");
  b.drawImage(source, 0, 0, 48, 27);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const scale = Math.max(w / 48, h / 27);
  ctx.drawImage(blurScratch, (w - 48 * scale) / 2, (h - 27 * scale) / 2, 48 * scale, 27 * scale);
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function ellipsize(ctx, text, maxWidth) {
  const str = String(text ?? "");
  if (ctx.measureText(str).width <= maxWidth) return str;
  let out = str;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1);
  return `${out}…`;
}

// Portrait 9:16 kiosk: header band, the board contain-fitted, then an up-next list.
export function drawPortrait(ctx, source, { width, height, theme, event, sessions, now = new Date() }) {
  drawBlurredBackdrop(ctx, source, width, height);

  const pad = Math.round(width * 0.07);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  ctx.fillStyle = theme.accent;
  ctx.fillRect(pad, pad, width * 0.14, 10);
  ctx.fillStyle = "#ffffff";
  ctx.font = font(700, Math.round(width * 0.068));
  ctx.fillText(ellipsize(ctx, event?.name || "Event", width - pad * 2), pad, pad + width * 0.12);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = font(500, Math.round(width * 0.04));
  ctx.fillText(clockLabel(now), pad, pad + width * 0.19);

  const boardH = (width * BOARD_H) / BOARD_W;
  const boardY = height * 0.26;
  ctx.drawImage(source, 0, boardY, width, boardH);

  const { live, upcoming } = scheduleSnapshot(sessions, now);
  const rows = [...live.map((s) => ({ s, live: true })), ...upcoming.map((s) => ({ s, live: false }))].slice(0, 4);
  let y = boardY + boardH + width * 0.13;
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = font(700, Math.round(width * 0.034));
  ctx.fillText("UP NEXT", pad, y);
  y += width * 0.07;
  if (!rows.length) {
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = font(500, Math.round(width * 0.045));
    ctx.fillText("Nothing else scheduled today", pad, y);
  }
  for (const { s, live: isLive } of rows) {
    const start = sessionStart(s);
    ctx.fillStyle = isLive ? theme.live : theme.accent;
    ctx.font = font(700, Math.round(width * 0.042));
    ctx.fillText(isLive ? "NOW" : start == null ? "TBC" : minutesToLabel(start), pad, y);
    ctx.fillStyle = "#ffffff";
    ctx.font = font(600, Math.round(width * 0.05));
    ctx.fillText(ellipsize(ctx, s.name || "Untitled", width - pad * 2), pad, y + width * 0.065);
    y += width * 0.16;
  }
}

// Ribbon ticker, laid out to tile seamlessly so the texture can scroll by offset.
export function drawTicker(ctx, { width, height, theme, event, sessions, now = new Date() }) {
  const { live, upcoming } = scheduleSnapshot(sessions, now);
  const segments = [
    { text: (event?.name || "Welcome").toUpperCase(), color: "#ffffff", weight: 800 },
    ...live.map((s) => ({ label: "NOW", text: s.name || "Untitled", color: theme.live })),
    ...upcoming.slice(0, 3).map((s) => ({
      label: sessionStart(s) == null ? "NEXT" : minutesToLabel(sessionStart(s)),
      text: s.name || "Untitled",
      color: theme.accent,
    })),
    { label: "LOCAL TIME", text: clockLabel(now), color: theme.accent },
  ];

  const size = Math.round(height * 0.5);
  const gap = size * 1.6;
  const measure = (seg) => {
    ctx.font = font(700, Math.round(size * 0.55));
    const labelW = seg.label ? ctx.measureText(seg.label).width + size * 0.5 : 0;
    ctx.font = font(seg.weight || 700, size);
    return labelW + ctx.measureText(seg.text).width + gap;
  };
  const cycle = segments.reduce((sum, seg) => sum + measure(seg), 0);
  const copies = Math.max(1, Math.round(width / cycle));
  const scaleX = width / (copies * cycle);

  ctx.fillStyle = "#050507";
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.scale(scaleX, 1);
  ctx.textBaseline = "middle";
  let x = 0;
  for (let c = 0; c < copies; c += 1) {
    for (const seg of segments) {
      if (seg.label) {
        ctx.fillStyle = seg.color;
        ctx.font = font(700, Math.round(size * 0.55));
        ctx.fillText(seg.label, x, height / 2);
        x += ctx.measureText(seg.label).width + size * 0.5;
      }
      ctx.fillStyle = seg.label ? "#ffffff" : seg.color;
      ctx.font = font(seg.weight || 700, size);
      ctx.fillText(seg.text, x, height / 2);
      x += ctx.measureText(seg.text).width + gap * 0.5;
      ctx.fillStyle = theme.accent;
      ctx.fillRect(x - size * 0.12, height / 2 - size * 0.12, size * 0.24, size * 0.24);
      x += gap * 0.5;
    }
  }
  ctx.restore();
  ctx.fillStyle = theme.accent;
  ctx.fillRect(0, 0, width, Math.max(2, height * 0.05));
  ctx.fillRect(0, height - Math.max(2, height * 0.05), width, Math.max(2, height * 0.05));
}

// IMAG camera feed: a stylised presenter at a lectern with a lower third.
export function drawImag(ctx, { width, height, theme, sessions, t, now = new Date() }) {
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, "#1b2433");
  grad.addColorStop(1, "#07090d");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Soft backlight bokeh behind the speaker.
  for (let i = 0; i < 7; i += 1) {
    const bx = ((i * 0.37 + 0.1) % 1) * width;
    const by = height * (0.18 + ((i * 0.23) % 0.3));
    const r = width * (0.08 + (i % 3) * 0.03);
    const g = ctx.createRadialGradient(bx, by, 0, bx, by, r);
    g.addColorStop(0, i % 2 ? "rgba(120,160,255,0.22)" : `${theme.accent}40`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(bx - r, by - r, r * 2, r * 2);
  }

  const sway = Math.sin(t * 0.8) * width * 0.015;
  const nod = Math.sin(t * 1.9) * height * 0.004;
  const cx = width / 2 + sway;
  ctx.fillStyle = "#2a2f38";
  ctx.beginPath();
  ctx.ellipse(cx, height * 0.86, width * 0.42, height * 0.3, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = "#c9a58a";
  ctx.beginPath();
  ctx.ellipse(cx, height * 0.43 + nod, width * 0.13, height * 0.105, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2b211c";
  ctx.beginPath();
  ctx.ellipse(cx, height * 0.37 + nod, width * 0.135, height * 0.065, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = "#1c2027";
  ctx.fillRect(cx - width * 0.05, height * 0.53, width * 0.1, height * 0.05);

  const { live, upcoming } = scheduleSnapshot(sessions, now);
  const session = live[0] || upcoming[0] || null;
  const barY = height * 0.8;
  ctx.fillStyle = "rgba(8,8,10,0.82)";
  ctx.fillRect(0, barY, width, height * 0.16);
  ctx.fillStyle = theme.accent;
  ctx.fillRect(0, barY, width * 0.025, height * 0.16);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffffff";
  ctx.font = font(700, Math.round(width * 0.06));
  ctx.fillText(
    ellipsize(ctx, session?.config?.speaker || "Keynote speaker", width * 0.86),
    width * 0.07,
    barY + height * 0.07,
  );
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = font(500, Math.round(width * 0.042));
  ctx.fillText(ellipsize(ctx, session?.name || "Live on stage", width * 0.86), width * 0.07, barY + height * 0.125);

  ctx.fillStyle = "#ef4444";
  ctx.beginPath();
  ctx.arc(width * 0.08, height * 0.07, width * 0.018, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = font(700, Math.round(width * 0.04));
  ctx.fillText("LIVE", width * 0.11, height * 0.085);
}
