
import { normalizeUrl } from "@/lib/brand/extract";

const TIMEOUT_MS = 8000;
const MAX_HTML = 2 * 1024 * 1024;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function absolute(base, href) {
  if (!href) return null;
  const v = href.trim();
  if (!v || v.startsWith("data:") || v.startsWith("javascript:")) return null;
  try {
    return new URL(v, base).toString();
  } catch {
    return null;
  }
}

async function fetchPage(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "user-agent": UA },
    });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const text = new TextDecoder("utf-8").decode(
      new Uint8Array(buf).subarray(0, MAX_HTML),
    );
    return { text, url: res.url || url };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const ATTR_RE =
  /([a-zA-Z_:-][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;

const ENTITIES = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };

function decodeEntities(value) {
  return String(value).replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, body) => {
    if (body[0] === "#") {
      const code =
        body[1] === "x" || body[1] === "X"
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[body.toLowerCase()] ?? whole;
  });
}

function attrs(tag) {
  const out = {};
  ATTR_RE.lastIndex = 0;
  let m;
  while ((m = ATTR_RE.exec(tag))) {
    out[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? "");
  }
  return out;
}

function tags(html, name) {
  const re = new RegExp(`<${name}\\b[^>]*>`, "gi");
  return (html.match(re) || []).map(attrs);
}

export async function extractCloneAssets(input) {
  const url = normalizeUrl(input);
  if (!url) {
    return { error: { code: "bad_url", message: "Enter a public page URL." } };
  }

  let page;
  try {
    page = await fetchPage(url.toString());
  } catch {
    page = null;
  }
  if (!page?.text) {
    return {
      error: {
        code: "unreachable",
        message: "Couldn't read that page. Check the address and try again.",
      },
    };
  }

  const base = page.url;
  const html = page.text;
  const assets = [];
  const seen = new Set();

  const fileRe =
    /([^\s"'<>()]+?\.(?:css|js)(?:\?[^\s"'<>()]*)?)(?=[\s"'<>()]|$)/gi;
  let file;
  while ((file = fileRe.exec(html))) {
    const abs = absolute(base, file[1]);
    if (!abs || seen.has(abs)) continue;
    seen.add(abs);
    assets.push({ kind: /\.css(?:\?|$)/i.test(abs) ? "css" : "js", url: abs });
  }

  for (const s of tags(html, "script")) {
    if (!s.src) continue;
    const abs = absolute(base, s.src);
    if (!abs) continue;
    const hit = assets.find((a) => a.url === abs);
    if (hit && hit.kind === "js") {
      hit.module = (s.type || "").toLowerCase() === "module";
      hit.defer = !!s.defer;
    }
  }

  return { assets };
}
