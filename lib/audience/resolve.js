// Shared audience targeting — the ONE serializable "audience spec" and its pure
// resolver, used everywhere a Community surface selects members/buyers
// (announcements, polls, surveys, Q&A threads, event chat, alerts, broadcasts).
//
// The spec stores CRITERIA, not a frozen list of emails, so an audience stays
// live: resolving it later automatically reflects new buyers who match. Legacy
// shapes ({ eventId, emails } and the "all" / "selected" strings) migrate in via
// normalizeSpec, so existing records keep working.
//
// Resolution: mode "all" targets everyone in scope; mode "filtered" keeps people
// matching ALL active facet groups, then unions manual `include`, then subtracts
// `exclude`. With no facets active, "filtered" is a pure hand-picked list. An
// event scope unlocks the ticket / offering / add-on facets (they come from a
// buyer's actual order); project scope draws its pool from every project guest.

import { listGuests } from "@/lib/supabase/contacts";
import { listOrders } from "@/lib/supabase/orders";
import { listSegments, isSegmentMember } from "@/lib/supabase/segments";

export const EMPTY_FILTERS = {
  tickets: [],
  offerings: [], // "Offering::Choice" keys
  purchasables: [], // add-on id/name keys
  tags: [],
  statuses: [],
  segmentId: "",
};

export const EMPTY_SPEC = {
  scope: "project", // "event" | "project"
  eventId: "",
  mode: "all", // "all" | "filtered"
  filters: EMPTY_FILTERS,
  include: [], // individual emails always in
  exclude: [], // individual emails always out
};

const lc = (s) => String(s || "").toLowerCase();
const uniqLower = (arr) => [...new Set((Array.isArray(arr) ? arr : []).map(lc).filter(Boolean))];

// Coerce any stored/loose value into a complete, well-formed spec. Accepts:
//   • a real spec object
//   • the legacy record shape { eventId, emails }  → filtered + include: emails
//   • the legacy chat strings "all" / "selected"   → mode all / filtered
// `fallbackEventId` scopes bare/legacy values to an event when the surface knows
// one (e.g. a Q&A thread always belongs to an event).
export function normalizeSpec(value, { fallbackEventId = "" } = {}) {
  // Legacy chat audience strings.
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

  // Legacy { eventId, emails } — the emails were the whole hand-picked audience.
  // An empty list meant "everyone in scope" (no restriction), so map that to All.
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

// True when a spec targets a hand-picked set only (no facet criteria) — used to
// decide whether "who matches" needs the full pool or is just the include list.
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

// ---------------------------------------------------------------------------
// Pool construction — turn raw guests + orders into per-person records carrying
// every targetable dimension. Event scope aggregates each buyer's order
// selections; project scope is simply every guest with an email.
// ---------------------------------------------------------------------------

// { pool, offeringLabels, purchasableLabels } from an event's orders.
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

// A project guest with no order — empty ticket/offering sets.
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

// Build the resolution context from guests + (optional) orders. Returns the pool
// plus the segment-evaluation ctx and human labels for the offering/add-on keys.
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

// ---------------------------------------------------------------------------
// Matching + resolution over an already-built pool.
// ---------------------------------------------------------------------------

// Whether one pool person satisfies the spec's facet filters (ignores
// include/exclude — those are applied at the set level).
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

// Resolve a spec against a built pool → array of matched pool people. `include`
// people missing from the pool are appended as bare {email} records so a
// hand-picked address is never dropped just because they have no order/CRM row.
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
  // Ensure hand-added addresses survive even without a pool row.
  for (const email of include) {
    if (exclude.has(email) || out.has(email)) continue;
    out.set(email, byEmail.get(email) || { email, name: "", tickets: new Set(), offeringKeys: new Set(), purchasableKeys: new Set(), status: null, tags: [], contact: null });
  }
  return [...out.values()];
}

// Resolve a spec against a built pool → Set<email>.
export function resolveEmailsFromPool(spec, pool, opts) {
  return new Set(resolvePeople(spec, pool, opts).map((p) => p.email));
}

// One-shot async resolution from a projectId + spec: fetch guests / orders /
// segments, build the pool, resolve to emails. Used by send/publish/fire paths
// (announcements, alerts, broadcasts) that don't hold a live builder. Returns
// { emails: string[], count } — empty on missing DB rather than throwing.
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

// A short human summary of a spec for chips/badges (e.g. "All attendees",
// "Filtered · 2 tickets, 1 tag", "5 people").
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
