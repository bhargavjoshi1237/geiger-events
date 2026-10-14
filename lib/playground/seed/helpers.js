// Shared helpers for the playground seed. Seed rows are raw DB rows (snake_case),
// exactly what Supabase would return, so every normalize*() in lib/supabase/*
// runs over them unchanged. Keep seed files free of "use client" and of React
// imports so the integrity test can load them in plain Node.

import { PLAYGROUND_PROJECT } from "../mode.js";

export const PROJECT_ID = PLAYGROUND_PROJECT.id;

// Stable, valid UUIDs per entity kind so cross-table references line up.
// EDIT PER APP: an 8-hex-digit app prefix and the kinds the seed uses.
// sid("event", 3) -> "e7e70002-0000-4000-8000-000000000003".
const APP_PREFIX = 0xe7e70000;
const KIND_CODES = {
  // kind: code (1..4095), unique within the app
  user: 1,
  event: 2,
  venue: 3,
  series: 4,
  template: 5,
  ticketRecord: 6,
  ticketSetting: 7,
  order: 8,
  orderEvent: 9,
  orderRefund: 10,
  dispute: 11,
  refundRequest: 12,
  groupPurchase: 13,
  registration: 14,
  form: 15,
  contact: 16,
  contactActivity: 17,
  tag: 18,
  segment: 19,
  dataRequest: 20,
  checkin: 21,
  staffRole: 22,
  lead: 23,
  checkinSetting: 24,
  conference: 25,
  community: 26,
  analytics: 27,
  advertising: 28,
  settingsRecord: 29,
  campaign: 30,
  campaignAsset: 31,
  campaignSetting: 32,
  workflow: 33,
  workflowRun: 34,
  role: 35,
  grant: 36,
  member: 37,
  memberGroup: 38,
  memberActivity: 39,
  eventTeam: 40,
  membership: 41,
  item: 42,
  movement: 43,
  allocation: 44,
  redemption: 45,
  supplier: 46,
  purchaseOrder: 47,
  seatMap: 48,
  seatSection: 49,
  seat: 50,
  seatAssignment: 51,
  hallMap: 52,
  booth: 53,
  boothAssignment: 54,
  chatChannel: 55,
  chatParticipant: 56,
  chatMessage: 57,
  thread: 58,
  threadMessage: 59,
  portalMember: 60,
  affiliate: 61,
  affiliateProgram: 62,
  affiliateTier: 63,
  affiliateEnrolment: 64,
  affiliateCommission: 65,
  affiliatePayout: 66,
  affiliateTemplate: 67,
  notification: 68,
  dietaryRequest: 69,
  follower: 70,
  organiserProfile: 71,
  wall: 72,
  pageLayout: 73,
  addon: 74,
  navPref: 75,
  question: 76,
  answer: 77,
  packageEnquiry: 78,
  sponsorEnquiry: 79,
  nfcEntry: 80,
  nfcCredential: 81,
  nfcTap: 82,
  presence: 83,
  organization: 84,
  domain: 85,
};

export function sid(kind, n) {
  const code = KIND_CODES[kind];
  if (!code) throw new Error(`Unknown seed kind: ${kind}`);
  const prefix = (APP_PREFIX + code).toString(16).padStart(8, "0");
  return `${prefix}-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// Everything is relative to page load so the demo never looks stale.
export function daysAgo(days, hours = 0) {
  return new Date(Date.now() - days * DAY - hours * HOUR).toISOString();
}

export function hoursAgo(hours) {
  return new Date(Date.now() - hours * HOUR).toISOString();
}

export function minutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

export function daysFromNow(days, hours = 0) {
  return new Date(Date.now() + days * DAY + hours * HOUR).toISOString();
}

export function dateOnly(iso) {
  return iso.slice(0, 10);
}

// Deterministic 0..1 pseudo-random from a number, so seeded data looks organic
// but is identical on every load.
export function noise(n) {
  const x = Math.sin(n * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

// Deterministic integer in [min, max].
export function between(n, min, max) {
  return Math.round(min + noise(n) * (max - min));
}

// Deterministic element of an array.
export function pick(arr, n) {
  return arr[Math.floor(noise(n) * arr.length) % arr.length];
}

// Deterministic weighted choice: weighted(7, [["paid", 8], ["refunded", 1]]).
export function weighted(n, pairs) {
  const total = pairs.reduce((sum, [, w]) => sum + w, 0);
  let roll = noise(n) * total;
  for (const [value, w] of pairs) {
    roll -= w;
    if (roll < 0) return value;
  }
  return pairs[pairs.length - 1][0];
}

// range(3, (i) => i * 2) -> [2, 4, 6]; i is 1-based so it doubles as sid n.
export function range(count, fn = (i) => i) {
  return Array.from({ length: count }, (_, i) => fn(i + 1));
}

// Base columns most project-owned rows carry. Drop or override what a table
// doesn't have.
export function base(kind, n, { created = 30, updated, ...rest } = {}) {
  return {
    id: sid(kind, n),
    project_id: PROJECT_ID,
    created_at: daysAgo(created),
    updated_at: daysAgo(updated ?? Math.max(0, created - 1)),
    ...rest,
  };
}
