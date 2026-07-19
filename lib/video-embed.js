// Turn an external video URL into something renderable client-side. Geiger Events
// never hosts the video — a recording's link points at YouTube / Vimeo / a direct
// file, and both the in-app preview and the public /r/<id> page render it from
// here. Returns { type, src }:
//   "iframe" → embed in an <iframe> (YouTube, Vimeo, generic embeddable)
//   "video"  → play directly in a <video> tag (mp4/webm/ogg/mov, or a stream)
//   "none"   → nothing usable (empty/invalid URL)

const YT_HOSTS = ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"];
const VIMEO_HOSTS = ["vimeo.com", "www.vimeo.com", "player.vimeo.com"];
const FILE_RE = /\.(mp4|webm|ogg|ogv|mov|m4v)(\?.*)?$/i;

function safeUrl(raw) {
  const url = (raw || "").trim();
  if (!url) return null;
  try {
    return new URL(url);
  } catch {
    // Tolerate a bare "youtu.be/..." or "youtube.com/..." with no protocol.
    try {
      return new URL(`https://${url}`);
    } catch {
      return null;
    }
  }
}

export function toEmbed(raw) {
  const u = safeUrl(raw);
  if (!u) return { type: "none", src: "" };
  const host = u.hostname.toLowerCase();

  // YouTube → nocookie embed.
  if (YT_HOSTS.includes(host)) {
    let id = "";
    if (host === "youtu.be") {
      id = u.pathname.slice(1);
    } else if (u.pathname.startsWith("/embed/")) {
      id = u.pathname.split("/")[2] || "";
    } else if (u.pathname.startsWith("/shorts/")) {
      id = u.pathname.split("/")[2] || "";
    } else {
      id = u.searchParams.get("v") || "";
    }
    if (id) return { type: "iframe", src: `https://www.youtube-nocookie.com/embed/${id}` };
  }

  // Vimeo → player embed.
  if (VIMEO_HOSTS.includes(host)) {
    if (host === "player.vimeo.com") return { type: "iframe", src: u.href };
    const id = (u.pathname.split("/").filter(Boolean)[0] || "").replace(/\D/g, "");
    if (id) return { type: "iframe", src: `https://player.vimeo.com/video/${id}` };
  }

  // Direct media file → <video>.
  if (FILE_RE.test(u.pathname)) return { type: "video", src: u.href };

  // Anything else that's already an /embed/ path → trust it as an iframe.
  if (u.pathname.includes("/embed")) return { type: "iframe", src: u.href };

  // Fallback: assume it's a playable source for <video> (HLS/streams degrade to
  // "open link" on the page). Keeping it as "video" avoids embedding arbitrary
  // pages that block framing.
  return { type: "video", src: u.href };
}

// True when the URL yields something we can actually render inline.
export function isPlayable(raw) {
  return toEmbed(raw).type !== "none";
}
