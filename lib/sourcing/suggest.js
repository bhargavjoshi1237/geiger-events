// Ranks who to invite to an RFP from the Venues book and the sourcing pipelines, by capacity fit, location and track record.

import { isEmail, peakRooms, roomNights, toNumber } from "./rfp_model.js";

const fold = (v) =>
  String(v || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

const STAY_KINDS = new Set(["Hotel", "Apartment"]);

const venueDetails = (v) => ({
  city: v.city || "",
  address: v.address || "",
  region: v.region || "",
  country: v.country || "",
  capacity: Math.max(Number(v.seatedCapacity) || 0, Number(v.standingCapacity) || 0) || null,
  latitude: v.latitude ?? null,
  longitude: v.longitude ?? null,
  phone: v.contactPhone || "",
  website: v.website || "",
});

const leadDetails = (c) => ({
  city: c.city || "",
  address: c.address || "",
  region: "",
  country: c.country || "",
  capacity: toNumber(c.capacity) || null,
  latitude: c.latitude ?? null,
  longitude: c.longitude ?? null,
  phone: c.contactPhone || c.phone || "",
  website: c.website || "",
});

// One list of invitable places. A pipeline lead already converted into a venue collapses into that venue,
// which carries the lead's id so an award still marks the lead Booked.
export function buildCandidates({ venues = [], venueLeads = [], stays = [] } = {}) {
  const out = [];
  const venueIds = new Set();
  const seen = new Set();
  const nameKey = (name, city) => `${fold(name)}|${fold(city)}`;
  const leadByVenue = new Map();
  for (const r of venueLeads || []) {
    const vid = r?.config?.venueId;
    if (r?.id && vid && !leadByVenue.has(vid)) leadByVenue.set(vid, r.id);
  }

  for (const v of venues || []) {
    if (!v?.id || v.status === "Archived") continue;
    venueIds.add(v.id);
    seen.add(nameKey(v.name, v.city));
    out.push({
      key: `venue:${v.id}`,
      source: "venue",
      kind: "Venue",
      venueId: v.id,
      pipelineRecordId: leadByVenue.get(v.id) || null,
      name: v.name || "Untitled venue",
      contactName: v.contactName || "",
      email: v.contactEmail || "",
      details: venueDetails(v),
    });
  }

  const addLead = (r, kind) => {
    const c = r?.config || {};
    if (!r?.id || (c.venueId && venueIds.has(c.venueId))) return;
    if (r.status === "Rejected") return;
    const key = nameKey(r.name, c.city);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      key: `lead:${r.id}`,
      source: "pipeline",
      kind,
      venueId: c.venueId && venueIds.has(c.venueId) ? c.venueId : null,
      pipelineRecordId: r.id,
      name: r.name || "Untitled",
      contactName: c.contactName || "",
      email: c.contactEmail || "",
      details: leadDetails(c),
    });
  };
  for (const r of venueLeads || []) addLead(r, "Venue lead");
  for (const r of stays || []) {
    if (STAY_KINDS.has(r?.config?.kind)) addLead(r, r.config.kind);
  }
  return out;
}

// Recipients for pipeline leads handed over from Venue Sourcing; a converted lead is invited as its venue.
// Deduped by venue and email so one insert never trips the per-RFP email index.
export function pipelineRecipients(leads = [], venues = []) {
  const byId = new Map((venues || []).filter((v) => v?.id).map((v) => [v.id, v]));
  const taken = new Set();
  const out = [];
  for (const r of leads || []) {
    if (!r?.id) continue;
    const c = r.config || {};
    const v = c.venueId ? byId.get(c.venueId) : null;
    const recipient = v
      ? {
          source: "venue",
          venueId: v.id,
          pipelineRecordId: r.id,
          name: v.name || r.name || "Untitled venue",
          contactName: v.contactName || c.contactName || "",
          email: v.contactEmail || c.contactEmail || "",
          details: venueDetails(v),
        }
      : {
          source: "pipeline",
          venueId: null,
          pipelineRecordId: r.id,
          name: r.name || "Untitled",
          contactName: c.contactName || "",
          email: c.contactEmail || "",
          details: leadDetails(c),
        };
    const keys = [recipient.venueId && `venue:${recipient.venueId}`, recipient.email && `email:${fold(recipient.email)}`].filter(Boolean);
    if (keys.some((k) => taken.has(k))) continue;
    keys.forEach((k) => taken.add(k));
    out.push(recipient);
  }
  return out;
}

// Per place, how it has answered past RFPs. Keys: venue:<id>, lead:<id>, email:<addr>.
export function recipientHistory(recipients, excludeRfpId) {
  const map = new Map();
  const bump = (key, r) => {
    if (!key) return;
    const h = map.get(key) || { invited: 0, responded: 0, declined: 0, awarded: 0 };
    h.invited += 1;
    if (r.respondedAt || ["responded", "awarded", "lost"].includes(r.status)) h.responded += 1;
    if (r.status === "declined") h.declined += 1;
    if (r.status === "awarded") h.awarded += 1;
    map.set(key, h);
  };
  for (const r of recipients || []) {
    if (!r?.invitedAt || r.rfpId === excludeRfpId) continue;
    const keys = new Set();
    if (r.venueId) keys.add(`venue:${r.venueId}`);
    if (r.pipelineRecordId) keys.add(`lead:${r.pipelineRecordId}`);
    if (r.email) keys.add(`email:${fold(r.email)}`);
    for (const k of keys) bump(k, r);
  }
  return map;
}

function locationFit(rfpLocation, d) {
  const tokens = fold(rfpLocation)
    .split(/[,/;]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (!tokens.length) return { score: 15, reason: null };
  const city = fold(d.city);
  const haystack = fold([d.address, d.region, d.city].join(" "));
  const country = fold(d.country);
  if (city && tokens.some((t) => t === city || t.includes(city) || city.includes(t))) {
    return { score: 35, reason: `In ${d.city}` };
  }
  if (haystack && tokens.some((t) => t.length > 2 && haystack.includes(t))) {
    return { score: 25, reason: `Near ${rfpLocation}` };
  }
  if (country && tokens.some((t) => t === country)) return { score: 12, reason: `In ${d.country}` };
  if (!city && !haystack) return { score: 8, reason: "Location unknown" };
  return { score: 0, reason: `Outside ${rfpLocation}` };
}

function capacityFit(pax, capacity, kind, needsRooms) {
  if (STAY_KINDS.has(kind)) {
    return needsRooms ? { score: 26, reason: "Hotel for your room block" } : { score: 8, reason: "Hotel — no room block requested" };
  }
  const cap = Number(capacity) || 0;
  if (!pax || !cap) return { score: 16, reason: "Capacity unknown" };
  const ratio = cap / pax;
  const fmt = (n) => n.toLocaleString("en-US");
  if (ratio >= 1 && ratio <= 2) return { score: 40, reason: `Holds ${fmt(cap)} for your ${fmt(pax)}` };
  if (ratio > 2) return { score: Math.max(16, Math.round(40 - (ratio - 2) * 6)), reason: `Large for your group (${fmt(cap)})` };
  return { score: Math.round(40 * ratio * 0.5), reason: `Holds ${fmt(cap)} — under your ${fmt(pax)}` };
}

function historyFit(h) {
  if (!h || !h.invited) return { score: 10, reason: null };
  const rate = h.responded / h.invited;
  const score = Math.min(25, Math.round(25 * rate) + (h.awarded ? 5 : 0));
  const bits = [`Answered ${h.responded} of ${h.invited} RFP${h.invited === 1 ? "" : "s"}`];
  if (h.awarded) bits.push(`won ${h.awarded} before`);
  return { score, reason: bits.join(", ") };
}

// Candidates not yet on the RFP, best fit first: [{ ...candidate, score, reasons, contactable }].
export function rankCandidates({ rfp, candidates, recipients = [], history }) {
  const pax = Number(rfp?.attendees) || 0;
  const needsRooms = roomNights(rfp?.sleepingRooms) > 0 || peakRooms(rfp?.sleepingRooms) > 0;
  const taken = new Set();
  for (const r of recipients) {
    if (r.venueId) taken.add(`venue:${r.venueId}`);
    if (r.pipelineRecordId) taken.add(`lead:${r.pipelineRecordId}`);
    if (r.email) taken.add(`email:${fold(r.email)}`);
  }

  return (candidates || [])
    .filter((c) => {
      if (c.venueId && taken.has(`venue:${c.venueId}`)) return false;
      if (c.pipelineRecordId && taken.has(`lead:${c.pipelineRecordId}`)) return false;
      if (c.email && taken.has(`email:${fold(c.email)}`)) return false;
      return true;
    })
    .map((c) => {
      const loc = locationFit(rfp?.location, c.details);
      const cap = capacityFit(pax, c.details.capacity, c.kind, needsRooms);
      const keys = [
        c.venueId && `venue:${c.venueId}`,
        c.pipelineRecordId && `lead:${c.pipelineRecordId}`,
        c.email && `email:${fold(c.email)}`,
      ].filter(Boolean);
      const h = keys.map((k) => history?.get(k)).find(Boolean);
      const hist = historyFit(h);
      const contactable = isEmail(c.email);
      const reasons = [cap.reason, loc.reason, hist.reason].filter(Boolean);
      if (!contactable) reasons.push("No email on file");
      return { ...c, score: Math.min(100, cap.score + loc.score + hist.score), reasons, contactable };
    })
    .sort((a, b) => b.score - a.score || Number(b.contactable) - Number(a.contactable) || a.name.localeCompare(b.name));
}

// The events.venues row an awarded recipient becomes when it isn't already in the Venues book.
export function venueDraftFromRecipient(recipient, bid) {
  const d = recipient?.details || {};
  const capacity = Math.max(Number(bid?.capacity) || 0, Number(d.capacity) || 0);
  return {
    name: recipient?.name || "",
    address: d.address || "",
    city: d.city || "",
    country: d.country || "",
    latitude: toNumber(d.latitude),
    longitude: toNumber(d.longitude),
    seatedCapacity: capacity || 0,
    contactName: recipient?.contactName || "",
    contactEmail: recipient?.email || "",
    contactPhone: d.phone || "",
    website: d.website || "",
  };
}
