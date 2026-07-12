import { adminClient } from "@/lib/supabase/admin";

// Server-only membership purchase layer for the portal. Membership *plans* are
// events.ticketing_records (module 'membership'); a project opts into self-serve
// buying via events.ticketing_settings (module 'membership') config.publicJoin.
// Enrollments land in events.membership_members. All reads run via the service
// role and are scoped to projects the member is actually connected to.

function planConfig(row) {
  const c = row?.config && typeof row.config === "object" ? row.config : {};
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    name: row.name ?? "Membership",
    price: Number(c.price ?? 0),
    billingPeriod: c.billingPeriod ?? "yearly",
    discountPercent: Number(c.discountPercent ?? 0),
    benefits: Array.isArray(c.benefits) ? c.benefits : [],
    description: c.description ?? "",
  };
}

// Compute an enrollment's expiry from the plan's billing period. one-time =>
// no expiry (lifetime). Uses a passed-in `from` Date so the caller controls now.
export function computeExpiry(billingPeriod, from = new Date()) {
  const d = new Date(from);
  if (billingPeriod === "monthly") {
    d.setMonth(d.getMonth() + 1);
    return d.toISOString();
  }
  if (billingPeriod === "yearly") {
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString();
  }
  return null; // one-time / lifetime
}

// The projects a member is connected to — from their orders and any existing
// memberships. Buying is only offered within this set.
export async function listMemberProjectIds(email) {
  const sb = adminClient();
  if (!sb || !email) return [];
  const ids = new Set();
  const [orders, members] = await Promise.all([
    sb.from("event_orders").select("project_id").ilike("buyer_email", email),
    sb
      .from("membership_members")
      .select("project_id")
      .ilike("email", email)
      .is("deleted_at", null),
  ]);
  for (const r of orders.data || []) if (r.project_id) ids.add(r.project_id);
  for (const r of members.data || []) if (r.project_id) ids.add(r.project_id);
  return [...ids];
}

// Plans the member can buy: active membership plans in their connected projects
// whose project has publicJoin on. Each carries `held` = they already hold it.
export async function listBuyableMembershipPlans(email) {
  const sb = adminClient();
  if (!sb || !email) return [];
  const projectIds = await listMemberProjectIds(email);
  if (!projectIds.length) return [];

  // Which of those projects allow public self-serve joining.
  const { data: settings } = await sb
    .from("ticketing_settings")
    .select("project_id, config")
    .eq("module", "membership")
    .in("project_id", projectIds);
  const openProjects = (settings || [])
    .filter((s) => s.config?.enabled && s.config?.publicJoin)
    .map((s) => s.project_id);
  if (!openProjects.length) return [];

  const { data: plans, error } = await sb
    .from("ticketing_records")
    .select("id, project_id, name, config")
    .eq("module", "membership")
    .eq("active", true)
    .is("deleted_at", null)
    .in("project_id", openProjects);
  if (error) {
    console.error("[portal.plans]", error.message);
    return [];
  }

  // Plans the member already actively holds (to badge / disable in the UI).
  const { data: held } = await sb
    .from("membership_members")
    .select("membership_id")
    .ilike("email", email)
    .eq("status", "Active")
    .is("deleted_at", null);
  const heldIds = new Set((held || []).map((h) => h.membership_id));

  return (plans || []).map((p) => ({
    ...planConfig(p),
    held: heldIds.has(p.id),
  }));
}

// Authoritative plan resolve for checkout — returns { plan, buyable }. `buyable`
// is true only when the plan's project has publicJoin enabled.
export async function getPlanForPurchase(planId) {
  const sb = adminClient();
  if (!sb || !planId) return { plan: null, buyable: false };
  const { data: row } = await sb
    .from("ticketing_records")
    .select("id, project_id, name, config, active, deleted_at")
    .eq("id", planId)
    .eq("module", "membership")
    .maybeSingle();
  if (!row || !row.active || row.deleted_at) return { plan: null, buyable: false };

  const { data: setting } = await sb
    .from("ticketing_settings")
    .select("config")
    .eq("module", "membership")
    .eq("project_id", row.project_id)
    .maybeSingle();
  const buyable = Boolean(setting?.config?.enabled && setting?.config?.publicJoin);
  return { plan: planConfig(row), buyable };
}

// True when the member already holds this plan actively.
export async function hasActiveMembership(email, planId) {
  const sb = adminClient();
  if (!sb || !email || !planId) return false;
  const { data } = await sb
    .from("membership_members")
    .select("id")
    .ilike("email", email)
    .eq("membership_id", planId)
    .eq("status", "Active")
    .is("deleted_at", null)
    .maybeSingle();
  return Boolean(data);
}

// Create the enrollment row. Idempotent on stripeSessionId (a refreshed return
// page never enrolls twice). Returns the plan name on success, null on failure.
export async function enrollMembership({ email, name, plan, stripeSessionId = null }) {
  const sb = adminClient();
  if (!sb || !email || !plan?.id) return null;

  if (stripeSessionId) {
    const { data: existing } = await sb
      .from("membership_members")
      .select("id")
      .eq("metadata->>stripeSessionId", stripeSessionId)
      .maybeSingle();
    if (existing) return { name: plan.name, already: true };
  }

  const nowIso = new Date().toISOString();
  const { error } = await sb.from("membership_members").insert({
    project_id: plan.projectId,
    membership_id: plan.id,
    name: name || "",
    email,
    status: "Active",
    started_at: nowIso,
    expires_at: computeExpiry(plan.billingPeriod),
    metadata: {
      source: "portal",
      price: plan.price,
      billingPeriod: plan.billingPeriod,
      ...(stripeSessionId ? { stripeSessionId } : {}),
    },
  });
  if (error) {
    console.error("[portal.enroll]", error.message);
    return null;
  }
  return { name: plan.name };
}
