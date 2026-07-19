"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";
import { normalizeSpec, resolveAudienceEmails } from "@/lib/audience/resolve";

// Organiser-side data layer for members-portal support threads (buyer ↔
// organiser messaging). The only place the dashboard talks to
// events.portal_threads / events.portal_thread_messages. Access is project-
// scoped by RLS (see supabase/sqls/zz_project_access.sql). Pure: validate,
// console.error on failure, return null / false / [] — the screen owns UX. DB is
// snake_case; the UI is camelCase, mapped here. Buyer replies come in via the
// portal's service-role routes (lib/portal/support.js); this side writes
// organiser replies (sender = 'organiser').

const THREADS = "portal_threads";
const MESSAGES = "portal_thread_messages";

export function normalizeThread(row, extra = {}) {
  if (!row) return null;
  return {
    id: row.id,
    subject: row.subject || "Support request",
    status: row.status || "open",
    memberEmail: row.member_email || "",
    memberName: row.member_name || "",
    eventId: row.event_id ?? null,
    orderId: row.order_id ?? null,
    projectId: row.project_id ?? null,
    unread: Boolean(row.organiser_unread),
    lastMessageAt: row.last_message_at ?? null,
    createdAt: row.created_at ?? null,
    // preview / eventName supplied by the caller after enrichment.
    preview: "",
    eventName: "",
    ...extra,
  };
}

export function normalizeMessage(row) {
  if (!row) return null;
  return {
    id: row.id,
    sender: row.sender || "member",
    body: row.body || "",
    createdAt: row.created_at ?? null,
  };
}

// All threads for a project, newest activity first, each enriched with a last-
// message preview and (when order/event-scoped) the event name.
export async function listThreads(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(THREADS)
      .select("*")
      .eq("project_id", projectId)
      .order("last_message_at", { ascending: false });
    if (error) {
      console.error("[messages.list]", error.message);
      return null;
    }
    const threads = data || [];
    const ids = threads.map((t) => t.id);
    const eventIds = [...new Set(threads.map((t) => t.event_id).filter(Boolean))];

    // Latest message per thread for the list preview.
    const previews = {};
    if (ids.length) {
      const { data: msgs } = await sb
        .from(MESSAGES)
        .select("thread_id, body, created_at")
        .in("thread_id", ids)
        .order("created_at", { ascending: false });
      for (const m of msgs || []) {
        if (!(m.thread_id in previews)) previews[m.thread_id] = m.body;
      }
    }

    // Event names (organiser can read their project's events via RLS).
    const eventNames = {};
    if (eventIds.length) {
      const { data: evs } = await sb.from("events").select("id, name").in("id", eventIds);
      for (const e of evs || []) eventNames[e.id] = e.name;
    }

    return threads.map((t) =>
      normalizeThread(t, {
        preview: previews[t.id] || "",
        eventName: t.event_id ? eventNames[t.event_id] || "" : "",
      }),
    );
  } catch (e) {
    console.error("[messages.list]", e);
    return null;
  }
}

// One thread with its full message history. Opening it clears the organiser's
// unread flag.
export async function getThread(threadId) {
  if (!threadId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data: thread, error } = await sb
      .from(THREADS)
      .select("*")
      .eq("id", threadId)
      .maybeSingle();
    if (error) {
      console.error("[messages.get]", error.message);
      return null;
    }
    if (!thread) return null;

    const { data: messages } = await sb
      .from(MESSAGES)
      .select("id, sender, body, created_at")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });

    let eventName = "";
    if (thread.event_id) {
      const { data: ev } = await sb
        .from("events")
        .select("name")
        .eq("id", thread.event_id)
        .maybeSingle();
      eventName = ev?.name || "";
    }

    if (thread.organiser_unread) {
      await sb.from(THREADS).update({ organiser_unread: false }).eq("id", threadId);
    }

    return {
      ...normalizeThread({ ...thread, organiser_unread: false }, { eventName }),
      messages: (messages || []).map(normalizeMessage),
    };
  } catch (e) {
    console.error("[messages.get]", e);
    return null;
  }
}

// Post an organiser reply; bump the thread and flag the member's unread.
export async function replyToThread(threadId, body) {
  if (!threadId || !body?.trim() || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data: message, error } = await sb
      .from(MESSAGES)
      .insert({ thread_id: threadId, sender: "organiser", body: body.trim().slice(0, 4000) })
      .select("id, sender, body, created_at")
      .single();
    if (error) {
      console.error("[messages.reply]", error.message);
      return null;
    }
    await sb
      .from(THREADS)
      .update({
        last_message_at: new Date().toISOString(),
        status: "open",
        member_unread: true,
        organiser_unread: false,
      })
      .eq("id", threadId);
    return normalizeMessage(message);
  } catch (e) {
    console.error("[messages.reply]", e);
    return null;
  }
}

// Broadcast a message to a targeted audience: resolve the spec to buyer emails,
// then start a thread + first organiser message for each (via the broadcast_message
// RPC). Returns the number of buyers reached (0 on no-match / not-configured).
export async function broadcastToAudience({ projectId, spec, subject = "", body } = {}) {
  if (!projectId || !body?.trim() || !isSupabaseConfigured()) return 0;
  try {
    const s = normalizeSpec(spec);
    const { emails } = await resolveAudienceEmails(projectId, s);
    if (!emails.length) return 0;
    const eventId = s.scope === "event" ? s.eventId || null : null;
    const sb = createClient();
    const { data, error } = await sb.rpc("broadcast_message", {
      p_project_id: projectId,
      p_emails: emails,
      p_subject: subject.trim().slice(0, 160),
      p_body: body.trim().slice(0, 4000),
      p_event_id: eventId,
    });
    if (error) {
      console.error("[messages.broadcast]", error.message);
      return 0;
    }
    return Number(data) || 0;
  } catch (e) {
    console.error("[messages.broadcast]", e);
    return 0;
  }
}

// Close or reopen a thread.
export async function setThreadStatus(threadId, status) {
  if (!threadId || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb.from(THREADS).update({ status }).eq("id", threadId);
    if (error) {
      console.error("[messages.status]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[messages.status]", e);
    return false;
  }
}
