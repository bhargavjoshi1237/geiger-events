"use client";

import { stockSize } from "./stock";

export const LAYOUT_VERSION = 1;

export const FONT_STACKS = {
  sans: "system-ui, -apple-system, Segoe UI, sans-serif",
  serif: "Georgia, Cambria, Times New Roman, serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
  condensed: "Oswald, Arial Narrow, Haettenschweiler, sans-serif-condensed, sans-serif",
  rounded: "ui-rounded, Nunito, Quicksand, Segoe UI, sans-serif",
};

export const FONT_OPTIONS = [
  { value: "sans", label: "Sans" },
  { value: "serif", label: "Serif" },
  { value: "mono", label: "Mono" },
  { value: "condensed", label: "Condensed" },
  { value: "rounded", label: "Rounded" },
];

export const fontStack = (key) => FONT_STACKS[key] || FONT_STACKS.sans;

export const BORDER_STYLES = [
  { value: "none", label: "None" },
  { value: "solid", label: "Solid" },
  { value: "dashed", label: "Dashed" },
  { value: "dotted", label: "Dotted" },
  { value: "double", label: "Double" },
];

export const IMAGE_FITS = [
  { value: "cover", label: "Cover" },
  { value: "contain", label: "Contain" },
  { value: "stretch", label: "Stretch" },
];

export const ALIGN_OPTIONS = [
  { value: "left", label: "Left" },
  { value: "center", label: "Centre" },
  { value: "right", label: "Right" },
];

const fmtDay = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
};

export const FIELD_CATALOG = [
  {
    key: "eventName",
    label: "Event name",
    group: "Event",
    get: ({ event }) => event?.name || "",
    sample: "Event name",
  },
  {
    key: "eventDate",
    label: "Event date",
    group: "Event",
    get: ({ event }) => fmtDay(event?.date),
    sample: "12 Sep 2026",
  },
  {
    key: "eventTime",
    label: "Event time",
    group: "Event",
    get: ({ event }) => event?.time || "",
    sample: "19:30",
  },
  {
    key: "eventVenue",
    label: "Venue",
    group: "Event",
    get: ({ event }) => event?.venue || "",
    sample: "The Roundhouse",
  },
  {
    key: "eventCity",
    label: "City",
    group: "Event",
    get: ({ event }) => event?.city || "",
    sample: "London",
  },
  {
    key: "name",
    label: "Attendee name",
    group: "Attendee",
    get: ({ attendee }) => attendee?.name || "",
    sample: "Attendee name",
  },
  {
    key: "company",
    label: "Company / role",
    group: "Attendee",
    get: ({ attendee }) => attendee?.company || "",
    sample: "Company",
  },
  {
    key: "title",
    label: "Job title",
    group: "Attendee",
    get: ({ attendee }) => attendee?.title || "",
    sample: "Principal Engineer",
  },
  {
    key: "email",
    label: "Email",
    group: "Attendee",
    get: ({ attendee }) => attendee?.email || "",
    sample: "name@example.com",
  },
  {
    key: "tier",
    label: "Ticket tier",
    group: "Ticket",
    get: ({ attendee }) => attendee?.tier || "",
    sample: "VIP",
  },
  {
    key: "seatLabel",
    label: "Assigned seat",
    group: "Ticket",
    get: ({ attendee }) => attendee?.seatLabel || "",
    sample: "Orchestra · F12",
  },
  {
    key: "seatIndex",
    label: "Pass number",
    group: "Ticket",
    get: ({ attendee }) => (attendee?.of > 1 ? `${attendee.seat}/${attendee.of}` : ""),
    sample: "1/2",
  },
  {
    key: "ticketCode",
    label: "Ticket code",
    group: "Ticket",
    get: ({ attendee }) => attendee?.code || "",
    sample: "A1B2C3D4",
  },
  {
    key: "source",
    label: "Source",
    group: "Ticket",
    get: ({ attendee }) => attendee?.source || "",
    sample: "order",
  },
  {
    key: "role",
    label: "Role / access",
    group: "Pass",
    get: ({ attendee }) => attendee?.role || "",
    sample: "Speaker",
  },
  {
    key: "detail",
    label: "Role detail",
    group: "Pass",
    get: ({ attendee }) => attendee?.detail || "",
    sample: "Keynote · Main Stage",
  },
  {
    key: "custom",
    label: "Custom text",
    group: "Other",
    get: () => "",
    sample: "Custom text",
  },
];

export const fieldEntry = (key) => FIELD_CATALOG.find((f) => f.key === key) || null;

export function elementText(element, ctx, { preview = false } = {}) {
  if (!element) return "";
  if (element.field === "custom") return element.text || (preview ? "Custom text" : "");
  const entry = fieldEntry(element.field);
  const value = entry ? entry.get(ctx || {}) : "";
  const out = value || (preview ? element.text || entry?.sample || "" : "");
  return element.uppercase ? String(out).toUpperCase() : String(out);
}

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export const defaultAdjust = () => ({
  brightness: 100,
  contrast: 100,
  saturation: 100,
  grayscale: 0,
  blur: 0,
  tint: "",
  tintStrength: 0,
});

export const isDefaultAdjust = (a) =>
  !a ||
  ((a.brightness ?? 100) === 100 &&
    (a.contrast ?? 100) === 100 &&
    (a.saturation ?? 100) === 100 &&
    (a.grayscale ?? 0) === 0 &&
    (Number(a.blur) || 0) === 0);

export function newElement(kind, patch = {}) {
  const base = { id: uid(), kind, x: 4, y: 4, hidden: false, opacity: 1, rotation: 0 };
  if (kind === "text") {
    return {
      ...base,
      field: "custom",
      text: "Text",
      w: 40,
      size: 4,
      weight: "regular",
      align: "left",
      color: "#111111",
      font: "sans",
      uppercase: false,
      spacing: 0,
      pill: false,
      ...patch,
    };
  }
  if (kind === "qr") {
    return {
      ...base,
      size: 18,
      fg: "#111111",
      bg: "#ffffff",
      bgTransparent: false,
      logoUrl: "",
      ...patch,
    };
  }
  if (kind === "image") {
    return {
      ...base,
      w: 24,
      h: 24,
      url: "",
      fit: "contain",
      radius: 0,
      adjust: defaultAdjust(),
      ...patch,
    };
  }
  return {
    ...base,
    w: 40,
    h: 12,
    fill: "#6366f1",
    radius: 0,
    border: { style: "none", width: 0.4, color: "#111111" },
    adjust: defaultAdjust(),
    ...patch,
  };
}

export const elementLabel = (element) => {
  if (!element) return "";
  if (element.kind === "text") {
    if (element.field === "custom") return element.text || "Custom text";
    return fieldEntry(element.field)?.label || "Text";
  }
  if (element.kind === "qr") return "QR code";
  if (element.kind === "image") return element.name || "Image";
  return element.name || "Section";
};

export const defaultCardBorder = () => ({
  style: "none",
  width: 0.5,
  color: "#111111",
  radius: 0,
});

export function seedLayout(template = {}) {
  const { wMm: w, hMm: h } = stockSize(template.stock);
  const fields = template.fields || {};
  const accent = template.accent || "#6366f1";
  const ink = template.textColor || "#111111";
  const s = Math.min(2.2, Math.max(0.75, Math.min(w, h) / 54));
  const pad = 4 * s;
  const band = Math.max(2, h * 0.05);
  const elements = [];

  elements.push(
    newElement("box", {
      name: "Accent band",
      x: 0,
      y: 0,
      w,
      h: band,
      fill: accent,
      radius: 0,
    }),
  );

  let cursor = band + pad;
  if (fields.eventName !== false) {
    elements.push(
      newElement("text", {
        field: "eventName",
        x: pad,
        y: cursor,
        w: w - pad * 2,
        size: 2.5 * s,
        weight: "bold",
        color: accent,
        uppercase: true,
        spacing: 0.2 * s,
      }),
    );
    cursor += 4 * s;
  }

  if (fields.role) {
    elements.push(
      newElement("text", {
        field: "role",
        x: pad,
        y: cursor,
        w: w - pad * 2,
        size: 3 * s,
        weight: "bold",
        color: "#ffffff",
        pill: true,
        pillFill: accent,
        uppercase: true,
        spacing: 0.15 * s,
      }),
    );
    cursor += 5.5 * s;
  }

  const bodyTop = Math.max(cursor, h * 0.32);
  let y = bodyTop;
  if (fields.name !== false) {
    elements.push(
      newElement("text", {
        field: "name",
        x: pad,
        y,
        w: w - pad * 2,
        size: 6 * s,
        weight: "bold",
        color: ink,
      }),
    );
    y += 7.5 * s;
  }
  if (fields.company !== false) {
    elements.push(
      newElement("text", {
        field: "company",
        x: pad,
        y,
        w: w - pad * 2,
        size: 3 * s,
        color: ink,
      }),
    );
    y += 4.5 * s;
  }
  if (fields.tier) {
    elements.push(
      newElement("text", {
        field: "tier",
        x: pad,
        y,
        w: w - pad * 2,
        size: 2.7 * s,
        weight: "bold",
        color: "#ffffff",
        pill: true,
        pillFill: accent,
      }),
    );
    y += 5 * s;
  }
  if (fields.seat) {
    elements.push(
      newElement("text", {
        field: "seatLabel",
        x: pad,
        y,
        w: w - pad * 2,
        size: 3.4 * s,
        weight: "bold",
        color: ink,
      }),
    );
  }

  if (fields.ticketCode !== false) {
    elements.push(
      newElement("text", {
        field: "ticketCode",
        x: pad,
        y: h - pad,
        w: w * 0.5,
        size: 2.6 * s,
        font: "mono",
        color: ink,
      }),
    );
  }
  if (fields.date) {
    elements.push(
      newElement("text", {
        field: "eventDate",
        x: pad,
        y: h - pad - 4 * s,
        w: w * 0.5,
        size: 2.6 * s,
        font: "mono",
        color: ink,
      }),
    );
  }

  if (fields.qr !== false) {
    const size = Math.min(Number(template.qr?.sizeMm) || 18, Math.min(w, h) - pad * 2);
    const position = template.qr?.position || "bottom-right";
    let x = w - pad - size;
    let qy = h - pad - size;
    if (position === "bottom-left") x = pad;
    else if (position === "bottom-center") x = (w - size) / 2;
    else if (position === "right") qy = band + (h - band - size) / 2;
    elements.push(newElement("qr", { x, y: qy, size, logoUrl: template.logoUrl || "" }));
  }

  if (template.showLogo && template.logoUrl) {
    const logo = 7 * s;
    elements.push(
      newElement("image", {
        name: "Logo",
        x: w - pad - logo,
        y: band + pad * 0.6,
        w: logo,
        h: logo,
        url: template.logoUrl,
        fit: "contain",
      }),
    );
  }

  return {
    version: LAYOUT_VERSION,
    bgImage: { url: "", fit: "cover", opacity: 1 },
    border: defaultCardBorder(),
    elements,
  };
}

export function withLayout(template) {
  if (!template) return template;
  if (template.layout?.elements?.length) return template;
  return { ...template, layout: seedLayout(template) };
}

export const SIDES = ["front", "back"];

export const emptyLayout = () => ({
  version: LAYOUT_VERSION,
  bgImage: { url: "", fit: "cover", opacity: 1 },
  border: defaultCardBorder(),
  elements: [],
});

export function withSides(template) {
  const front = withLayout(template);
  if (!front) return front;
  if (front.back?.layout?.elements) return front;
  return {
    ...front,
    back: {
      bg: front.back?.bg || front.bg || "#ffffff",
      layout: front.back?.layout || emptyLayout(),
    },
  };
}

export const sideLayout = (template, side) =>
  (side === "back" ? template?.back?.layout : template?.layout) || emptyLayout();

export const sideBg = (template, side) =>
  (side === "back" ? template?.back?.bg || template?.bg : template?.bg) || "#ffffff";

export function hasBackContent(template) {
  const layout = template?.back?.layout;
  if (!layout) return false;
  if (layout.bgImage?.url) return true;
  return (layout.elements || []).some((el) => el && !el.hidden);
}

export function collectImageUrls(template) {
  const urls = new Set();
  for (const side of SIDES) {
    const layout = side === "back" ? template?.back?.layout : template?.layout;
    if (layout?.bgImage?.url) urls.add(layout.bgImage.url);
    for (const el of layout?.elements || []) {
      if (el.kind === "image" && el.url) urls.add(el.url);
      if (el.kind === "box" && el.image) urls.add(el.image);
      if (el.kind === "qr" && el.logoUrl) urls.add(el.logoUrl);
    }
  }
  if (template?.logoUrl) urls.add(template.logoUrl);
  return [...urls];
}
