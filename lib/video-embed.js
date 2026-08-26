
const YT_HOSTS = ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"];
const VIMEO_HOSTS = ["vimeo.com", "www.vimeo.com", "player.vimeo.com"];
const FILE_RE = /\.(mp4|webm|ogg|ogv|mov|m4v)(\?.*)?$/i;

function safeUrl(raw) {
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

export function toEmbed(raw) {
  const u = safeUrl(raw);
  if (!u) return { type: "none", src: "" };
  const host = u.hostname.toLowerCase();

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

  if (VIMEO_HOSTS.includes(host)) {
    if (host === "player.vimeo.com") return { type: "iframe", src: u.href };
    const id = (u.pathname.split("/").filter(Boolean)[0] || "").replace(/\D/g, "");
    if (id) return { type: "iframe", src: `https://player.vimeo.com/video/${id}` };
  }

  if (FILE_RE.test(u.pathname)) return { type: "video", src: u.href };

  if (u.pathname.includes("/embed")) return { type: "iframe", src: u.href };

  return { type: "video", src: u.href };
}

export function isPlayable(raw) {
  return toEmbed(raw).type !== "none";
}
