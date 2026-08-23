// Shared outbound fetch for the clip proxy routes.
//
// Server-only. Every request the picker makes on the user's behalf goes through
// here so the timeout, size cap, and user-agent are stated once.

const TIMEOUT_MS = 12000;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// A page and its assets both travel back through a serverless response, so each
// needs a ceiling. Pages skew large once inline CSS is counted; a single asset
// over 8 MB is a video or a font dump nobody is clipping.
export const MAX_PAGE_BYTES = 4 * 1024 * 1024;
export const MAX_ASSET_BYTES = 8 * 1024 * 1024;

export async function fetchUpstream(url, { referer } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent": UA,
        accept: "*/*",
        "accept-language": "en-US,en;q=0.9",
        ...(referer ? { referer } : {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Read a response body, refusing anything past `cap` rather than truncating. */
export async function readCapped(res, cap) {
  const declared = Number(res.headers.get("content-length") || 0);
  if (declared && declared > cap) return null;
  const buf = await res.arrayBuffer();
  if (buf.byteLength > cap) return null;
  return buf;
}
