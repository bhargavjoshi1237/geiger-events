import { adminClient } from "@/lib/supabase/admin";
import {
  entitlementExpiry,
  earliestExpiry,
  grantsItem,
  latestExpiry,
  normalizeEntitlement,
} from "@/lib/memberships/entitlements";

// Server-only resolver for the portal's Watch tab: which recordings a member can
// play right now, and until when. Two independent paths grant access and are
// unioned (most generous window wins):
//
//   plan-side     the member's plan attaches VOD content
//                 (config.entitlements.vod — scope + duration from join date)
//   content-side  the item itself names the plan
//                 (config.access.membership.planIds — lasts as long as the
//                 membership does)
//
// All reads run via the service role and are scoped to the member's own email.

const LIBRARY_MODULES = ["recording", "simulive"];
// A library item is only watchable once its own status says so.
const WATCHABLE_STATUS = {
  recording: new Set(["Published"]),
  simulive: new Set(["Available", "Premiering"]),
};

const asObject = (v) => (v && typeof v === "object" ? v : {});

// The events a library item is attached to — recordings carry many, simulive one.
function itemEventIds(config) {
  const c = asObject(config);
  if (Array.isArray(c.eventIds)) return c.eventIds.filter(Boolean);
  return c.eventId ? [c.eventId] : [];
}

export async function listMemberWatchlist(email) {
  const sb = adminClient();
  if (!sb || !email) return [];

  // 1. The member's live memberships, with the plan config that drives grants.
  const { data: rows, error } = await sb
    .from("membership_members")
    .select(
      "id, project_id, membership_id, status, started_at, expires_at, plan:ticketing_records(id, name, config, active, deleted_at)",
    )
    .ilike("email", email)
    .eq("status", "Active")
    .is("deleted_at", null);
  if (error) {
    console.error("[portal.watch.memberships]", error.message);
    return [];
  }

  const active = (rows || []).filter((m) => m.plan && m.plan.active && !m.plan.deleted_at);
  if (!active.length) return [];

  // Plan-side grants, plus the plan ids each project's content can name.
  const grants = [];
  const planIdsByProject = {};
  for (const m of active) {
    const vod = normalizeEntitlement(asObject(m.plan.config).entitlements?.vod);
    if (vod.mode !== "none") {
      grants.push({
        projectId: m.project_id,
        planName: m.plan.name || "Membership",
        entitlement: vod,
        // Access ends at whichever comes first: the entitlement window measured
        // from the join date, or the membership itself lapsing.
        expiresAt: earliestExpiry(
          entitlementExpiry(m.started_at, vod.duration),
          m.expires_at,
        ),
      });
    }
    (planIdsByProject[m.project_id] ||= new Set()).add(m.membership_id);
  }

  const projectIds = [...new Set(active.map((m) => m.project_id).filter(Boolean))];
  if (!projectIds.length) return [];

  // Membership expiry per plan, for content-side grants (no duration of their own).
  const planExpiry = {};
  for (const m of active) {
    planExpiry[m.membership_id] = latestExpiry(planExpiry[m.membership_id], m.expires_at);
  }
  const planName = Object.fromEntries(active.map((m) => [m.membership_id, m.plan.name]));

  // 2. The events in those projects — needed to resolve "match a group" rules
  // and to label each item with the event it came from.
  const { data: eventRows } = await sb
    .from("events")
    .select("id, name, type, series_id, event_date, city")
    .in("project_id", projectIds)
    .is("deleted_at", null);
  const events = Object.fromEntries(
    (eventRows || []).map((e) => [
      e.id,
      {
        id: e.id,
        name: e.name ?? "",
        type: e.type ?? "",
        seriesId: e.series_id ?? null,
        date: e.event_date ?? "",
        city: e.city ?? "",
      },
    ]),
  );

  // 3. The library itself.
  const { data: items, error: itemsError } = await sb
    .from("conference_records")
    .select("id, module, name, status, cover_url, config, project_id, created_at")
    .in("project_id", projectIds)
    .in("module", LIBRARY_MODULES)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (itemsError) {
    console.error("[portal.watch.library]", itemsError.message);
    return [];
  }

  const out = [];
  for (const item of items || []) {
    if (!WATCHABLE_STATUS[item.module]?.has(item.status)) continue;
    const config = asObject(item.config);
    if (!config.videoUrl) continue;

    const eventIds = itemEventIds(config);
    let granted = false;
    let expiresAt;
    let via = "";

    // Plan-side: does any grant in this project cover the item?
    for (const g of grants) {
      if (g.projectId !== item.project_id) continue;
      if (!grantsItem(g.entitlement, eventIds, events)) continue;
      // First hit sets the window; later hits widen it.
      expiresAt = granted ? latestExpiry(expiresAt, g.expiresAt) : g.expiresAt;
      granted = true;
      via = g.planName;
    }

    // Content-side: the item names one of the member's plans directly.
    const membership = asObject(asObject(config.access).membership);
    if (membership.enabled && Array.isArray(membership.planIds)) {
      const held = [...(planIdsByProject[item.project_id] || [])].filter((id) =>
        membership.planIds.includes(id),
      );
      for (const id of held) {
        expiresAt = granted ? latestExpiry(expiresAt, planExpiry[id]) : planExpiry[id];
        granted = true;
        via = via || planName[id] || "Membership";
      }
    }

    if (!granted) continue;
    // A window that already closed isn't access.
    if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) continue;

    const eventNames = eventIds.map((id) => events[id]?.name).filter(Boolean);
    out.push({
      id: item.id,
      kind: item.module,
      name: item.name || "Untitled recording",
      videoUrl: config.videoUrl,
      thumbnailUrl: item.cover_url || "",
      session: config.session ?? "",
      speaker: config.speaker ?? "",
      duration: config.duration ?? "",
      recordedAt: config.recordedAt ?? "",
      premiereAt: config.premiereAt ?? "",
      description: config.description ?? "",
      tags: Array.isArray(config.tags) ? config.tags : [],
      eventName: eventNames[0] || "",
      planName: via,
      expiresAt: expiresAt || null,
    });
  }

  return out;
}
