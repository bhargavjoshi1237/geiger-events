// Extra call-to-action buttons on the event's tickets card.
//
// The card's own Get Tickets button is deliberately NOT one of these. It is
// always rendered, always first, and can only be relabelled — selling the ticket
// is the card's job and an organizer should not be able to configure it away.
// Everything here describes the buttons stacked underneath it: a waitlist, a
// hospitality enquiry, a sponsor pack.
//
// Persists as `event.ctas` — { primaryLabel, items } — one metadata key.

export const CTA_STYLES = [
  { key: "primary", label: "Primary", hint: "Filled, in your accent colour" },
  { key: "outline", label: "Outline", hint: "Bordered — quieter than primary" },
  { key: "ghost", label: "Text", hint: "No border, the quietest option" },
];

export const EMPTY_CTAS = { primaryLabel: "", items: [] };

// Schemes that execute rather than navigate. A CTA's href is organizer-typed and
// lands in an <a>, so this is the one check that must not be skipped.
const UNSAFE = /^\s*(javascript|data|vbscript|file):/i;

/**
 * A safe href for a CTA, or null when it can't be linked.
 *
 * Accepts what an organizer actually types: a bare host, a full URL, a mail or
 * phone link, a same-page anchor.
 */
export function ctaHref(url) {
  const raw = String(url || "").trim();
  if (!raw || UNSAFE.test(raw)) return null;
  if (raw.startsWith("#") || raw.startsWith("/")) return raw;
  if (/^(mailto:|tel:)/i.test(raw)) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  // Bare host with no scheme — much the commonest thing typed into this field.
  return `https://${raw}`;
}

/** True when following the link leaves the page. */
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

/** The CTAs worth rendering — a label and a usable link are both required. */
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
