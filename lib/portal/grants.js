import {
  entitlementExpiry,
  earliestExpiry,
  latestExpiry,
  normalizeEntitlement,
} from "@/lib/memberships/entitlements";


const asObject = (v) => (v && typeof v === "object" ? v : {});

export async function loadMemberGrants(sb, email) {
  if (!sb || !email) return null;

  const { data: rows, error } = await sb
    .from("membership_members")
    .select(
      "id, project_id, membership_id, status, started_at, expires_at, plan:ticketing_records(id, name, config, active, deleted_at)",
    )
    .ilike("email", email)
    .eq("status", "Active")
    .is("deleted_at", null);
  if (error) {
    console.error("[portal.grants.memberships]", error.message);
    return null;
  }

  const active = (rows || []).filter((m) => m.plan && m.plan.active && !m.plan.deleted_at);
  if (!active.length) return null;

  const grants = [];
  const planIdsByProject = {};
  for (const m of active) {
    const vod = normalizeEntitlement(asObject(m.plan.config).entitlements?.vod);
    if (vod.mode !== "none") {
      grants.push({
        projectId: m.project_id,
        planName: m.plan.name || "Membership",
        entitlement: vod,
        expiresAt: earliestExpiry(
          entitlementExpiry(m.started_at, vod.duration),
          m.expires_at,
        ),
      });
    }
    (planIdsByProject[m.project_id] ||= new Set()).add(m.membership_id);
  }

  const projectIds = [...new Set(active.map((m) => m.project_id).filter(Boolean))];
  if (!projectIds.length) return null;

  const planExpiry = {};
  for (const m of active) {
    planExpiry[m.membership_id] = latestExpiry(planExpiry[m.membership_id], m.expires_at);
  }
  const planName = Object.fromEntries(active.map((m) => [m.membership_id, m.plan.name]));

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

  return { grants, planIdsByProject, planExpiry, planName, events, projectIds };
}
