
import { listGuests } from "@/lib/supabase/contacts";
import { listOrders } from "@/lib/supabase/orders";
import { listSegments, isSegmentMember } from "@/lib/supabase/segments";

export const EMPTY_FILTERS = {
  tickets: [],
  tags: [],
  statuses: [],
  segmentId: "",
};

export const EMPTY_SPEC = {
  eventId: "",
  filters: EMPTY_FILTERS,
};

const lc = (s) => String(s || "").toLowerCase();
const uniqLower = (arr) => [...new Set((Array.isArray(arr) ? arr : []).map(lc).filter(Boolean))];

export function normalizeSpec(value, { fallbackEventId = "" } = {}) {
  if (value === "all" || value === "selected") {
    return {
      ...EMPTY_SPEC,
      scope: fallbackEventId ? "event" : "project",
      eventId: fallbackEventId,
      mode: value === "selected" ? "filtered" : "all",
      filters: { ...EMPTY_FILTERS },
    };
  }
  const v = value && typeof value === "object" ? value : {};
  const eventId = v.eventId || fallbackEventId || "";
  const f = v.filters && typeof v.filters === "object" ? v.filters : {};
  const hasFilterShape = "filters" in v || "mode" in v || "include" in v;

  if (!hasFilterShape && Array.isArray(v.emails)) {
    const emails = uniqLower(v.emails);
    return {
      ...EMPTY_SPEC,
      scope: eventId ? "event" : "project",
      eventId,
      mode: emails.length ? "filtered" : "all",
      filters: { ...EMPTY_FILTERS },
      include: emails,
    };
  }

  return {
    scope: v.scope === "event" || eventId ? "event" : "project",
    eventId,
    mode: v.mode === "filtered" ? "filtered" : "all",
    filters: {
      tickets: Array.isArray(f.tickets) ? f.tickets : [],
      offerings: Array.isArray(f.offerings) ? f.offerings : [],
      purchasables: Array.isArray(f.purchasables) ? f.purchasables : [],
      tags: Array.isArray(f.tags) ? f.tags : [],
      statuses: Array.isArray(f.statuses) ? f.statuses : [],
      segmentId: f.segmentId || "",
    },
    include: uniqLower(v.include),
    exclude: uniqLower(v.exclude),
  };
}

export function isEmptyFilters(filters) {
  const f = filters || {};
  return !(
    (f.tickets?.length || 0) +
    (f.offerings?.length || 0) +
    (f.purchasables?.length || 0) +
    (f.tags?.length || 0) +
    (f.statuses?.length || 0) +
    (f.segmentId ? 1 : 0)
  );
}

export function poolFromOrders(orders, guestByEmail) {
  const byEmail = new Map();
  const offeringLabels = new Map();
  const purchasableLabels = new Map();
  for (const o of orders || []) {
    const email = lc(o.email);
    if (!email) continue;
    let p = byEmail.get(email);
    if (!p) {
      const g = guestByEmail.get(email);
      p = {
        email,
        name: o.name || g?.name || "",
        tickets: new Set(),
        offeringKeys: new Set(),
        purchasableKeys: new Set(),
        status: g?.status || null,
        tags: g?.tags || [],
        contact: g?.contact || null,
      };
      byEmail.set(email, p);
    }
    if (o.ticket) p.tickets.add(o.ticket);
    for (const entry of Array.isArray(o.offerings) ? o.offerings : []) {
      const name = entry?.offering;
      for (const ch of Array.isArray(entry?.choices) ? entry.choices : []) {
        if (!name || !ch?.label) continue;
        const key = `${name}::${ch.label}`;
        p.offeringKeys.add(key);
        if (!offeringLabels.has(key)) offeringLabels.set(key, `${name}: ${ch.label}`);
      }
    }
    for (const pu of Array.isArray(o.purchasables) ? o.purchasables : []) {
      const key = pu?.id || pu?.name;
      if (!key) continue;
      p.purchasableKeys.add(key);
      if (!purchasableLabels.has(key)) purchasableLabels.set(key, pu.name || String(key));
    }
  }
  return { pool: [...byEmail.values()], offeringLabels, purchasableLabels };
}

function personFromGuest(g) {
  return {
    email: lc(g.email),
    name: g.name || "",
    tickets: new Set(),
    offeringKeys: new Set(),
    purchasableKeys: new Set(),
    status: g.status || null,
    tags: g.tags || [],
    contact: g.contact || null,
  };
}

export function buildContext({ guests, orders, eventId }) {
  const guestByEmail = new Map();
  const attendingEmails = new Set();
  const eventsByEmail = new Map();
  for (const g of guests || []) {
    const key = lc(g.email);
    if (!key) continue;
    guestByEmail.set(key, g);
    attendingEmails.add(key);
    eventsByEmail.set(key, g.eventIds || []);
  }
  const ctx = { attendingEmails, eventsByEmail };

  if (eventId) {
    const { pool, offeringLabels, purchasableLabels } = poolFromOrders(orders, guestByEmail);
    pool.sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
    return { pool, ctx, offeringLabels, purchasableLabels };
  }
  const pool = (guests || [])
    .filter((g) => g.email)
    .map(personFromGuest)
    .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
  return { pool, ctx, offeringLabels: new Map(), purchasableLabels: new Map() };
}

export function matchesFilters(person, filters, { segments = [], ctx = {} } = {}) {
  const f = filters || {};
  if (f.tickets?.length && ![...person.tickets].some((t) => f.tickets.includes(t))) return false;
  if (f.offerings?.length && ![...person.offeringKeys].some((k) => f.offerings.includes(k)))
    return false;
  if (f.purchasables?.length && ![...person.purchasableKeys].some((k) => f.purchasables.includes(k)))
    return false;
  if (f.tags?.length && !(person.tags || []).some((t) => f.tags.includes(t))) return false;
  if (f.statuses?.length && !f.statuses.includes(person.status)) return false;
  if (f.segmentId) {
    const seg = segments.find((s) => s.id === f.segmentId);
    if (!seg || !person.contact || !isSegmentMember(seg, person.contact, ctx)) return false;
  }
  return true;
}

export function resolvePeople(spec, pool, { segments = [], ctx = {} } = {}) {
  const s = normalizeSpec(spec);
  const include = new Set(s.include);
  const exclude = new Set(s.exclude);
  const byEmail = new Map((pool || []).map((p) => [p.email, p]));
  const out = new Map();

  if (s.mode === "all") {
    for (const p of pool || []) if (!exclude.has(p.email)) out.set(p.email, p);
  } else {
    for (const p of pool || []) {
      if (exclude.has(p.email)) continue;
      if (include.has(p.email) || matchesFilters(p, s.filters, { segments, ctx })) out.set(p.email, p);
    }
  }
  for (const email of include) {
    if (exclude.has(email) || out.has(email)) continue;
    out.set(email, byEmail.get(email) || { email, name: "", tickets: new Set(), offeringKeys: new Set(), purchasableKeys: new Set(), status: null, tags: [], contact: null });
  }
  return [...out.values()];
}

export function resolveEmailsFromPool(spec, pool, opts) {
  return new Set(resolvePeople(spec, pool, opts).map((p) => p.email));
}

export async function resolveAudienceEmails(projectId, spec) {
  const s = normalizeSpec(spec);
  if (!projectId) return { emails: [], count: 0 };
  const eventId = s.scope === "event" ? s.eventId : "";
  const [guests, segments, orders] = await Promise.all([
    listGuests(projectId),
    listSegments(projectId),
    eventId ? listOrders(eventId) : Promise.resolve([]),
  ]);
  const { pool, ctx } = buildContext({ guests: guests || [], orders: orders || [], eventId });
  const emails = [...resolveEmailsFromPool(s, pool, { segments: segments || [], ctx })];
  return { emails, count: emails.length };
}

export function describeSpec(spec) {
  const s = normalizeSpec(spec);
  if (s.mode === "all") return s.scope === "event" ? "All attendees" : "All guests";
  if (isEmptyFilters(s.filters)) {
    const n = s.include.length;
    return n ? `${n} selected ${n === 1 ? "person" : "people"}` : "No one yet";
  }
  const parts = [];
  const f = s.filters;
  const plural = (n, one) => `${n} ${one}${n === 1 ? "" : "s"}`;
  if (f.tickets.length) parts.push(plural(f.tickets.length, "ticket"));
  if (f.offerings.length) parts.push(plural(f.offerings.length, "offering"));
  if (f.purchasables.length) parts.push(plural(f.purchasables.length, "add-on"));
  if (f.tags.length) parts.push(plural(f.tags.length, "tag"));
  if (f.statuses.length) parts.push(plural(f.statuses.length, "status"));
  if (f.segmentId) parts.push("segment");
  return `Filtered · ${parts.join(", ")}`;
}
