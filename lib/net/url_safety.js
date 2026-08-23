// Outbound-fetch URL guards, shared by every feature that reads a user-supplied
// public URL (brand import, web clip). Kept in one place because duplicating an
// SSRF check is how one copy quietly falls behind the other.
//
// This is a hostname/literal-IP check, not a resolved-address one — combined
// with the port allow-list it stops the obvious SSRF shapes without a DNS hop.

const PRIVATE_V4 =
  /^(?:127\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.|0\.)/;

// Hostnames that must never be fetched: loopback, link-local, and RFC1918 space.
export function isBlockedHost(hostname) {
  const h = (hostname || "").toLowerCase().replace(/^\[|\]$/g, "");
  if (!h) return true;
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (h === "::1" || h === "0.0.0.0") return true;
  if (/^f[cd][0-9a-f]{2}:/i.test(h)) return true; // unique-local IPv6
  if (/^fe80:/i.test(h)) return true; // link-local IPv6
  if (PRIVATE_V4.test(h)) return true;
  if (!h.includes(".") && !h.includes(":")) return true; // bare host, no TLD
  return false;
}

// Accept "example.com" as well as a full URL. Returns a URL or null.
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

// Resolve `href` against `base`, rejecting the schemes that can't be fetched.
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
