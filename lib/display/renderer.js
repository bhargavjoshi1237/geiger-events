import {
  BOARD_H,
  BOARD_W,
  DEFAULT_THEME,
  THEMES,
  catalogEntry,
  trackColor,
} from "./constants";
import {
  agendaTracks,
  minutesToLabel,
  sessionEnd,
  sessionStart,
  sessionsForDay,
  splitNowNext,
} from "@/lib/agenda/sessions";

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const PAD = 96;
const FADE_MS = 400;

const font = (weight, size) => `${weight} ${size}px ${FONT}`;

export const resolveTheme = (key) => THEMES[key] || THEMES[DEFAULT_THEME];

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function ellipsize(ctx, text, maxWidth) {
  const str = String(text ?? "");
  if (!str) return "";
  if (ctx.measureText(str).width <= maxWidth) return str;
  let lo = 0;
  let hi = str.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(`${str.slice(0, mid)}…`).width <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return `${str.slice(0, lo)}…`;
}

function wrapLines(ctx, text, maxWidth, maxLines) {
  const words = String(text ?? "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && line && lines[maxLines - 1] !== line) {
    lines[maxLines - 1] = ellipsize(ctx, `${lines[maxLines - 1]} ${line}`, maxWidth);
  } else if (lines.length) {
    lines[lines.length - 1] = ellipsize(ctx, lines[lines.length - 1], maxWidth);
  }
  return lines;
}

function fitFont(ctx, text, maxWidth, weight, size, min = 24) {
  let px = size;
  ctx.font = font(weight, px);
  while (px > min && ctx.measureText(text).width > maxWidth) {
    px -= 2;
    ctx.font = font(weight, px);
  }
  return px;
}

function drawImageFitted(ctx, img, x, y, w, h, fit) {
  if (!img || !img.width || !img.height) return;
  const scale =
    fit === "contain"
      ? Math.min(w / img.width, h / img.height)
      : Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.save();
  roundRect(ctx, x, y, w, h, 0);
  ctx.clip();
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}

const startOf = sessionStart;
const endOf = sessionEnd;

const trackIndexer = (sessions) => {
  const tracks = agendaTracks(sessions);
  return (session) => {
    const t = (session.config?.track || "").trim();
    const i = tracks.indexOf(t);
    return i < 0 ? 0 : i;
  };
};

function drawBackground(ctx, theme) {
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, BOARD_W, BOARD_H);
}

function drawHeader(ctx, { theme, event, now, label }) {
  const y = PAD - 16;
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = theme.muted;
  ctx.font = font(600, 30);
  ctx.textAlign = "left";
  ctx.fillText(ellipsize(ctx, event?.name || "Event", BOARD_W * 0.55), PAD, y);

  const clock = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  ctx.font = font(600, 30);
  ctx.textAlign = "right";
  ctx.fillStyle = theme.fg;
  ctx.fillText(clock, BOARD_W - PAD, y);

  if (label) {
    const clockW = ctx.measureText(clock).width;
    ctx.fillStyle = theme.dim;
    ctx.font = font(500, 26);
    ctx.fillText(label, BOARD_W - PAD - clockW - 32, y);
  }

  ctx.fillStyle = theme.line;
  ctx.fillRect(PAD, y + 22, BOARD_W - PAD * 2, 2);
  ctx.textAlign = "left";
}

function drawHeading(ctx, theme, text, y) {
  if (!text) return y;
  ctx.fillStyle = theme.fg;
  const size = fitFont(ctx, text, BOARD_W - PAD * 2, 700, 68, 40);
  ctx.textAlign = "left";
  ctx.fillText(text, PAD, y + size);
  return y + size + 28;
}

function drawTitleSlide(ctx, { slide, event, theme, images }) {
  const cover = slide.config?.showCover ? images.get(event?.coverUrl) : null;
  if (cover) {
    drawImageFitted(ctx, cover, 0, 0, BOARD_W, BOARD_H, "cover");
    const grad = ctx.createLinearGradient(0, 0, 0, BOARD_H);
    grad.addColorStop(0, "rgba(0,0,0,0.35)");
    grad.addColorStop(1, "rgba(0,0,0,0.85)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, BOARD_W, BOARD_H);
  }

  const fg = cover ? "#ffffff" : theme.fg;
  const muted = cover ? "rgba(255,255,255,0.75)" : theme.muted;

  const heading = slide.config?.heading?.trim() || event?.name || "Event";
  const sub =
    slide.config?.subheading?.trim() ||
    [event?.date ? formatEventDate(event.date) : null, event?.venue, event?.city]
      .filter(Boolean)
      .join(" · ");

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  const size = fitFont(ctx, heading, BOARD_W - PAD * 2, 700, 132, 56);
  const lines = wrapLines(ctx, heading, BOARD_W - PAD * 2, 3);
  const blockH = lines.length * size * 1.1;
  let y = BOARD_H / 2 - blockH / 2 + size * 0.35;

  ctx.fillStyle = theme.accent;
  ctx.fillRect(PAD, y - size * 0.9 - 44, 132, 8);

  ctx.fillStyle = fg;
  for (const line of lines) {
    ctx.fillText(line, PAD, y);
    y += size * 1.1;
  }

  if (sub) {
    ctx.fillStyle = muted;
    ctx.font = font(500, 40);
    ctx.fillText(ellipsize(ctx, sub, BOARD_W - PAD * 2), PAD, y + 24);
  }
}

function drawMessageSlide(ctx, { slide, theme }) {
  const heading = slide.config?.heading?.trim() || "";
  const body = slide.config?.body?.trim() || "";

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = theme.accent;
  ctx.fillRect(PAD, PAD, 132, 8);

  let y = PAD + 132;
  if (heading) {
    const size = fitFont(ctx, heading, BOARD_W - PAD * 2, 700, 96, 48);
    ctx.fillStyle = theme.fg;
    for (const line of wrapLines(ctx, heading, BOARD_W - PAD * 2, 2)) {
      ctx.fillText(line, PAD, y);
      y += size * 1.12;
    }
  }

  if (body) {
    ctx.fillStyle = theme.muted;
    ctx.font = font(400, 48);
    for (const line of wrapLines(ctx, body, BOARD_W - PAD * 2, 8)) {
      ctx.fillText(line, PAD, y + 40);
      y += 68;
    }
  }
}

function drawImageSlide(ctx, { slide, theme, images }) {
  const img = images.get(slide.config?.url);
  const caption = slide.config?.caption?.trim();
  const bottom = caption ? 140 : 0;

  if (img) {
    drawImageFitted(ctx, img, 0, 0, BOARD_W, BOARD_H - bottom, slide.config?.fit || "cover");
  } else {
    ctx.fillStyle = theme.panel;
    ctx.fillRect(0, 0, BOARD_W, BOARD_H - bottom);
    ctx.fillStyle = theme.dim;
    ctx.font = font(500, 40);
    ctx.textAlign = "center";
    ctx.fillText("No image set", BOARD_W / 2, (BOARD_H - bottom) / 2);
    ctx.textAlign = "left";
  }

  if (caption) {
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, BOARD_H - bottom, BOARD_W, bottom);
    ctx.fillStyle = theme.fg;
    ctx.font = font(600, 44);
    ctx.textBaseline = "middle";
    ctx.fillText(
      ellipsize(ctx, caption, BOARD_W - PAD * 2),
      PAD,
      BOARD_H - bottom / 2,
    );
    ctx.textBaseline = "alphabetic";
  }
}

function drawSessionRow(ctx, session, { theme, x, y, w, h, accent, live }) {
  ctx.fillStyle = theme.panel;
  roundRect(ctx, x, y, w, h, 20);
  ctx.fill();

  ctx.fillStyle = accent;
  roundRect(ctx, x, y, 10, h, 5);
  ctx.fill();

  const innerX = x + 44;
  const timeW = 240;

  const start = startOf(session);
  const end = endOf(session);
  ctx.fillStyle = live ? theme.live : theme.fg;
  ctx.font = font(700, 40);
  ctx.textBaseline = "alphabetic";
  ctx.fillText(start == null ? "TBC" : minutesToLabel(start), innerX, y + h / 2 - 4);
  if (end != null) {
    ctx.fillStyle = theme.dim;
    ctx.font = font(500, 28);
    ctx.fillText(minutesToLabel(end), innerX, y + h / 2 + 34);
  }

  const textX = innerX + timeW;
  const textW = w - (textX - x) - 48;

  ctx.fillStyle = theme.fg;
  ctx.font = font(600, 44);
  ctx.fillText(ellipsize(ctx, session.name || "Untitled", textW), textX, y + h / 2 - 4);

  const meta = [session.config?.track, session.config?.room, session.config?.speaker]
    .map((v) => (v || "").trim())
    .filter(Boolean)
    .join("  ·  ");
  if (meta) {
    ctx.fillStyle = theme.muted;
    ctx.font = font(500, 30);
    ctx.fillText(ellipsize(ctx, meta, textW), textX, y + h / 2 + 40);
  }

  if (live) {
    ctx.fillStyle = theme.live;
    ctx.font = font(700, 24);
    ctx.textAlign = "right";
    ctx.fillText("NOW", x + w - 40, y + 44);
    ctx.textAlign = "left";
  }
}

function drawNowNextSlide(ctx, { slide, event, sessions, theme, now }) {
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const day = slide.config?.day || "";
  const dayList = sessionsForDay(sessions, day);
  const { live, upcoming } = splitNowNext(dayList, nowMins);
  const indexOfTrack = trackIndexer(sessions);

  drawHeader(ctx, { theme, event, now, label: day || null });

  let y = PAD + 40;
  y = drawHeading(ctx, theme, slide.config?.heading?.trim() || "Happening now", y);

  const take = Math.max(1, Number(slide.config?.upcoming) || 4);
  const rows = [
    ...live.map((s) => ({ session: s, live: true })),
    ...upcoming.slice(0, take).map((s) => ({ session: s, live: false })),
  ].slice(0, 6);

  if (!rows.length) {
    ctx.fillStyle = theme.dim;
    ctx.font = font(500, 44);
    ctx.fillText(
      dayList.length ? "Nothing else scheduled today" : "No sessions scheduled",
      PAD,
      y + 80,
    );
    return;
  }

  const gap = 20;
  const available = BOARD_H - y - PAD;
  const rowH = Math.min(148, (available - gap * (rows.length - 1)) / rows.length);
  for (const row of rows) {
    drawSessionRow(ctx, row.session, {
      theme,
      x: PAD,
      y,
      w: BOARD_W - PAD * 2,
      h: rowH,
      accent: trackColor(indexOfTrack(row.session)),
      live: row.live,
    });
    y += rowH + gap;
  }
}

function drawRoomNextSlide(ctx, { slide, event, sessions, theme, now }) {
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const room = (slide.config?.room || "").trim();
  const day = slide.config?.day || "";
  const indexOfTrack = trackIndexer(sessions);

  const list = sessionsForDay(sessions, day).filter((s) =>
    room ? (s.config?.room || "").trim() === room : true,
  );
  const { live, upcoming } = splitNowNext(list, nowMins);

  drawHeader(ctx, { theme, event, now, label: day || null });

  let y = PAD + 40;
  y = drawHeading(
    ctx,
    theme,
    slide.config?.heading?.trim() || (room ? room : "Up next"),
    y,
  );

  if (room) {
    ctx.fillStyle = theme.muted;
    ctx.font = font(500, 34);
    ctx.fillText("Up next in this room", PAD, y + 10);
    y += 52;
  }

  const take = Math.max(1, Number(slide.config?.upcoming) || 5);
  const rows = [
    ...live.map((s) => ({ session: s, live: true })),
    ...upcoming.slice(0, take).map((s) => ({ session: s, live: false })),
  ].slice(0, 6);

  if (!rows.length) {
    ctx.fillStyle = theme.dim;
    ctx.font = font(500, 44);
    ctx.fillText("Nothing else scheduled here", PAD, y + 80);
    return;
  }

  const gap = 20;
  const available = BOARD_H - y - PAD;
  const rowH = Math.min(140, (available - gap * (rows.length - 1)) / rows.length);
  for (const row of rows) {
    drawSessionRow(ctx, row.session, {
      theme,
      x: PAD,
      y,
      w: BOARD_W - PAD * 2,
      h: rowH,
      accent: trackColor(indexOfTrack(row.session)),
      live: row.live,
    });
    y += rowH + gap;
  }
}

function drawDayGridSlide(ctx, { slide, event, sessions, theme, now }) {
  const day = slide.config?.day || "";
  const list = sessionsForDay(sessions, day).filter((s) => startOf(s) != null);
  const tracks = agendaTracks(sessions);
  const columns = tracks.length ? tracks : ["All sessions"];

  drawHeader(ctx, { theme, event, now, label: day || null });

  let top = PAD + 40;
  top = drawHeading(ctx, theme, slide.config?.heading?.trim() || day || "Today", top);

  if (!list.length) {
    ctx.fillStyle = theme.dim;
    ctx.font = font(500, 44);
    ctx.fillText("No scheduled sessions", PAD, top + 80);
    return;
  }

  const starts = list.map(startOf);
  const ends = list.map((s) => endOf(s) ?? startOf(s) + 60);
  const from = Math.floor(Math.min(...starts) / 60) * 60;
  const to = Math.ceil(Math.max(...ends) / 60) * 60;
  const span = Math.max(60, to - from);

  const railW = 150;
  const gridX = PAD + railW;
  const gridW = BOARD_W - PAD - gridX;
  const headerH = 56;
  const gridY = top + headerH;
  const gridH = BOARD_H - PAD - gridY;
  const colW = gridW / columns.length;
  const yFor = (mins) => gridY + ((mins - from) / span) * gridH;

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  columns.forEach((name, i) => {
    ctx.fillStyle = trackColor(i);
    ctx.font = font(700, 28);
    ctx.fillText(
      ellipsize(ctx, name.toUpperCase(), colW - 24),
      gridX + i * colW + 8,
      top + 34,
    );
  });

  ctx.font = font(500, 26);
  for (let mins = from; mins <= to; mins += 60) {
    const y = yFor(mins);
    ctx.fillStyle = theme.line;
    ctx.fillRect(gridX, y, gridW, 1);
    ctx.fillStyle = theme.dim;
    ctx.textAlign = "right";
    ctx.fillText(minutesToLabel(mins), gridX - 24, y + 10);
  }
  ctx.textAlign = "left";

  for (const session of list) {
    const start = startOf(session);
    const end = endOf(session) ?? start + 60;
    const col = tracks.length
      ? Math.max(0, tracks.indexOf((session.config?.track || "").trim()))
      : 0;
    const x = gridX + col * colW + 6;
    const w = colW - 12;
    const y = yFor(start);
    const h = Math.max(56, yFor(end) - y - 6);
    const accent = trackColor(col);

    ctx.fillStyle = theme.panel;
    roundRect(ctx, x, y, w, h, 14);
    ctx.fill();
    ctx.fillStyle = accent;
    roundRect(ctx, x, y, 6, h, 3);
    ctx.fill();

    const textX = x + 22;
    const textW = w - 34;
    ctx.fillStyle = theme.fg;
    ctx.font = font(600, 28);
    const titleLines = wrapLines(ctx, session.name || "Untitled", textW, h > 110 ? 2 : 1);
    let ty = y + 38;
    for (const line of titleLines) {
      ctx.fillText(line, textX, ty);
      ty += 32;
    }

    if (h > 84) {
      ctx.fillStyle = theme.muted;
      ctx.font = font(500, 22);
      const meta = [
        minutesToLabel(start),
        (session.config?.room || "").trim(),
        (session.config?.speaker || "").trim(),
      ]
        .filter(Boolean)
        .join(" · ");
      ctx.fillText(ellipsize(ctx, meta, textW), textX, ty + 4);
    }
  }
}

const PAINTERS = {
  title: drawTitleSlide,
  now_next: drawNowNextSlide,
  day_grid: drawDayGridSlide,
  room_next: drawRoomNextSlide,
  message: drawMessageSlide,
  image: drawImageSlide,
};

export function drawSlide(ctx, params) {
  const theme = params.theme;
  drawBackground(ctx, theme);
  if (!params.slide) {
    ctx.fillStyle = theme.dim;
    ctx.font = font(500, 48);
    ctx.textAlign = "center";
    ctx.fillText("This board has no slides yet", BOARD_W / 2, BOARD_H / 2);
    ctx.textAlign = "left";
    return;
  }
  const painter = PAINTERS[params.slide.type];
  if (painter) painter(ctx, params);
}

function loadImage(url) {
  return new Promise((resolve) => {
    if (!url) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export async function preloadImages(slides, event) {
  const urls = new Set();
  if (event?.coverUrl) urls.add(event.coverUrl);
  for (const slide of slides || []) {
    if (slide.type === "image" && slide.config?.url) urls.add(slide.config.url);
  }
  const entries = await Promise.all(
    [...urls].map(async (url) => [url, await loadImage(url)]),
  );
  return new Map(entries.filter(([, img]) => img));
}

const slideDuration = (slide, speed) => {
  const base = Number(slide?.duration) || catalogEntry(slide?.type)?.duration || 10;
  return Math.max(1, base * (Number(speed) || 1)) * 1000;
};

export const boardDurationMs = (slides, speed) =>
  (slides || []).reduce((total, s) => total + slideDuration(s, speed), 0);

export class BoardPlayer {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.slides = options.slides || [];
    this.event = options.event || null;
    this.sessions = options.sessions || [];
    this.theme = resolveTheme(options.theme);
    this.speed = options.speed || 1;
    this.images = options.images || new Map();
    this.loop = options.loop !== false;
    this.onSlideChange = options.onSlideChange || null;
    this.onComplete = options.onComplete || null;
    this.onRunningChange = options.onRunningChange || null;

    this.index = 0;
    this.slideStart = 0;
    this.raf = null;
    this.running = false;
  }

  update({ slides, sessions, event, theme, speed, images }) {
    if (slides) this.slides = slides;
    if (sessions) this.sessions = sessions;
    if (event) this.event = event;
    if (theme) this.theme = resolveTheme(theme);
    if (speed) this.speed = speed;
    if (images) this.images = images;
    if (this.index >= this.slides.length) this.index = 0;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.slideStart = performance.now();
    this.onSlideChange?.(this.index);
    this.onRunningChange?.(true);
    const tick = (t) => {
      if (!this.running) return;
      this.frame(t);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() {
    const wasRunning = this.running;
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    if (wasRunning) this.onRunningChange?.(false);
  }

  seek(index) {
    if (!this.slides.length) return;
    this.index = ((index % this.slides.length) + this.slides.length) % this.slides.length;
    this.slideStart = performance.now();
    this.onSlideChange?.(this.index);
    if (!this.running) this.frame(performance.now());
  }

  frame(t) {
    const slide = this.slides[this.index] || null;
    const total = slide ? slideDuration(slide, this.speed) : 1000;
    const elapsed = t - this.slideStart;

    if (elapsed >= total) {
      const last = this.index === this.slides.length - 1;
      if (last && !this.loop) {
        this.stop();
        this.onComplete?.();
        return;
      }
      this.index = this.slides.length ? (this.index + 1) % this.slides.length : 0;
      this.slideStart = t;
      this.onSlideChange?.(this.index);
      this.frame(t);
      return;
    }

    const fadeIn = Math.min(1, elapsed / FADE_MS);
    const fadeOut = Math.min(1, Math.max(0, total - elapsed) / FADE_MS);
    const alpha = this.slides.length > 1 ? Math.min(fadeIn, fadeOut) : 1;

    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawBackground(ctx, this.theme);
    ctx.globalAlpha = alpha;
    drawSlide(ctx, {
      slide,
      event: this.event,
      sessions: this.sessions,
      theme: this.theme,
      now: new Date(),
      images: this.images,
    });
    ctx.restore();
  }
}

const MIME_CANDIDATES = [
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
];

export function supportsExport() {
  return (
    typeof window !== "undefined" &&
    typeof window.MediaRecorder !== "undefined" &&
    MIME_CANDIDATES.some((m) => MediaRecorder.isTypeSupported(m))
  );
}

export function exportBoardVideo({
  slides,
  event,
  sessions,
  theme,
  speed = 1,
  images,
  fps = 30,
  onProgress,
}) {
  return new Promise((resolve, reject) => {
    if (!supportsExport()) {
      reject(new Error("This browser can't record video."));
      return;
    }
    if (!slides?.length) {
      reject(new Error("Add at least one slide first."));
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = BOARD_W;
    canvas.height = BOARD_H;

    const mimeType = MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m));
    const stream = canvas.captureStream(fps);
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8e6 });
    const chunks = [];

    const player = new BoardPlayer(canvas, {
      slides,
      event,
      sessions,
      theme,
      speed,
      images,
      loop: false,
    });

    const totalMs = boardDurationMs(slides, speed);
    const started = performance.now();
    let progressTimer = null;

    const finish = () => {
      player.stop();
      if (progressTimer) clearInterval(progressTimer);
      stream.getTracks().forEach((track) => track.stop());
    };

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size) chunks.push(e.data);
    };
    recorder.onerror = (e) => {
      finish();
      reject(e.error || new Error("Recording failed."));
    };
    recorder.onstop = () => {
      finish();
      resolve(new Blob(chunks, { type: "video/webm" }));
    };

    player.onComplete = () => {
      setTimeout(() => recorder.state !== "inactive" && recorder.stop(), 120);
    };

    if (onProgress) {
      progressTimer = setInterval(() => {
        onProgress(Math.min(1, (performance.now() - started) / totalMs));
      }, 200);
    }

    recorder.start();
    player.start();
  });
}

export function formatEventDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
