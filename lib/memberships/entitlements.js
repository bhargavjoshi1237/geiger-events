// Membership entitlements — what a plan hands its members beyond ticket pricing.
// Stored on a plan record's config as `entitlements`, keyed by item type:
//
//   entitlements: {
//     vod:      { mode, eventIds[], match, duration, options },
//     rooms:    { … },
//     discount: { … },
//   }
//
//   mode      catalogue scope — none | selected | all
//   eventIds  the events picked in "selected" mode
//   match     extra targeting for rich items (type / series / month / city)
//   duration  how long a member keeps the grant — permanent, or a window from
//             the day they joined
//   options   per-item extras, declared by the item's `options` descriptors
//
// Every attachable item type shares this one shape, so the editor, the list
// summaries, and the portal resolver are written once. Adding a type means
// adding an ENTITLEMENT_ITEMS entry — no new components.
//
// Deliberately framework-free (no React, no Supabase) so the admin editor and
// the portal's server-side resolver share one source of truth.

// --- Option choice catalogues ------------------------------------------------

export const ONLINE_ROOM_CHOICES = [
  { value: "livestream", label: "Livestream rooms" },
  { value: "webinar", label: "Webinar rooms" },
  { value: "breakout", label: "Breakout rooms" },
  { value: "sponsor", label: "Sponsor rooms" },
  { value: "networking", label: "Networking lounges" },
  { value: "backstage", label: "Speaker backstage" },
];

export const ONSITE_AREA_CHOICES = [
  { value: "vip", label: "VIP lounge" },
  { value: "members", label: "Members lounge" },
  { value: "greenroom", label: "Speaker green room" },
  { value: "expo", label: "Expo floor" },
  { value: "workshops", label: "Workshop rooms" },
  { value: "backstage", label: "Backstage" },
  { value: "press", label: "Press room" },
];

export const PERK_CHOICES = [
  { value: "early_access", label: "Early access" },
  { value: "exclusive_tickets", label: "Exclusive ticket types" },
  { value: "protected_seats", label: "Protected seats" },
  { value: "livestream", label: "Livestream access" },
  { value: "waitlist_priority", label: "Waitlist priority" },
  { value: "free_addons", label: "Free add-ons" },
  { value: "guest_passes", label: "Guest passes" },
  { value: "fee_waiver", label: "Booking fee waived" },
  { value: "flexible_refunds", label: "Flexible refunds" },
  { value: "free_upgrade", label: "Free tier upgrade" },
];

export const EVENT_TYPE_CHOICES = [
  { value: "In-person", label: "In-person" },
  { value: "Online", label: "Online" },
  { value: "Hybrid", label: "Hybrid" },
];

export const MONTH_CHOICES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
].map((label, i) => ({ value: String(i + 1).padStart(2, "0"), label }));

// --- Item catalogue ----------------------------------------------------------

// `targeting`: "events" = pick events only; "rich" = also match by type,
// series, month, or city. `options`: extra controls the editor renders under
// the scope, each { key, label, hint?, type, default, choices?, unit?, showIf? }.
export const ENTITLEMENT_ITEMS = [
  {
    key: "vod",
    label: "VOD content",
    icon: "video",
    noun: "recordings",
    description:
      "Recordings & replays from your on-demand library, filtered by the events you attach.",
    targeting: "events",
    options: [],
  },
  {
    key: "rooms",
    label: "Special access",
    icon: "doorOpen",
    noun: "rooms",
    description:
      "Rooms members can walk into — online session rooms, on-site area passes, or both.",
    targeting: "events",
    options: [
      {
        key: "passType",
        label: "Pass type",
        hint: "What kind of room this membership opens.",
        type: "choice",
        default: "online",
        choices: [
          { value: "online", label: "Online event rooms" },
          { value: "onsite", label: "On-site room passes" },
          { value: "both", label: "Both" },
        ],
      },
      {
        key: "onlineRooms",
        label: "Online rooms",
        hint: "Which virtual rooms members can join.",
        type: "multi",
        default: ["livestream"],
        choices: ONLINE_ROOM_CHOICES,
        showIf: (o) => o.passType !== "onsite",
      },
      {
        key: "onsiteAreas",
        label: "On-site areas",
        hint: "Which physical areas the member's badge unlocks.",
        type: "multi",
        default: [],
        choices: ONSITE_AREA_CHOICES,
        showIf: (o) => o.passType !== "online",
      },
      {
        key: "guestsAllowed",
        label: "Guests per member",
        hint: "How many people a member may bring in with them. 0 = members only.",
        type: "number",
        default: 0,
        min: 0,
      },
    ],
  },
  {
    key: "discount",
    label: "Event perks & discounts",
    icon: "ticketPercent",
    noun: "events",
    description:
      "Money off and buying privileges across the events you target — by event, type, series, month, or city.",
    targeting: "rich",
    options: [
      {
        key: "percent",
        label: "Discount",
        hint: "Taken off ticket prices for the events this targets.",
        type: "number",
        default: 10,
        min: 0,
        max: 100,
        unit: "%",
      },
      {
        key: "perks",
        label: "Included perks",
        hint: "Buying privileges members get on top of the discount.",
        type: "multi",
        default: [],
        choices: PERK_CHOICES,
      },
      {
        key: "earlyAccessHours",
        label: "Early access window",
        hint: "How long before general sale members can buy.",
        type: "number",
        default: 48,
        min: 1,
        unit: "hours",
        showIf: (o) => (o.perks || []).includes("early_access"),
      },
      {
        key: "protectedSeats",
        label: "Seats held per event",
        hint: "Held back from general sale for members.",
        type: "number",
        default: 2,
        min: 1,
        unit: "seats",
        showIf: (o) => (o.perks || []).includes("protected_seats"),
      },
      {
        key: "guestPasses",
        label: "Guest passes per event",
        type: "number",
        default: 1,
        min: 1,
        unit: "passes",
        showIf: (o) => (o.perks || []).includes("guest_passes"),
      },
      {
        key: "maxUses",
        label: "Redemptions per event",
        hint: "How often a member can use this. 0 = unlimited.",
        type: "number",
        default: 0,
        min: 0,
      },
    ],
  },
];

export const ITEM_BY_KEY = Object.fromEntries(ENTITLEMENT_ITEMS.map((i) => [i.key, i]));

// --- Scope & duration --------------------------------------------------------

export const ACCESS_MODES = [
  { value: "none", label: "None", hint: "This plan grants nothing here." },
  {
    value: "selected",
    label: "Selected",
    hint: "Only what's attached to the events you target below.",
  },
  { value: "all", label: "Full catalogue", hint: "Everything in this project." },
];

export const DURATION_TYPES = [
  {
    value: "permanent",
    label: "Permanent",
    hint: "Access lasts as long as the membership is active.",
  },
  {
    value: "timed",
    label: "Time-based",
    hint: "Access ends a set time after the member joins.",
  },
];

export const DURATION_UNITS = [
  { value: "days", label: "Days" },
  { value: "weeks", label: "Weeks" },
  { value: "months", label: "Months" },
  { value: "years", label: "Years" },
];

export const DEFAULT_DURATION = { type: "permanent", amount: 12, unit: "months" };
export const EMPTY_MATCH = { types: [], seriesIds: [], months: [], cities: [] };

export const DEFAULT_ENTITLEMENT = {
  mode: "none",
  eventIds: [],
  match: EMPTY_MATCH,
  duration: DEFAULT_DURATION,
  options: {},
};

const MODE_VALUES = new Set(ACCESS_MODES.map((m) => m.value));
const UNIT_VALUES = new Set(DURATION_UNITS.map((u) => u.value));
const MATCH_KEYS = Object.keys(EMPTY_MATCH);

const strList = (v) => (Array.isArray(v) ? v.filter(Boolean).map(String) : []);

export function normalizeDuration(d) {
  const v = d && typeof d === "object" ? d : {};
  const amount = Math.max(1, Math.round(Number(v.amount) || 0) || DEFAULT_DURATION.amount);
  return {
    type: v.type === "timed" ? "timed" : "permanent",
    amount,
    unit: UNIT_VALUES.has(v.unit) ? v.unit : DEFAULT_DURATION.unit,
  };
}

export function normalizeMatch(m) {
  const v = m && typeof m === "object" ? m : {};
  return Object.fromEntries(MATCH_KEYS.map((k) => [k, strList(v[k])]));
}

// Fill an item's option bag from its descriptors so every control has a value.
export function normalizeOptions(item, raw) {
  const v = raw && typeof raw === "object" ? raw : {};
  const out = {};
  for (const opt of item?.options || []) {
    const given = v[opt.key];
    if (opt.type === "multi") {
      out[opt.key] = Array.isArray(given) ? given.filter(Boolean) : [...(opt.default || [])];
    } else if (opt.type === "number") {
      const n = Number(given);
      out[opt.key] = Number.isFinite(n) ? n : opt.default;
    } else if (opt.type === "switch") {
      out[opt.key] = given === undefined ? Boolean(opt.default) : Boolean(given);
    } else {
      const valid = (opt.choices || []).some((c) => c.value === given);
      out[opt.key] = valid ? given : opt.default;
    }
  }
  return out;
}

export function normalizeEntitlement(e, item) {
  const v = e && typeof e === "object" ? e : {};
  return {
    mode: MODE_VALUES.has(v.mode) ? v.mode : "none",
    eventIds: strList(v.eventIds),
    match: normalizeMatch(v.match),
    duration: normalizeDuration(v.duration),
    options: normalizeOptions(item, v.options),
  };
}

// Every item type's entitlement off a plan config, always fully populated.
export function normalizeEntitlements(config) {
  const bag =
    config?.entitlements && typeof config.entitlements === "object"
      ? config.entitlements
      : {};
  return Object.fromEntries(
    ENTITLEMENT_ITEMS.map((item) => [item.key, normalizeEntitlement(bag[item.key], item)]),
  );
}

// A fresh entitlement bag for a brand-new plan.
export function defaultEntitlements() {
  return Object.fromEntries(
    ENTITLEMENT_ITEMS.map((item) => [item.key, normalizeEntitlement(null, item)]),
  );
}

// --- Labels ------------------------------------------------------------------

// "Permanent" / "12 months from joining".
export function durationLabel(duration) {
  const d = normalizeDuration(duration);
  if (d.type === "permanent") return "Permanent";
  const unit = DURATION_UNITS.find((u) => u.value === d.unit)?.label || d.unit;
  const label = d.amount === 1 ? unit.replace(/s$/, "") : unit;
  return `${d.amount} ${label.toLowerCase()} from joining`;
}

// How many things the "selected" scope targets, in words.
export function targetSummary(entitlement) {
  const e = normalizeEntitlement(entitlement);
  const bits = [];
  if (e.eventIds.length) {
    bits.push(`${e.eventIds.length} ${e.eventIds.length === 1 ? "event" : "events"}`);
  }
  if (e.match.types.length) bits.push(e.match.types.join("/"));
  if (e.match.seriesIds.length) {
    bits.push(`${e.match.seriesIds.length} series`);
  }
  if (e.match.months.length) {
    bits.push(
      e.match.months
        .map((m) => MONTH_CHOICES.find((c) => c.value === m)?.label || m)
        .join("/"),
    );
  }
  if (e.match.cities.length) bits.push(e.match.cities.join("/"));
  return bits.length ? bits.join(" + ") : "nothing targeted yet";
}

// One-liner for list summaries — "Full catalogue · Permanent".
export function entitlementSummary(entitlement) {
  const e = normalizeEntitlement(entitlement);
  if (e.mode === "none") return "No access";
  const scope = e.mode === "all" ? "Full catalogue" : targetSummary(e);
  return `${scope} · ${durationLabel(e.duration)}`;
}

// Human-readable extras for a grant — used by the portal's "what's included".
export function optionSummary(item, entitlement) {
  const e = normalizeEntitlement(entitlement, item);
  const out = [];
  for (const opt of item?.options || []) {
    if (opt.showIf && !opt.showIf(e.options)) continue;
    const val = e.options[opt.key];
    if (opt.type === "multi") {
      if (!val?.length) continue;
      out.push(
        `${opt.label}: ${val
          .map((v) => opt.choices.find((c) => c.value === v)?.label || v)
          .join(", ")}`,
      );
    } else if (opt.type === "number") {
      if (!val) continue;
      out.push(`${opt.label}: ${val}${opt.unit ? ` ${opt.unit}` : ""}`);
    } else if (opt.type === "switch") {
      if (val) out.push(opt.label);
    } else {
      const label = opt.choices?.find((c) => c.value === val)?.label;
      if (label) out.push(label);
    }
  }
  return out;
}

// Everything a plan attaches, flattened for display (the portal's "what's
// included" list). Returns [] for a plan that attaches nothing.
export function includedSummary(config) {
  const entitlements = normalizeEntitlements(config);
  return ENTITLEMENT_ITEMS.filter((item) => entitlements[item.key].mode !== "none").map(
    (item) => ({
      key: item.key,
      label: item.label,
      summary: entitlementSummary(entitlements[item.key]),
      duration: durationLabel(entitlements[item.key].duration),
      extras: optionSummary(item, entitlements[item.key]),
    }),
  );
}

// --- Access windows ----------------------------------------------------------

const UNIT_MS = { days: 864e5, weeks: 6048e5 };

// When a member who joined at `startedAt` loses what this entitlement granted.
// Returns an ISO string, or null for permanent access (bounded only by the
// membership itself).
export function entitlementExpiry(startedAt, duration) {
  const d = normalizeDuration(duration);
  if (d.type === "permanent") return null;
  const from = startedAt ? new Date(startedAt) : new Date();
  if (Number.isNaN(from.getTime())) return null;
  const out = new Date(from);
  if (d.unit === "months") out.setMonth(out.getMonth() + d.amount);
  else if (d.unit === "years") out.setFullYear(out.getFullYear() + d.amount);
  else out.setTime(out.getTime() + d.amount * (UNIT_MS[d.unit] || UNIT_MS.days));
  return out.toISOString();
}

// The tighter of two access windows; null means "no limit", so it always loses.
export function earliestExpiry(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  return new Date(a) <= new Date(b) ? a : b;
}

// The looser of two windows — used when several grants cover the same item.
export function latestExpiry(a, b) {
  if (!a || !b) return null; // one of them is permanent
  return new Date(a) >= new Date(b) ? a : b;
}

// --- Matching ----------------------------------------------------------------

// Does an entitlement's "selected" scope cover this event? `event` is a
// normalized event view model (id, type, seriesId, date, city).
export function matchesEvent(entitlement, event) {
  const e = normalizeEntitlement(entitlement);
  if (!event) return false;
  if (e.eventIds.includes(event.id)) return true;
  if (e.match.types.includes(event.type)) return true;
  if (event.seriesId && e.match.seriesIds.includes(event.seriesId)) return true;
  if (event.date && e.match.months.includes(String(event.date).slice(5, 7))) return true;
  if (event.city && e.match.cities.includes(event.city)) return true;
  return false;
}

// Does this entitlement cover a library item? `eventIds` is the item's own event
// attachment list (recordings carry many, simulive carries one). Pass `events`
// (a map of id -> event) to also honour rich match rules.
export function grantsItem(entitlement, eventIds, events = null) {
  const e = normalizeEntitlement(entitlement);
  if (e.mode === "none") return false;
  if (e.mode === "all") return true;
  const on = Array.isArray(eventIds) ? eventIds.filter(Boolean) : [];
  if (on.some((id) => e.eventIds.includes(id))) return true;
  if (!events) return false;
  return on.some((id) => matchesEvent(e, events[id]));
}
