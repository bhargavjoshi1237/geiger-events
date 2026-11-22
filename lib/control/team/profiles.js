import { ApiError } from "../../staff_access/errors.js";

// Validation for the organiser profile (Discovery) and Event Wall forms, matching what the dashboard writes.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function invalid(message) {
  return new ApiError("invalid_input", 400, message);
}

function text(value, label, max) {
  if (value == null) return "";
  if (typeof value !== "string") throw invalid(`${label} must be text.`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw invalid(`${label} must be ${max} characters or fewer.`);
  return trimmed;
}

function url(value, label, { mailto = false } = {}) {
  const v = text(value, label, 2000);
  if (!v) return "";
  if (/^https?:\/\/\S+$/i.test(v) || (mailto && /^mailto:\S+@\S+$/i.test(v))) return v;
  throw invalid(`${label} must start with https://${mailto ? " or mailto:" : ""}.`);
}

// Same rule as the dashboard's slugify, then a non-empty check.
export function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const PROFILE_FIELDS = {
  displayName: ["display_name", (v) => text(v, "Display name", 120)],
  tagline: ["tagline", (v) => text(v, "Tagline", 200)],
  bio: ["bio", (v) => text(v, "Bio", 4000)],
  avatarUrl: ["avatar_url", (v) => url(v, "Avatar URL")],
  bannerUrl: ["banner_url", (v) => url(v, "Banner URL")],
  website: ["website", (v) => url(v, "Website")],
  location: ["location", (v) => text(v, "Location", 200)],
  contactEmail: [
    "contact_email",
    (v) => {
      const email = text(v, "Contact email", 254).toLowerCase();
      if (email && !EMAIL.test(email)) throw invalid("Enter a valid contact email.");
      return email;
    },
  ],
};

export function parseProfilePatch(body) {
  if (!body || typeof body !== "object") throw invalid("Send the fields to change.");
  const row = {};
  for (const [key, [column, parse]] of Object.entries(PROFILE_FIELDS)) if (key in body) row[column] = parse(body[key]);
  if ("links" in body) {
    if (!Array.isArray(body.links) || body.links.length > 20) throw invalid("Send up to 20 links.");
    // Rows without a URL are dropped, as the dashboard's save does.
    row.links = body.links
      .map((l) => ({ label: text(l?.label, "Link label", 80), url: url(l?.url, "Link") }))
      .filter((l) => l.url);
  }
  if (!Object.keys(row).length) throw invalid("Send at least one field to change.");
  return row;
}

export function profileView(row) {
  return {
    displayName: row?.display_name ?? "",
    tagline: row?.tagline ?? "",
    bio: row?.bio ?? "",
    avatarUrl: row?.avatar_url ?? "",
    bannerUrl: row?.banner_url ?? "",
    website: row?.website ?? "",
    location: row?.location ?? "",
    contactEmail: row?.contact_email ?? "",
    links: Array.isArray(row?.links) ? row.links.map((l) => ({ label: l?.label ?? "", url: l?.url ?? "" })) : [],
  };
}

const CTA_STYLES = ["solid", "outline"];

// Columns on the wall row, plus the hero call-to-action kept in its metadata bag.
export function parseWallPatch(body) {
  if (!body || typeof body !== "object") throw invalid("Send the fields to change.");
  const row = {};
  if ("name" in body) {
    row.name = text(body.name, "Page name", 120);
    if (!row.name) throw invalid("Give the page a name.");
  }
  if ("tagline" in body) row.tagline = text(body.tagline, "Tagline", 300);
  if ("logoUrl" in body) row.logo_url = url(body.logoUrl, "Logo URL");
  if ("slug" in body) {
    row.slug = slugify(body.slug);
    if (!row.slug) throw invalid("Enter a valid URL slug.");
  }
  let cta;
  if ("cta" in body) {
    const c = body.cta && typeof body.cta === "object" ? body.cta : {};
    cta = {
      label: text(c.label, "Button label", 60),
      url: url(c.url, "Button link", { mailto: true }),
      style: CTA_STYLES.includes(c.style) ? c.style : "solid",
    };
  }
  if (!Object.keys(row).length && !cta) throw invalid("Send at least one field to change.");
  return { row, cta };
}

export function wallView(row) {
  const meta = row?.metadata && typeof row.metadata === "object" ? row.metadata : {};
  const cta = meta.cta && typeof meta.cta === "object" ? meta.cta : {};
  return {
    id: row?.id ?? null,
    name: row?.name ?? "Our Events",
    tagline: row?.tagline ?? "",
    logoUrl: row?.logo_url ?? "",
    slug: row?.slug ?? "events",
    cta: { label: cta.label ?? "", url: cta.url ?? "", style: cta.style === "outline" ? "outline" : "solid" },
  };
}
