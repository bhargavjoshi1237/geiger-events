// Sponsorship model — spots an event sells, the fills that occupy them, the public prospectus, and how sponsors show on the event page.
// Pure data: imported by the editor and by the anonymous public pages, so no React or lucide here.

import { ctaHref } from "./ctas.js";

// ---------------------------------------------------------------- ids ---

const uid = (prefix) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

const str = (v) => (typeof v === "string" ? v : "");
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const oneOf = (list, value, fallback) =>
  list.some((o) => o.key === value) ? value : fallback;

// -------------------------------------------------------------- spots ---

export const FILL_STATUSES = [
  { key: "pending", label: "Pending", hint: "Agreed, not yet settled" },
  { key: "confirmed", label: "Confirmed", hint: "Settled — shown on the event page" },
];

export function newSpot(patch = {}) {
  return {
    id: uid("spot"),
    name: "",
    tier: "",
    description: "",
    benefits: [],
    price: null,
    quantity: 1,
    open: true,
    sourcePackageId: null,
    fills: [],
    ...patch,
  };
}

/** Seed a spot from a Sponsorship Package record — copied once, never synced. */
export function spotFromPackage(record) {
  const cfg = record?.config || {};
  return newSpot({
    name: record?.name || "",
    tier: str(cfg.tier),
    description: str(cfg.description),
    benefits: Array.isArray(cfg.benefits) ? cfg.benefits.filter(Boolean) : [],
    price: Number(cfg.price) > 0 ? Number(cfg.price) : null,
    quantity: Math.max(1, Math.round(num(cfg.slots)) || 1),
    sourcePackageId: record?.id || null,
  });
}

/** The public face of a sponsor record, snapshotted into a fill because anon can't read conference_records. */
export function sponsorSnapshot(record) {
  const cfg = record?.config || {};
  return {
    name: record?.name || "",
    logoUrl: record?.coverUrl || "",
    website: str(cfg.website),
    description: str(cfg.description),
  };
}

export function newFill(patch = {}) {
  return {
    id: uid("fill"),
    sponsorId: null,
    amount: 0,
    status: "confirmed",
    note: "",
    enquiryId: null,
    sponsor: sponsorSnapshot(null),
    ...patch,
  };
}

function normalizeFill(value) {
  const f = value && typeof value === "object" ? value : {};
  const s = f.sponsor && typeof f.sponsor === "object" ? f.sponsor : {};
  return {
    id: f.id || uid("fill"),
    sponsorId: f.sponsorId || null,
    amount: Math.max(0, num(f.amount)),
    status: oneOf(FILL_STATUSES, f.status, "confirmed"),
    note: str(f.note),
    enquiryId: f.enquiryId || null,
    sponsor: {
      name: str(s.name),
      logoUrl: str(s.logoUrl),
      website: str(s.website),
      description: str(s.description),
    },
  };
}

export function normalizeSpot(value) {
  const s = value && typeof value === "object" ? value : {};
  const price = Number(s.price);
  return {
    id: s.id || uid("spot"),
    name: str(s.name),
    tier: str(s.tier),
    description: str(s.description),
    benefits: Array.isArray(s.benefits) ? s.benefits.map(str).filter(Boolean) : [],
    price: Number.isFinite(price) && price > 0 ? price : null,
    quantity: Math.max(1, Math.round(num(s.quantity)) || 1),
    reserved: Math.max(0, Math.round(num(s.reserved))),
    open: s.open !== false,
    sourcePackageId: s.sourcePackageId || null,
    fills: Array.isArray(s.fills) ? s.fills.map(normalizeFill) : [],
  };
}

export const EMPTY_SPONSORSHIP = { spots: [] };

export function normalizeSponsorship(value) {
  const v = value && typeof value === "object" ? value : {};
  return { spots: Array.isArray(v.spots) ? v.spots.map(normalizeSpot) : [] };
}

/** Filled counts pending fills too — a spot promised to someone isn't available. */
export function spotCounts(spot) {
  const filled = Math.max(spot.fills.length, spot.reserved || 0);
  const confirmed = spot.fills.filter((f) => f.status === "confirmed").length;
  return { filled, confirmed, left: Math.max(0, spot.quantity - filled) };
}

export function sponsorshipTotals(spots) {
  let slots = 0;
  let filled = 0;
  let committed = 0;
  for (const spot of spots) {
    slots += spot.quantity;
    filled += spot.fills.length;
    for (const f of spot.fills) committed += f.amount;
  }
  return { slots, filled, left: Math.max(0, slots - filled), committed };
}

/** The legacy attach key, kept truthful so older readers of metadata.sponsorIds still work. */
export function confirmedSponsorIds(spots) {
  const ids = new Set();
  for (const spot of spots)
    for (const f of spot.fills)
      if (f.status === "confirmed" && f.sponsorId) ids.add(f.sponsorId);
  return [...ids];
}

/** Put a fill into a spot, moving it out of whichever spot held it before. */
export function placeFill(spots, spotId, fill) {
  return spots.map((spot) => {
    const rest = spot.fills.filter((f) => f.id !== fill.id);
    const existing = spot.fills.findIndex((f) => f.id === fill.id);
    if (spot.id !== spotId) return { ...spot, fills: rest };
    const fills = [...rest];
    fills.splice(existing >= 0 ? existing : fills.length, 0, fill);
    return { ...spot, fills };
  });
}

export function removeFill(spots, fillId) {
  return spots.map((spot) => ({ ...spot, fills: spot.fills.filter((f) => f.id !== fillId) }));
}

/** Refresh every fill's public snapshot from the live sponsor records. */
export function refreshSnapshots(spots, records) {
  const byId = new Map((records || []).map((r) => [r.id, r]));
  return spots.map((spot) => ({
    ...spot,
    fills: spot.fills.map((f) =>
      byId.has(f.sponsorId) ? { ...f, sponsor: sponsorSnapshot(byId.get(f.sponsorId)) } : f,
    ),
  }));
}

export function formatSpotPrice(spot, currency = "USD") {
  if (!spot?.price) return "On request";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(spot.price);
  } catch {
    return String(spot.price);
  }
}

// ---------------------------------------------------- prospectus page ---

// Always collected: converting an enquiry into a sponsor needs a company, a person and an address.
export const FIXED_ENQUIRY_FIELDS = [
  { id: "company", label: "Company", type: "text", required: true },
  { id: "contactName", label: "Your name", type: "text", required: true },
  { id: "email", label: "Email", type: "email", required: true },
];

export const EMPTY_SPONSORSHIP_PAGE = {
  enabled: false,
  title: "",
  subtitle: "",
  intro: "",
  showPrices: true,
  showFilled: true,
  contactHeading: "Talk to us",
  contactEmail: "",
  contactPhone: "",
  contactWhatsapp: "",
  bookingUrl: "",
  bookingLabel: "Book a call",
  contactNote: "",
  formEnabled: true,
  formHeading: "Register your interest",
  formIntro: "",
  fields: [],
  consent: "",
  successMessage: "",
};

function normalizeField(value) {
  const f = value && typeof value === "object" ? value : {};
  return {
    id: f.id || uid("q"),
    label: str(f.label),
    type: str(f.type) || "text",
    required: !!f.required,
    ...(Array.isArray(f.options) ? { options: f.options.map(str).filter(Boolean) } : {}),
    ...(f.showWhen?.fieldId ? { showWhen: { fieldId: f.showWhen.fieldId, equals: str(f.showWhen.equals) } } : {}),
  };
}

export function normalizeSponsorshipPage(value) {
  const v = value && typeof value === "object" ? value : {};
  const out = { ...EMPTY_SPONSORSHIP_PAGE };
  for (const key of Object.keys(EMPTY_SPONSORSHIP_PAGE)) {
    const def = EMPTY_SPONSORSHIP_PAGE[key];
    if (typeof def === "boolean") out[key] = key in v ? v[key] !== false : def;
    else if (typeof def === "string") out[key] = key in v ? str(v[key]) : def;
  }
  out.fields = Array.isArray(v.fields) ? v.fields.map(normalizeField) : [];
  return out;
}

export function hasContactMethod(page) {
  return Boolean(
    page.contactEmail || page.contactPhone || page.contactWhatsapp || page.bookingUrl || page.contactNote,
  );
}

/** wa.me wants digits only, country code first. */
export function whatsappHref(number) {
  const digits = String(number || "").replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

/** Spots the public may see, with what's left on each. */
export function listedSpots(event) {
  const page = normalizeSponsorshipPage(event?.sponsorshipPage);
  return normalizeSponsorship(event?.sponsorship)
    .spots.filter((s) => s.open)
    .map((s) => ({ ...s, ...spotCounts(s) }))
    .filter((s) => page.showFilled || s.left > 0);
}

export function sponsorPagePath(eventId) {
  return eventId ? `/e/${eventId}/sponsor` : null;
}

// ------------------------------------------------------ event display ---

export const SPONSOR_LAYOUTS = [
  { key: "wall", label: "Logo wall" },
  { key: "grid", label: "Cards" },
  { key: "marquee", label: "Scrolling" },
  { key: "list", label: "List" },
];
export const SPONSOR_GROUPINGS = [
  { key: "spot", label: "By spot" },
  { key: "flat", label: "All together" },
];
export const SPONSOR_LOGO_SIZES = [
  { key: "sm", label: "Small" },
  { key: "md", label: "Medium" },
  { key: "lg", label: "Large" },
];
export const SPONSOR_COLUMNS = [
  { key: 3, label: "3" },
  { key: 4, label: "4" },
  { key: 5, label: "5" },
];
export const SPONSOR_CARD_STYLES = [
  { key: "plain", label: "Plain" },
  { key: "card", label: "Card" },
];
export const SPONSOR_ALIGNS = [
  { key: "left", label: "Left" },
  { key: "center", label: "Center" },
];
export const SPONSOR_LOGO_STYLES = [
  { key: "color", label: "Full colour" },
  { key: "muted", label: "Muted until hover" },
];
export const SPONSOR_CTA_STYLES = [
  { key: "link", label: "Text link" },
  { key: "button", label: "Button" },
  { key: "banner", label: "Banner" },
];
export const SPONSOR_CTA_TARGETS = [
  { key: "page", label: "Sponsorship page" },
  { key: "contact", label: "Contact email" },
  { key: "custom", label: "Custom link" },
];

export const DEFAULT_SPONSORS_DISPLAY = {
  heading: "Our sponsors",
  layout: "wall",
  grouping: "spot",
  logoSize: "md",
  featureTop: true,
  columns: 4,
  cardStyle: "plain",
  align: "center",
  logoStyle: "color",
  showNames: false,
  showSpotLabels: true,
  linkLogos: true,
  includePending: false,
  cta: {
    enabled: true,
    style: "link",
    label: "Become a sponsor",
    heading: "Put your brand in front of our audience",
    body: "A few sponsorship spots are still open for this event.",
    target: "page",
    url: "",
    showWhenEmpty: true,
  },
};

export function resolveSponsorsDisplay(value) {
  const v = value && typeof value === "object" ? value : {};
  const c = v.cta && typeof v.cta === "object" ? v.cta : {};
  const d = DEFAULT_SPONSORS_DISPLAY;
  const text = (src, key, def) => (typeof src[key] === "string" ? src[key] : def[key]);
  return {
    heading: text(v, "heading", d),
    layout: oneOf(SPONSOR_LAYOUTS, v.layout, d.layout),
    grouping: oneOf(SPONSOR_GROUPINGS, v.grouping, d.grouping),
    logoSize: oneOf(SPONSOR_LOGO_SIZES, v.logoSize, d.logoSize),
    featureTop: "featureTop" in v ? !!v.featureTop : d.featureTop,
    columns: oneOf(SPONSOR_COLUMNS, Number(v.columns), d.columns),
    cardStyle: oneOf(SPONSOR_CARD_STYLES, v.cardStyle, d.cardStyle),
    align: oneOf(SPONSOR_ALIGNS, v.align, d.align),
    logoStyle: oneOf(SPONSOR_LOGO_STYLES, v.logoStyle, d.logoStyle),
    showNames: "showNames" in v ? !!v.showNames : d.showNames,
    showSpotLabels: "showSpotLabels" in v ? !!v.showSpotLabels : d.showSpotLabels,
    linkLogos: "linkLogos" in v ? !!v.linkLogos : d.linkLogos,
    includePending: !!v.includePending,
    cta: {
      enabled: "enabled" in c ? !!c.enabled : d.cta.enabled,
      style: oneOf(SPONSOR_CTA_STYLES, c.style, d.cta.style),
      label: text(c, "label", d.cta),
      heading: text(c, "heading", d.cta),
      body: text(c, "body", d.cta),
      target: oneOf(SPONSOR_CTA_TARGETS, c.target, d.cta.target),
      url: str(c.url),
      showWhenEmpty: "showWhenEmpty" in c ? !!c.showWhenEmpty : d.cta.showWhenEmpty,
    },
  };
}

/** Sponsors grouped by spot (spot order = prominence), filtered to what the display shows. */
export function sponsorGroups(event, display) {
  const { spots } = normalizeSponsorship(event?.sponsorship);
  return spots
    .map((spot) => ({
      spot: { id: spot.id, name: spot.name, tier: spot.tier },
      sponsors: spot.fills
        .filter((f) => (display.includePending ? true : f.status === "confirmed"))
        .filter((f) => f.sponsor.name || f.sponsor.logoUrl)
        .map((f) => ({ id: f.id, spotName: spot.name, ...f.sponsor })),
    }))
    .filter((g) => g.sponsors.length);
}

// Repeat a short logo track without dividing by zero for an empty event.
export function marqueeSponsors(sponsors) {
  if (!sponsors.length) return [];
  const repeats = Math.ceil(8 / sponsors.length);
  return Array.from({ length: repeats }, (_, repeat) =>
    sponsors.map((sponsor) => ({ ...sponsor, id: `${repeat}-${sponsor.id}` })),
  ).flat();
}

/** Where "Become a sponsor" goes; null when the chosen destination isn't set up, so the link hides itself. */
export function sponsorCtaHref(event, cta) {
  const page = normalizeSponsorshipPage(event?.sponsorshipPage);
  if (cta.target === "custom") return ctaHref(cta.url);
  if (cta.target === "contact")
    return page.contactEmail ? `mailto:${page.contactEmail}` : null;
  return page.enabled ? ctaHref(sponsorPagePath(event?.id)) : null;
}
