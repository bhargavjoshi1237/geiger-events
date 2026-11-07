
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
    } else if (/^\/(embed|shorts|live)\//.test(u.pathname)) {
      id = u.pathname.split("/")[2] || "";
    } else {
      id = u.searchParams.get("v") || "";
    }
    if (id) return { type: "iframe", src: `https://www.youtube-nocookie.com/embed/${id}` };
  }

  if (VIMEO_HOSTS.includes(host)) {
    if (host === "player.vimeo.com") return { type: "iframe", src: u.href };
    // Unlisted share links carry a privacy hash after the id (vimeo.com/<id>/<hash>); the player needs it as ?h=.
    const parts = u.pathname.split("/").filter(Boolean);
    const at = parts.findIndex((part) => /^\d+$/.test(part));
    if (at >= 0) {
      const hash = /^[0-9a-f]+$/i.test(parts[at + 1] || "") ? parts[at + 1] : u.searchParams.get("h");
      return { type: "iframe", src: `https://player.vimeo.com/video/${parts[at]}${hash ? `?h=${hash}` : ""}` };
    }
  }

  if (FILE_RE.test(u.pathname)) return { type: "video", src: u.href };

  if (u.pathname.includes("/embed")) return { type: "iframe", src: u.href };

  return { type: "video", src: u.href };
}

export function isPlayable(raw) {
  return toEmbed(raw).type !== "none";
}
