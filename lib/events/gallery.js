
export const GALLERY_LAYOUTS = [
  { key: "grid", label: "Grid" },
  { key: "carousel", label: "Carousel" },
];

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

export function resolveGallery(value) {
  const g = value && typeof value === "object" ? value : {};
  const seconds = Number(g.autoplaySeconds);
  const slides = Number(g.slidesPerView);
  return {
    layout: g.layout === "carousel" ? "carousel" : "grid",
    slidesPerView:
      slides >= 1 && slides <= 4 ? Math.round(slides) : DEFAULT_GALLERY.slidesPerView,
    autoplay: g.autoplay === true,
    autoplaySeconds:
      seconds >= 1 && seconds <= 60 ? seconds : DEFAULT_GALLERY.autoplaySeconds,
    loop: g.loop !== false,
    arrows: g.arrows !== false,
    dots: g.dots !== false,
  };
}

export const GALLERY_ITEM_FIT_OPTIONS = [
  { key: "cover", label: "Cover" },
  { key: "contain", label: "Fit" },
  { key: "fill", label: "Stretch" },
];

export const GALLERY_LINK_TYPE_OPTIONS = [
  { key: "auto", label: "Auto-detect" },
  { key: "image", label: "Image" },
  { key: "video", label: "Video" },
];

const VIDEO_FILE_RE = /\.(mp4|webm|ogv|mov|m3u8)(\?|#|$)/i;

export function isVideoFileUrl(url) {
  return VIDEO_FILE_RE.test(String(url || ""));
}

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

export function vimeoId(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  let u;
  try {
    u = new URL(raw);
  } catch {
    return "";
  }
  if (!/(^|\.)vimeo\.com$/.test(u.hostname.replace(/^www\./, ""))) return "";
  const digits = u.pathname.split("/").filter((s) => /^\d+$/.test(s));
  return digits.length ? digits[digits.length - 1] : "";
}

export function videoEmbed(url, { autoplay = false, muted = false, loop = false } = {}) {
  const raw = String(url || "").trim();
  if (!raw) return null;

  const yt = youtubeId(raw);
  if (yt) {
    const params = new URLSearchParams({
      rel: "0",
      autoplay: autoplay ? "1" : "0",
      mute: muted ? "1" : "0",
    });
    if (loop) {
      params.set("loop", "1");
      params.set("playlist", yt);
    }
    return {
      kind: "iframe",
      provider: "youtube",
      videoId: yt,
      embedUrl: `https://www.youtube-nocookie.com/embed/${yt}?${params}`,
      thumbUrl: `https://img.youtube.com/vi/${yt}/hqdefault.jpg`,
      title: "YouTube video player",
    };
  }

  const vm = vimeoId(raw);
  if (vm) {
    const params = new URLSearchParams({
      autoplay: autoplay ? "1" : "0",
      muted: muted ? "1" : "0",
      loop: loop ? "1" : "0",
    });
    return {
      kind: "iframe",
      provider: "vimeo",
      videoId: vm,
      embedUrl: `https://player.vimeo.com/video/${vm}?${params}`,
      thumbUrl: "",
      title: "Vimeo video player",
    };
  }

  if (isVideoFileUrl(raw)) {
    return { kind: "file", provider: "file", embedUrl: raw, thumbUrl: "", title: "" };
  }

  return null;
}

export function entryUrl(entry) {
  return typeof entry === "string" ? entry : entry?.url || "";
}

export function galleryItem(entry) {
  const raw = typeof entry === "string" ? { url: entry } : entry || {};
  const url = raw.url || "";
  const type = raw.type === "image" || raw.type === "video" ? raw.type : "auto";
  const youtube = youtubeId(url);
  const isVideo =
    type === "video" || (type === "auto" && (youtube || isVideoFileUrl(url)));

  if (isVideo) {
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

export function patchGalleryItem(gallery, url, patch) {
  return (gallery || []).map((entry) => {
    if (entryUrl(entry) !== url) return entry;
    const base = typeof entry === "string" ? { url: entry } : entry;
    return { ...base, ...patch };
  });
}

export function isSupportedMediaUrl(url) {
  try {
    const u = new URL(String(url || "").trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
