// Premium hospitality bundles sold against an event — "VIP packages".
//
// A package is a ticket with a story attached: the same money and the same
// checkout, wrapped in imagery, a tagline and a list of what you get. That is
// why it stores alongside `event.tickets` in the event's metadata bag rather
// than in a table of its own — it is the same kind of thing, sold the same way.
//
// Packages are deliberately absent from the event's live page. They sell from
// their own standalone page, which has its own design and its own copy.
//
// Persists as three metadata keys:
//   event.packages       { intro, items }        — what is on offer
//   event.packagesPage   { enabled, hero, … }    — the standalone page's copy
//   event.packagesDesign  the design object PageDesignSection already edits

// The addon id the project-wide switch is stored under, in events.project_addons.
export const PACKAGES_ADDON_ID = "packages";

export const PACKAGE_MODES = [
  {
    key: "buy",
    label: "Sell directly",
    hint: "Opens checkout, like a ticket",
  },
  {
    key: "enquire",
    label: "Collect enquiries",
    hint: "Opens the enquiry form instead of taking payment",
  },
];

// The icon vocabulary offered per inclusion line. Kept small and named for what
// the line MEANS rather than what it draws, so the set can be restyled later
// without rewriting every saved package.
export const INCLUSION_ICONS = [
  { key: "ticket", label: "Ticket" },
  { key: "seat", label: "Seating" },
  { key: "location", label: "Location" },
  { key: "hospitality", label: "Food & drink" },
  { key: "photo", label: "Photo opportunity" },
  { key: "meet", label: "Meet & greet" },
  { key: "gift", label: "Gift or merchandise" },
  { key: "access", label: "Access & entry" },
  { key: "star", label: "Premium extra" },
];

export const EMPTY_PACKAGES = { intro: "", items: [] };

export const EMPTY_PACKAGES_PAGE = {
  enabled: false,
  title: "",
  subtitle: "",
  introHeading: "",
  introBody: "",
  introLinkLabel: "",
  introLinkUrl: "",
  gridHeading: "VIP Packages",
  // The optional "Why choose …" band.
  pitchEnabled: false,
  pitchHeading: "",
  pitchBody: "",
  pitchImage: "",
  pitchCtaLabel: "",
  // The enquiry form under it.
  leadsEnabled: false,
  leadsHeading: "",
  leadsConsent: "",
  leadsRecipient: "",
};

export function newPackage() {
  return {
    id: `pkg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: "",
    tagline: "",
    image: "",
    inclusions: [],
    details: "",
    price: 0,
    priceSuffix: "/pp",
    stock: null,
    ctaLabel: "",
    mode: "buy",
    visible: true,
  };
}

export function newInclusion() {
  return {
    id: `inc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    icon: "star",
    text: "",
  };
}

function normalizeInclusion(value, i) {
  const inc = value && typeof value === "object" ? value : {};
  return {
    id: inc.id || `inc-${i}`,
    icon: INCLUSION_ICONS.some((o) => o.key === inc.icon) ? inc.icon : "star",
    text: String(inc.text || ""),
  };
}

export function normalizePackage(value, i = 0) {
  const p = value && typeof value === "object" ? value : {};
  const stock = Number(p.stock);
  return {
    id: p.id || `pkg-${i}`,
    name: String(p.name || ""),
    tagline: String(p.tagline || ""),
    image: String(p.image || ""),
    inclusions: (Array.isArray(p.inclusions) ? p.inclusions : []).map(
      normalizeInclusion,
    ),
    details: String(p.details || ""),
    price: Number(p.price) || 0,
    priceSuffix: String(p.priceSuffix ?? "/pp"),
    // null is unlimited, which is different from 0 (none left).
    stock: Number.isFinite(stock) && p.stock !== null && p.stock !== "" ? stock : null,
    ctaLabel: String(p.ctaLabel || ""),
    mode: PACKAGE_MODES.some((m) => m.key === p.mode) ? p.mode : "buy",
    visible: p.visible !== false,
  };
}

export function normalizePackages(value) {
  const cfg = value && typeof value === "object" ? value : {};
  const items = Array.isArray(cfg.items) ? cfg.items : [];
  return {
    intro: String(cfg.intro || ""),
    items: items.map(normalizePackage),
  };
}

export function normalizePackagesPage(value) {
  const cfg = value && typeof value === "object" ? value : {};
  return { ...EMPTY_PACKAGES_PAGE, ...cfg, enabled: Boolean(cfg.enabled) };
}

/** The packages a buyer should actually see — named, visible, not sold out. */
export function sellablePackages(event) {
  return normalizePackages(event?.packages).items.filter(
    (p) => p.visible && p.name.trim(),
  );
}

export function packageSoldOut(pkg) {
  return pkg.stock !== null && pkg.stock <= 0;
}

/**
 * A package in the shape checkout understands.
 *
 * Checkout was built for tickets and needs to know nothing about packages — the
 * order it writes records this name and id exactly as it would a ticket's.
 */
export function packageAsTicket(pkg) {
  return {
    id: pkg.id,
    name: pkg.name,
    price: pkg.price,
    remaining: pkg.stock,
  };
}
