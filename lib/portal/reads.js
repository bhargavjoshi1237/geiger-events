import { adminClient } from "@/lib/supabase/admin";

// All reads use the service role (bypasses org-scoped RLS) and are scoped to the
// member's own email. camelCase view models the portal renders directly.

export async function listMemberOrders(email) {
  const sb = adminClient();
  if (!sb || !email) return [];
  const { data, error } = await sb
    .from("event_orders")
    .select(
      "id, event_id, ticket_name, quantity, total, status, created_at, event:events(name, event_date, cover_url)",
    )
    .ilike("buyer_email", email)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[portal.orders]", error.message);
    return [];
  }
  return (data || []).map((o) => ({
    id: o.id,
    eventId: o.event_id,
    eventName: o.event?.name ?? "Event",
    eventDate: o.event?.event_date ?? "",
    coverUrl: o.event?.cover_url ?? "",
    ticket: o.ticket_name ?? "",
    quantity: o.quantity ?? 1,
    total: Number(o.total ?? 0),
    status: o.status ?? "confirmed",
    createdAt: o.created_at,
  }));
}

export async function listMemberMemberships(email) {
  const sb = adminClient();
  if (!sb || !email) return [];
  const { data, error } = await sb
    .from("membership_members")
    .select(
      "id, status, started_at, expires_at, plan:ticketing_records(name, config)",
    )
    .ilike("email", email)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[portal.memberships]", error.message);
    return [];
  }
  return (data || []).map((m) => ({
    id: m.id,
    planName: m.plan?.name ?? "Membership",
    price: Number(m.plan?.config?.price ?? 0),
    billingPeriod: m.plan?.config?.billingPeriod ?? "",
    discountPercent: Number(m.plan?.config?.discountPercent ?? 0),
    status: m.status ?? "Active",
    startedAt: m.started_at ?? null,
    expiresAt: m.expires_at ?? null,
  }));
}

// A ticket is a confirmed order; one card per order.
export function ticketsFromOrders(orders) {
  return (orders || [])
    .filter((o) => o.status !== "cancelled" && o.status !== "refunded")
    .map((o) => ({
      id: o.id,
      eventName: o.eventName,
      eventDate: o.eventDate,
      ticket: o.ticket,
      quantity: o.quantity,
      status: o.status,
    }));
}
