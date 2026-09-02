// Mirrors lib/video-embed.js in the web app: Geiger never hosts the media, so a
// recording URL is either a direct file the native player can open or a
// YouTube/Vimeo embed that it cannot.
export type VideoSource =
  | { type: "file"; src: string }
  | { type: "embed"; src: string }
  | { type: "none"; src: "" };

const YT_HOSTS = ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"];
const VIMEO_HOSTS = ["vimeo.com", "www.vimeo.com", "player.vimeo.com"];
const FILE_RE = /\.(mp4|webm|ogg|ogv|mov|m4v|m3u8|mpd)(\?.*)?$/i;

function safeUrl(raw: string | null | undefined): URL | null {
  const url = (raw || "").trim();
  if (!url) return null;
  try {
    return new URL(url);
  } catch {
    try {
      return new URL(`https://${url}`);
    } catch {
      return null;
    }
  }
}

export function resolveVideo(raw: string | null | undefined): VideoSource {
  const u = safeUrl(raw);
  if (!u) return { type: "none", src: "" };
  const host = u.hostname.toLowerCase();

  if (YT_HOSTS.includes(host)) {
    let id = "";
    if (host === "youtu.be") id = u.pathname.slice(1);
    else if (u.pathname.startsWith("/embed/") || u.pathname.startsWith("/shorts/"))
      id = u.pathname.split("/")[2] || "";
    else id = u.searchParams.get("v") || "";
    if (id) return { type: "embed", src: `https://www.youtube.com/watch?v=${id}` };
  }

  if (VIMEO_HOSTS.includes(host)) return { type: "embed", src: u.href };

  // HLS and progressive files stream natively; everything else is a page.
  if (FILE_RE.test(u.pathname)) return { type: "file", src: u.href };
  if (u.pathname.includes("/embed")) return { type: "embed", src: u.href };

  return { type: "embed", src: u.href };
}
