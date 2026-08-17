// The event gallery: how it lays out on the public page, and what each entry
// actually is. An entry on `event.gallery` is either a plain URL string
// (legacy, or freshly uploaded/linked) or `{ url, ...settings }` once an
// organizer customizes it — an uploaded photo, a linked image, or a YouTube
// link — and the kind is derived from the URL, so both shapes read the same
// way everywhere below.
//
// Gallery-wide display settings (layout, carousel behavior) live beside the
// images in the event's metadata bag under `galleryDisplay` (the same pattern
// as `guestsDisplay`); per-item settings (image fit, video autoplay) live on
// the entry itself. Both are edited from Content & media.

export const GALLERY_LAYOUTS = [
  { key: "grid", label: "Grid" },
  { key: "carousel", label: "Carousel" },
];

// Slides across at desktop width. Narrower viewports step down on their own
// (see the renderer) so a 4-up carousel never shows four stamp-sized photos.
export const GALLERY_SLIDES_OPTIONS = [
  { key: 1, label: "1" },
  { key: 2, label: "2" },
  { key: 3, label: "3" },
  { key: 4, label: "4" },
];

export const DEFAULT_GALLERY = {
  layout: "grid",
  slidesPerView: 3,
  autoplay: false,
  autoplaySeconds: 5,
  loop: true,
  arrows: true,
  dots: true,
};

// Field-by-field defaults: events predate the settings bag entirely, and a
// partially-written one must never hand the renderer an undefined.
export function resolveGallery(value) {
  const g = value && typeof value === "object" ? value : {};
  const seconds = Number(g.autoplaySeconds);
  const slides = Number(g.slidesPerView);
  return {
    layout: g.layout === "carousel" ? "carousel" : "grid",
    slidesPerView:
      slides >= 1 && slides <= 4 ? Math.round(slides) : DEFAULT_GALLERY.slidesPerView,
    autoplay: g.autoplay === true,
    // Clamped: a sub-second interval is a strobe, and the number input lets an
    // organizer type anything.
    autoplaySeconds:
      seconds >= 1 && seconds <= 60 ? seconds : DEFAULT_GALLERY.autoplaySeconds,
    loop: g.loop !== false,
    arrows: g.arrows !== false,
    dots: g.dots !== false,
  };
}

// --- Per-item settings ---------------------------------------------------

// How an image tile is cropped/scaled within its frame.
export const GALLERY_ITEM_FIT_OPTIONS = [
  { key: "cover", label: "Cover" },
  { key: "contain", label: "Fit" },
  { key: "fill", label: "Stretch" },
];

// Auto-detection only recognizes YouTube links and a handful of direct video
// file extensions — a plain CDN URL with no extension (common — plenty of
// hosts serve /video/1234) can't be told apart from an image by the link
// alone. `type` lets an organizer override the guess instead.
export const GALLERY_LINK_TYPE_OPTIONS = [
  { key: "auto", label: "Auto-detect" },
  { key: "image", label: "Image" },
  { key: "video", label: "Video" },
];

const VIDEO_FILE_RE = /\.(mp4|webm|ogv|mov|m3u8)(\?|#|$)/i;

// Whether a URL looks like a direct video file (not a YouTube page) by its
// extension. Best-effort only — see the `type` override above.
export function isVideoFileUrl(url) {
  return VIDEO_FILE_RE.test(String(url || ""));
}

// The kind of an event cover: "image" or "video". Only direct video files are
// supported as covers — a YouTube link needs its own player chrome, which the
// hero's cover slot doesn't host, so it stays an image there.
export function coverKind(url) {
  return isVideoFileUrl(url) ? "video" : "image";
}

const FIT_CLASS = {
  cover: "object-cover",
  contain: "object-contain",
  fill: "object-fill",
};

export function fitClass(fit) {
  return FIT_CLASS[fit] || FIT_CLASS.cover;
}

// --- Media kinds -------------------------------------------------------------

// The id out of any of YouTube's link shapes — watch, share, embed, shorts,
// live — or "" when this isn't a YouTube URL.
export function youtubeId(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  let u;
  try {
    u = new URL(raw);
  } catch {
    return "";
  }
  const host = u.hostname.replace(/^www\./, "");
  if (host === "youtu.be") return u.pathname.slice(1).split("/")[0] || "";
  if (host !== "youtube.com" && host !== "m.youtube.com") return "";
  if (u.pathname === "/watch") return u.searchParams.get("v") || "";
  const m = u.pathname.match(/^\/(embed|shorts|live|v)\/([^/?#]+)/);
  return m ? m[2] : "";
}

// The URL out of either entry shape, for comparisons/keys.
export function entryUrl(entry) {
  return typeof entry === "string" ? entry : entry?.url || "";
}

// A gallery entry, classified and resolved to its display settings. Accepts
// the legacy plain-URL string shape and the current `{ url, ...settings }`
// shape so nothing stored ever has to be migrated.
//
// `type` ("auto" | "image" | "video") lets an organizer override what
// auto-detection guesses — needed for a direct video file on a host whose
// URLs don't carry a recognizable extension. A YouTube link always embeds
// through YouTube (`format: "youtube"`); any other video plays as a native
// `<video>` element (`format: "file"`), which has no fetchable poster frame
// so `thumbUrl` is empty and the tile falls back to the video itself.
export function galleryItem(entry) {
  const raw = typeof entry === "string" ? { url: entry } : entry || {};
  const url = raw.url || "";
  const type = raw.type === "image" || raw.type === "video" ? raw.type : "auto";
  const youtube = youtubeId(url);
  const isVideo =
    type === "video" || (type === "auto" && (youtube || isVideoFileUrl(url)));

  if (isVideo) {
    // Autoplay defaults on — the visitor opened the lightbox deliberately.
    const autoplay = raw.autoplay !== false;
    const muted = raw.muted === true;
    const loop = raw.loop === true;
    if (youtube) {
      const params = new URLSearchParams({
        rel: "0",
        autoplay: autoplay ? "1" : "0",
        mute: muted ? "1" : "0",
      });
      if (loop) {
        // YouTube only loops a single video when it's also its own playlist.
        params.set("loop", "1");
        params.set("playlist", youtube);
      }
      return {
        url,
        type,
        kind: "video",
        format: "youtube",
        videoId: youtube,
        thumbUrl: `https://img.youtube.com/vi/${youtube}/hqdefault.jpg`,
        embedUrl: `https://www.youtube-nocookie.com/embed/${youtube}?${params}`,
        autoplay,
        muted,
        loop,
      };
    }
    return {
      url,
      type,
      kind: "video",
      format: "file",
      thumbUrl: "",
      autoplay,
      muted,
      loop,
    };
  }
  return {
    url,
    type,
    kind: "image",
    thumbUrl: url,
    fit: GALLERY_ITEM_FIT_OPTIONS.some((o) => o.key === raw.fit)
      ? raw.fit
      : "cover",
  };
}

// Merge a settings patch into the one entry matching `url`, upgrading it from
// the legacy string shape to `{ url, ...settings }` the first time it's
// customized. Other entries pass through untouched.
export function patchGalleryItem(gallery, url, patch) {
  return (gallery || []).map((entry) => {
    if (entryUrl(entry) !== url) return entry;
    const base = typeof entry === "string" ? { url: entry } : entry;
    return { ...base, ...patch };
  });
}

// Whether a pasted string is something the gallery can show at all. Images are
// taken on trust (no extension sniffing — plenty of CDNs serve /image/1234),
// so this only rejects what isn't an http(s) URL.
export function isSupportedMediaUrl(url) {
  try {
    const u = new URL(String(url || "").trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
