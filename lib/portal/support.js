import { adminClient } from "@/lib/supabase/admin";

// Server-only support-thread layer for the portal (buyer ↔ organiser messaging).
// Owns events.portal_threads + events.portal_thread_messages. All access is via
// the service role and scoped to the session member's id — a member can only ever
// read/write their own threads.

function mapThread(t, preview) {
  return {
    id: t.id,
    subject: t.subject || "Support request",
    status: t.status || "open",
    eventId: t.event_id ?? null,
    orderId: t.order_id ?? null,
    unread: Boolean(t.member_unread),
    lastMessageAt: t.last_message_at,
    createdAt: t.created_at,
    preview: preview ?? "",
  };
}

export async function listMemberThreads(memberId) {
  const sb = adminClient();
  if (!sb || !memberId) return [];
  const { data, error } = await sb
    .from("portal_threads")
    .select("*")
    .eq("member_id", memberId)
    .order("last_message_at", { ascending: false });
  if (error) {
    console.error("[portal.threads]", error.message);
    return [];
  }
  const threads = data || [];
  // Latest message per thread for the list preview.
  const ids = threads.map((t) => t.id);
  const previews = {};
  if (ids.length) {
    const { data: msgs } = await sb
      .from("portal_thread_messages")
      .select("thread_id, body, created_at")
      .in("thread_id", ids)
      .order("created_at", { ascending: false });
    for (const m of msgs || []) {
      if (!(m.thread_id in previews)) previews[m.thread_id] = m.body;
    }
  }
  return threads.map((t) => mapThread(t, previews[t.id]));
}

export async function getMemberThread(memberId, threadId) {
  const sb = adminClient();
  if (!sb || !memberId || !threadId) return null;
  const { data: thread } = await sb
    .from("portal_threads")
    .select("*")
    .eq("id", threadId)
    .eq("member_id", memberId)
    .maybeSingle();
  if (!thread) return null;

  const { data: messages } = await sb
    .from("portal_thread_messages")
    .select("id, sender, body, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  // Opening a thread clears the member's unread flag.
  if (thread.member_unread) {
    await sb
      .from("portal_threads")
      .update({ member_unread: false })
      .eq("id", threadId);
  }

  return {
    ...mapThread(thread),
    unread: false,
    messages: (messages || []).map((m) => ({
      id: m.id,
      sender: m.sender || "member",
      body: m.body || "",
      createdAt: m.created_at,
    })),
  };
}

// Create a thread + its first message. When orderId is given, the event/project
// are resolved from that order so the organiser sees the context.
export async function createThread({ memberId, email, name = "", subject, body, orderId = null }) {
  const sb = adminClient();
  if (!sb || !memberId || !body?.trim()) return null;

  let eventId = null;
  let projectId = null;
  if (orderId) {
    const { data: order } = await sb
      .from("event_orders")
      .select("id, event_id, project_id, buyer_email")
      .eq("id", orderId)
      .maybeSingle();
    // Only attach an order that actually belongs to this member.
    if (order && String(order.buyer_email || "").toLowerCase() === String(email).toLowerCase()) {
      eventId = order.event_id;
      projectId = order.project_id;
    }
  }

  // No order context → route to the member's most recent order's project so the
  // thread still lands in an organiser's inbox (buyer_email is stored as typed,
  // so match case-insensitively).
  if (!projectId) {
    const { data: recent } = await sb
      .from("event_orders")
      .select("project_id")
      .ilike("buyer_email", email)
      .not("project_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recent?.project_id) projectId = recent.project_id;
  }

  const { data: thread, error } = await sb
    .from("portal_threads")
    .insert({
      member_id: memberId,
      project_id: projectId,
      event_id: eventId,
      order_id: eventId ? orderId : null,
      member_email: String(email || "").toLowerCase(),
      member_name: name || "",
      subject: (subject || "").slice(0, 160) || "Support request",
      status: "open",
      organiser_unread: true,
      last_message_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) {
    console.error("[portal.createThread]", error.message);
    return null;
  }

  await sb.from("portal_thread_messages").insert({
    thread_id: thread.id,
    sender: "member",
    body: body.trim().slice(0, 4000),
  });

  return mapThread(thread, body.trim());
}

export async function postMessage({ memberId, threadId, body }) {
  const sb = adminClient();
  if (!sb || !memberId || !threadId || !body?.trim()) return null;

  // Ownership check before writing.
  const { data: thread } = await sb
    .from("portal_threads")
    .select("id")
    .eq("id", threadId)
    .eq("member_id", memberId)
    .maybeSingle();
  if (!thread) return null;

  const { data: message, error } = await sb
    .from("portal_thread_messages")
    .insert({ thread_id: threadId, sender: "member", body: body.trim().slice(0, 4000) })
    .select("id, sender, body, created_at")
    .single();
  if (error) {
    console.error("[portal.postMessage]", error.message);
    return null;
  }

  await sb
    .from("portal_threads")
    .update({
      last_message_at: new Date().toISOString(),
      status: "open",
      organiser_unread: true,
    })
    .eq("id", threadId);

  return {
    id: message.id,
    sender: message.sender,
    body: message.body,
    createdAt: message.created_at,
  };
}
