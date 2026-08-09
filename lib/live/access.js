// Relative, not "@/…": this module is covered by node:test, which does not
// resolve the bundler's path alias.
import { grantsItem, latestExpiry } from "../memberships/entitlements.js";

// One entitlement resolver shared by live rooms and the on-demand library, and
// the owner of the access shape itself. Two independent paths grant access and
// are unioned, most generous window winning:
//   plan-side     the member's plan attaches content (entitlements.vod)
//   content-side  the item itself names the plan (config.access.membership)
// Pure: no I/O, so the portal resolvers and the tests use it directly.

// A piece of content is either Free (optionally registration-gated) or
// Restricted, in which case any combination of three paid paths unlocks it.
export const DEFAULT_ACCESS = {
  free: true,
  registrationRequired: false,
  membership: { enabled: false, planIds: [] },
  purchase: { enabled: false, price: 0 },
  rental: { enabled: false, price: 0, days: 3 },
};

export function normalizeAccess(a) {
  const v = a && typeof a === "object" ? a : {};
  return {
    free: v.free === undefined ? true : Boolean(v.free),
    registrationRequired: Boolean(v.registrationRequired),
    membership: {
      enabled: Boolean(v.membership?.enabled),
      planIds: Array.isArray(v.membership?.planIds) ? v.membership.planIds : [],
    },
    purchase: { enabled: Boolean(v.purchase?.enabled), price: Number(v.purchase?.price) || 0 },
    rental: {
      enabled: Boolean(v.rental?.enabled),
      price: Number(v.rental?.price) || 0,
      days: Number(v.rental?.days) || 3,
    },
  };
}

const DENIED = { granted: false, expiresAt: null, via: "" };

export function resolveItemGrant({
  access,
  eventIds = [],
  projectId,
  grants = [],
  planIdsByProject = {},
  planExpiry = {},
  planName = {},
  events = {},
}) {
  const rules = normalizeAccess(access);
  // Free content needs no membership and never expires.
  if (rules.free) return { granted: true, expiresAt: null, via: "Free" };

  let granted = false;
  let expiresAt = null;
  let via = "";

  // Plan-side: does any of the member's entitlements cover this item?
  for (const g of grants) {
    if (g.projectId !== projectId) continue;
    if (!grantsItem(g.entitlement, eventIds, events)) continue;
    expiresAt = granted ? latestExpiry(expiresAt, g.expiresAt) : g.expiresAt;
    granted = true;
    via = g.planName;
  }

  // Content-side: the item names a plan the member holds in this project.
  if (rules.membership.enabled) {
    const held = [...(planIdsByProject[projectId] || [])].filter((id) =>
      rules.membership.planIds.includes(id),
    );
    for (const id of held) {
      expiresAt = granted ? latestExpiry(expiresAt, planExpiry[id]) : planExpiry[id];
      granted = true;
      via = via || planName[id] || "Membership";
    }
  }

  if (!granted) return DENIED;
  return { granted: true, expiresAt: expiresAt || null, via };
}
