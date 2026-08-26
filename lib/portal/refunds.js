import { adminClient } from "@/lib/supabase/admin";

const OPEN_STATUSES = ["Requested", "Approved"];

export async function listMemberRefunds(email) {
  const sb = adminClient();
  if (!sb || !email) return {};
  const { data, error } = await sb
    .from("refund_requests")
    .select("id, order_id, status, reason, amount, created_at")
    .ilike("buyer_email", email)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[portal.refunds.list]", error.message);
    return {};
  }
  const byOrder = {};
  for (const r of data || []) {
    if (r.order_id && !(r.order_id in byOrder)) {
      byOrder[r.order_id] = {
        id: r.id,
        status: r.status || "Requested",
        reason: r.reason || "",
        amount: Number(r.amount || 0),
        createdAt: r.created_at,
      };
    }
  }
  return byOrder;
}

export async function fileRefund({ email, name, orderId, reason }) {
  const sb = adminClient();
  if (!sb) return { error: "Unavailable." };
  if (!orderId) return { error: "Missing order." };

  const { data: order } = await sb
    .from("event_orders")
    .select("id, event_id, project_id, buyer_email, buyer_name, total, status")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || String(order.buyer_email || "").toLowerCase() !== String(email).toLowerCase()) {
    return { error: "Order not found." };
  }
  if (order.status === "refunded" || order.status === "cancelled") {
    return { error: "This order can't be refunded." };
  }

  if (order.project_id) {
    const { data: setting } = await sb
      .from("ticketing_settings")
      .select("config")
      .eq("module", "refund")
      .eq("project_id", order.project_id)
      .maybeSingle();
    if (setting && setting.config && setting.config.enabled === false) {
      return { error: "Refunds aren't available for this event." };
    }
  }

  const { data: existing } = await sb
    .from("refund_requests")
    .select("id, status")
    .eq("order_id", orderId)
    .is("deleted_at", null)
    .in("status", OPEN_STATUSES)
    .maybeSingle();
  if (existing) return { error: "A refund request is already in progress." };

  const { error } = await sb.from("refund_requests").insert({
    project_id: order.project_id,
    event_id: order.event_id,
    order_id: order.id,
    buyer_name: order.buyer_name || name || "",
    buyer_email: order.buyer_email || email,
    reason: String(reason || "").slice(0, 1000),
    amount: Number(order.total || 0),
    status: "Requested",
    metadata: { source: "portal" },
  });
  if (error) {
    console.error("[portal.refunds.file]", error.message);
    return { error: "Couldn't submit your request." };
  }
  return { ok: true };
}
