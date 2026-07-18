import { adminClient } from "@/lib/supabase/admin";

// All reads use the service role (bypasses org-scoped RLS) and are scoped to the
// member's own email. camelCase view models the portal renders directly.

// Short human-facing order reference derived from the uuid (e.g. "GE-3F9A2C1B").
function orderCode(id) {
  return id ? `GE-${String(id).replace(/-/g, "").slice(0, 8).toUpperCase()}` : "";
}

const EVENT_SELECT =
  "name, event_date, event_time, venue, address, city, timezone, cover_url";

function mapOrder(o) {
  const meta = o.metadata && typeof o.metadata === "object" ? o.metadata : {};
  const offerings = Array.isArray(meta.offerings) ? meta.offerings : [];
  const purchasables = Array.isArray(meta.purchasables) ? meta.purchasables : [];
  const slot = meta.slot && typeof meta.slot === "object" ? meta.slot : null;
  const discount = meta.discount && typeof meta.discount === "object" ? meta.discount : null;
  const donation = meta.donation && typeof meta.donation === "object" ? meta.donation : null;
  const bundle = meta.bundle && typeof meta.bundle === "object" ? meta.bundle : null;
  const group = meta.group && typeof meta.group === "object" ? meta.group : null;
  const earlybird = meta.earlybird && typeof meta.earlybird === "object" ? meta.earlybird : null;
  return {
    id: o.id,
    orderCode: orderCode(o.id),
    eventId: o.event_id,
    eventName: o.event?.name ?? "Event",
    eventDate: o.event?.event_date ?? "",
    eventTime: o.event?.event_time ?? "",
    venue: o.event?.venue ?? "",
    address: o.event?.address ?? "",
    city: o.event?.city ?? "",
    timezone: o.event?.timezone ?? "",
    organizer: o.event?.organizer ?? "",
    coverUrl: o.event?.cover_url ?? "",
    buyerName: o.buyer_name ?? "",
    buyerEmail: o.buyer_email ?? "",
    ticket: o.ticket_name ?? "",
    quantity: o.quantity ?? 1,
    unitPrice: Number(o.ticket_price ?? 0),
    total: Number(o.total ?? 0),
    offerings,
    purchasables,
    slot,
    discount,
    donation,
    bundle,
    group,
    earlybird,
    paid: Boolean(o.stripe_payment_intent_id),
    status: o.status ?? "confirmed",
    createdAt: o.created_at,
  };
}

const ORDER_SELECT =
  "id, event_id, buyer_name, buyer_email, ticket_name, ticket_price, quantity, total, status, metadata, stripe_payment_intent_id, created_at, event:events(" +
  EVENT_SELECT +
  ", organizer)";

export async function listMemberOrders(email) {
  const sb = adminClient();
  if (!sb || !email) return [];
  const { data, error } = await sb
    .from("event_orders")
    .select(ORDER_SELECT)
    .ilike("buyer_email", email)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[portal.orders]", error.message);
    return [];
  }
  return (data || []).map(mapOrder);
}

// A single order scoped to the member — the ownership check behind the QR route.
export async function getMemberOrder(email, orderId) {
  const sb = adminClient();
  if (!sb || !email || !orderId) return null;
  const { data, error } = await sb
    .from("event_orders")
    .select(ORDER_SELECT)
    .eq("id", orderId)
    .ilike("buyer_email", email)
    .maybeSingle();
  if (error) {
    console.error("[portal.order]", error.message);
    return null;
  }
  return data ? mapOrder(data) : null;
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
  return (data || []).map((m) => {
    const cfg = m.plan?.config && typeof m.plan.config === "object" ? m.plan.config : {};
    return {
      id: m.id,
      planName: m.plan?.name ?? "Membership",
      description: cfg.description ?? "",
      benefits: Array.isArray(cfg.benefits) ? cfg.benefits : [],
      price: Number(cfg.price ?? 0),
      billingPeriod: cfg.billingPeriod ?? "",
      discountPercent: Number(cfg.discountPercent ?? 0),
      status: m.status ?? "Active",
      startedAt: m.started_at ?? null,
      expiresAt: m.expires_at ?? null,
    };
  });
}

// A ticket is a confirmed order; one card per order, carrying the event details
// the ticket dialog (QR / calendar / directions) needs.
export function ticketsFromOrders(orders) {
  return (orders || [])
    .filter((o) => o.status !== "cancelled" && o.status !== "refunded")
    .map((o) => ({
      id: o.id,
      orderCode: o.orderCode,
      eventId: o.eventId,
      eventName: o.eventName,
      eventDate: o.eventDate,
      eventTime: o.eventTime,
      venue: o.venue,
      address: o.address,
      city: o.city,
      timezone: o.timezone,
      organizer: o.organizer,
      coverUrl: o.coverUrl,
      buyerName: o.buyerName,
      buyerEmail: o.buyerEmail,
      ticket: o.ticket,
      quantity: o.quantity,
      unitPrice: o.unitPrice,
      total: o.total,
      offerings: o.offerings,
      purchasables: o.purchasables,
      slot: o.slot,
      discount: o.discount,
      donation: o.donation,
      bundle: o.bundle,
      group: o.group,
      earlybird: o.earlybird,
      paid: o.paid,
      status: o.status,
      refund: o.refund || null,
      createdAt: o.createdAt,
    }));
}
