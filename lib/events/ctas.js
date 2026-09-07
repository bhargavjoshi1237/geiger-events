
export const CTA_STYLES = [
  { key: "primary", label: "Primary", hint: "Filled, in your accent colour" },
  { key: "outline", label: "Outline", hint: "Bordered — quieter than primary" },
  { key: "ghost", label: "Text", hint: "No border, the quietest option" },
];

export const EMPTY_CTAS = { primaryLabel: "", items: [] };

const UNSAFE = /^\s*(javascript|data|vbscript|file):/i;

// CTAs render as plain <a>, which — unlike next/link — gets no basePath. A
// root-relative CTA pointing at an in-app route (the packages page, an event
// wall) would 404 in production without this. Idempotent: a URL the organiser
// already wrote with the prefix is left alone.
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

function withBasePath(path) {
  if (!BASE || path === BASE || path.startsWith(`${BASE}/`)) return path;
  return `${BASE}${path}`;
}

export function ctaHref(url) {
  const raw = String(url || "").trim();
  if (!raw || UNSAFE.test(raw)) return null;
  if (raw.startsWith("#")) return raw;
  if (raw.startsWith("/")) return withBasePath(raw);
  if (/^(mailto:|tel:)/i.test(raw)) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

export function ctaIsExternal(href) {
  return /^https?:\/\//i.test(String(href || ""));
}

export function normalizeCtas(value) {
  const cfg = value && typeof value === "object" ? value : {};
  const items = Array.isArray(cfg.items) ? cfg.items : [];
  return {
    primaryLabel: String(cfg.primaryLabel || ""),
    items: items.map((item, i) => ({
      id: item?.id || `cta-${i}`,
      label: String(item?.label || ""),
      url: String(item?.url || ""),
      style: CTA_STYLES.some((s) => s.key === item?.style)
        ? item.style
        : "outline",
    })),
  };
}

export function activeCtas(event) {
  return normalizeCtas(event?.ctas).items
    .map((item) => ({ ...item, href: ctaHref(item.url) }))
    .filter((item) => item.label.trim() && item.href);
}

export function newCta() {
  return {
    id: `cta-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    label: "",
    url: "",
    style: "outline",
  };
}
