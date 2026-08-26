
const PRIVATE_V4 =
  /^(?:127\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.|0\.)/;

export function isBlockedHost(hostname) {
  const h = (hostname || "").toLowerCase().replace(/^\[|\]$/g, "");
  if (!h) return true;
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (h === "::1" || h === "0.0.0.0") return true;
  if (PRIVATE_V4.test(h)) return true;
  return false;
}

export function normalizeUrl(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.port && url.port !== "80" && url.port !== "443") return null;
  if (isBlockedHost(url.hostname)) return null;
  return url;
}

export function absoluteUrl(base, href) {
  if (!href) return null;
  const v = String(href).trim();
  if (!v || v.startsWith("data:") || v.startsWith("javascript:")) return null;
  try {
    return new URL(v, base).toString();
  } catch {
    return null;
  }
}
