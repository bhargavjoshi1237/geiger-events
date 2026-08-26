
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
  pitchEnabled: false,
  pitchHeading: "",
  pitchBody: "",
  pitchImage: "",
  pitchCtaLabel: "",
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

export function sellablePackages(event) {
  return normalizePackages(event?.packages).items.filter(
    (p) => p.visible && p.name.trim(),
  );
}

export function packageSoldOut(pkg) {
  return pkg.stock !== null && pkg.stock <= 0;
}

export function packageAsTicket(pkg) {
  return {
    id: pkg.id,
    name: pkg.name,
    price: pkg.price,
    remaining: pkg.stock,
  };
}
