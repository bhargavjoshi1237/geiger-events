// Renders every ad in index.html to PNG with headless Chrome over CDP (no extra dependencies).
// Usage: node marketing/ads/render.mjs [--scale 2] [--only final-ads,ads-remix/2g] [--out <dir>]
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".jsx": "text/plain; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

// Isolates one ad at the page origin so the viewport screenshot is exactly the ad.
const SOLO_CSS =
  "html.ads-solo,html.ads-solo body{margin:0!important;padding:0!important;background:#fff!important;overflow:hidden!important}" +
  "html.ads-solo body>:not(#ads-stage){display:none!important}" +
  "#ads-stage{position:absolute;left:0;top:0}";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function serveDir(root) {
  const base = path.resolve(root);
  const server = createServer(async (req, res) => {
    const rel = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const file = path.join(base, rel.endsWith("/") ? `${rel}index.html` : rel);
    if (!file.startsWith(base)) return res.writeHead(403).end();
    try {
      const body = await readFile(file);
      res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () =>
      resolve({ url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() }),
    ),
  );
}

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const env = process.env;
  const candidates =
    process.platform === "win32"
      ? [
          `${env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`,
          `${env["PROGRAMFILES(X86)"]}\\Google\\Chrome\\Application\\chrome.exe`,
          `${env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
          `${env["PROGRAMFILES(X86)"]}\\Microsoft\\Edge\\Application\\msedge.exe`,
        ]
      : process.platform === "darwin"
        ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Chromium.app/Contents/MacOS/Chromium"]
        : ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
  const hit = candidates.find((p) => existsSync(p));
  if (!hit) throw new Error("Chrome not found. Set CHROME_PATH to a Chrome or Edge binary.");
  return hit;
}

export async function launchChrome() {
  const userDataDir = await mkdtemp(path.join(tmpdir(), "ads-chrome-"));
  const proc = spawn(
    findChrome(),
    [
      "--headless=new",
      "--remote-debugging-port=0",
      `--user-data-dir=${userDataDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--hide-scrollbars",
      "--force-color-profile=srgb",
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  const wsUrl = await new Promise((resolve, reject) => {
    let log = "";
    const timer = setTimeout(() => reject(new Error("Chrome did not expose a DevTools endpoint")), 30000);
    proc.stderr.on("data", (chunk) => {
      log += chunk;
      const match = /DevTools listening on (ws:\/\/\S+)/.exec(log);
      if (match) clearTimeout(timer), resolve(match[1]);
    });
    proc.on("exit", (code) => reject(new Error(`Chrome exited early (${code})\n${log}`)));
  });

  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => ((ws.onopen = resolve), (ws.onerror = reject)));
  let seq = 0;
  const pending = new Map();
  const listeners = new Set();
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(`${msg.error.message} ${msg.error.data || ""}`.trim()));
      else resolve(msg.result);
    } else for (const fn of listeners) fn(msg);
  };
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params, sessionId }));
    });

  async function newPage() {
    const { targetId } = await send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
    const cmd = (method, params) => send(method, params, sessionId);
    const on = (fn) => {
      const listener = (msg) => msg.sessionId === sessionId && fn(msg);
      listeners.add(listener);
      return () => listeners.delete(listener);
    };
    const errors = [];
    on(({ method, params }) => {
      if (method === "Runtime.exceptionThrown") errors.push(params.exceptionDetails.exception?.description || params.exceptionDetails.text);
      if (method === "Runtime.consoleAPICalled" && params.type === "error") errors.push(params.args.map((a) => a.value ?? a.description).join(" "));
    });
    await cmd("Page.enable");
    await cmd("Runtime.enable");
    await cmd("Network.enable");

    async function evaluate(expression) {
      const res = await cmd("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text);
      return res.result.value;
    }

    // Navigates and waits for load, network idle, web fonts and decoded images.
    async function goto(url, { idleMs = 800, timeout = 90000 } = {}) {
      const inflight = new Set();
      let lastActivity = Date.now();
      const off = on(({ method, params }) => {
        if (method === "Network.requestWillBeSent") inflight.add(params.requestId), (lastActivity = Date.now());
        if (method === "Network.loadingFinished" || method === "Network.loadingFailed") inflight.delete(params.requestId), (lastActivity = Date.now());
      });
      const loaded = new Promise((resolve) => {
        const stop = on(({ method }) => method === "Page.loadEventFired" && (stop(), resolve()));
      });
      await cmd("Page.navigate", { url });
      await loaded;
      const started = Date.now();
      while ((inflight.size || Date.now() - lastActivity < idleMs) && Date.now() - started < timeout) await sleep(100);
      off();
      await evaluate("document.fonts.ready.then(() => Promise.all([...document.images].map((img) => img.decode().catch(() => {}))))");
    }

    // Screenshots one element at `scale`; `slides` > 0 adds that many equal-width crops after the full frame.
    async function capture(selector, { scale = 2, slides = 0 } = {}) {
      // Background tabs don't run requestAnimationFrame, so focus this one first.
      await cmd("Page.bringToFront");
      const size = await evaluate(`(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) throw new Error("No element for " + ${JSON.stringify(selector)});
        if (!document.getElementById("ads-solo-css")) {
          const style = document.createElement("style");
          style.id = "ads-solo-css";
          style.textContent = ${JSON.stringify(SOLO_CSS)};
          document.head.appendChild(style);
          const stage = document.createElement("div");
          stage.id = "ads-stage";
          document.body.appendChild(stage);
          document.documentElement.classList.add("ads-solo");
        }
        document.getElementById("ads-stage").replaceChildren(el);
        return { width: el.offsetWidth, height: el.offsetHeight };
      })()`);
      await cmd("Emulation.setDeviceMetricsOverride", { width: size.width, height: size.height, deviceScaleFactor: scale, mobile: false });
      await evaluate("new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 50))))");
      const slideWidth = slides ? size.width / slides : 0;
      const clips = Array.from({ length: slides }, (_, i) => ({ x: i * slideWidth, y: 0, width: slideWidth, height: size.height }));
      const shots = [];
      for (const clip of [null, ...clips]) {
        const params = { format: "png", captureBeyondViewport: false };
        if (clip) params.clip = { ...clip, scale: 1 };
        const { data } = await cmd("Page.captureScreenshot", params);
        shots.push(Buffer.from(data, "base64"));
      }
      return { size, shots };
    }

    return { cmd, on, evaluate, goto, capture, errors };
  }

  return {
    newPage,
    async close() {
      ws.close();
      proc.kill();
      await sleep(300);
      await rm(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }).catch(() => {});
    },
  };
}

function parseArgs(argv) {
  const opts = { scale: 2, only: [], out: path.join(HERE, "png") };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--scale") opts.scale = Number(argv[++i]);
    else if (argv[i] === "--only") opts.only = argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
    else if (argv[i] === "--out") opts.out = path.resolve(argv[++i]);
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  if (!(opts.scale > 0)) throw new Error("--scale must be a positive number");
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const server = await serveDir(HERE);
  const chrome = await launchChrome();
  try {
    const page = await chrome.newPage();
    await page.goto(`${server.url}/index.html`);
    const ads = (
      await page.evaluate(
        "[...document.querySelectorAll('[data-ad-key]')].map((el) => ({ key: el.dataset.adKey, file: el.dataset.adFile, slides: Number(el.dataset.adSlides || 0) }))",
      )
    ).filter((ad) => !opts.only.length || opts.only.some((prefix) => ad.key === prefix || ad.key.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`)));
    if (!ads.length) throw new Error("No ads matched.");

    let written = 0;
    for (const ad of ads) {
      const { size, shots } = await page.capture(`[data-ad-key="${ad.key}"]`, { scale: opts.scale, slides: ad.slides });
      const files = [`${ad.file}.png`, ...Array.from({ length: ad.slides }, (_, i) => `${ad.file}-slide-${i + 1}.png`)];
      for (const [i, file] of files.entries()) {
        const dest = path.join(opts.out, file);
        await mkdir(path.dirname(dest), { recursive: true });
        await writeFile(dest, shots[i]);
        written++;
      }
      const px = (w, h) => `${Math.round(w * opts.scale)}×${Math.round(h * opts.scale)}`;
      console.log(`${ad.key.padEnd(22)} ${px(size.width, size.height).padEnd(10)} ${files.join(", ")}`);
    }
    if (page.errors.length) console.warn(`\nPage errors:\n${page.errors.join("\n")}`);
    console.log(`\n${written} PNGs at ${opts.scale}× → ${path.relative(process.cwd(), opts.out) || "."}`);
  } finally {
    await chrome.close();
    server.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
