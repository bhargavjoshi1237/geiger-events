import { grantsItem, latestExpiry } from "../memberships/entitlements.js";


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
  if (rules.free) return { granted: true, expiresAt: null, via: "Free" };

  let granted = false;
  let expiresAt = null;
  let via = "";

  for (const g of grants) {
    if (g.projectId !== projectId) continue;
    if (!grantsItem(g.entitlement, eventIds, events)) continue;
    expiresAt = granted ? latestExpiry(expiresAt, g.expiresAt) : g.expiresAt;
    granted = true;
    via = g.planName;
  }

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
