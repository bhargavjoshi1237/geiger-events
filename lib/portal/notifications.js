import { adminClient } from "@/lib/supabase/admin";
import { listMemberProjectIds } from "@/lib/portal/memberships";
import { listMeetingNotifications } from "@/lib/portal/meetings";
import { listBoardNotificationsForEmail } from "@/lib/portal/boards";
import { pushDb } from "@/lib/push/server/store";

// Push history rows that belong in the feed: delivered, or rendered but held back by the member's mute / no device.
// Announcements and meetings come from their own sources below, so their push rows are left out.
async function listPushHistory(memberId, seen) {
  const db = pushDb();
  if (!db || !memberId) return [];
  const { data, error } = await db
    .from("notifications")
    .select("id, type, title, body, data, status, skip_reason, sent_at, updated_at, created_at")
    .eq("member_id", memberId)
    .or("status.eq.sent,and(status.eq.skipped,skip_reason.in.(muted,no_device))")
    .not("type", "in", "(announcement,meeting_request,meeting_declined,meeting_confirmed,meeting_cancelled,meeting_rescheduled)")
    .not("title", "is", null)
    .gt("created_at", new Date(Date.now() - 60 * 864e5).toISOString())
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    console.error("[portal.notifications.push]", error.message);
    return [];
  }
  return (data || []).map((n) => {
    const at = n.sent_at || n.updated_at || n.created_at;
    const route = typeof n.data?.route === "string" ? n.data.route : null;
    return {
      id: `push-${n.id}`,
      kind: n.type,
      title: n.title,
      body: n.body || "",
      channel: "",
      route,
      createdAt: at,
      unread: at ? new Date(at).getTime() > seen : false,
    };
  });
}

export async function listMemberNotifications(email, seenAt, memberId = null) {
  const sb = adminClient();
  if (!sb || !email) return { items: [], unread: 0 };
  const seen = seenAt ? new Date(seenAt).getTime() : 0;
  const projectIds = await listMemberProjectIds(email);

  let items = [];
  if (projectIds.length) {
    const { data, error } = await sb
      .from("community_records")
      .select("id, name, status, config, created_at, updated_at")
      .eq("module", "announcement")
      .eq("status", "Sent")
      .in("project_id", projectIds)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) console.error("[portal.notifications]", error.message);
    items = (data || []).map((r) => {
      const cfg = r.config && typeof r.config === "object" ? r.config : {};
      const at = r.updated_at || r.created_at;
      return {
        id: r.id,
        kind: "announcement",
        title: r.name || "Announcement",
        body: cfg.body || "",
        channel: cfg.channel || "",
        route: null,
        createdAt: at,
        unread: at ? new Date(at).getTime() > seen : false,
      };
    });
  }

  // Meeting requests and changes, discussion replies and push history join the feed, newest first.
  const [meetings, boardItems, pushItems] = await Promise.all([
    projectIds.length ? listMeetingNotifications(email, seenAt) : { items: [], unread: 0 },
    projectIds.length ? listBoardNotificationsForEmail(email, seenAt) : [],
    listPushHistory(memberId, seen),
  ]);
  const extra = [
    ...meetings.items.map((n) => ({ ...n, kind: n.kind || "meeting", route: n.route ?? null })),
    ...boardItems.map((n) => ({ ...n, kind: n.kind || "board", route: n.route ?? null })),
    ...pushItems,
  ];
  const all = [...items, ...extra].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return { items: all, unread: all.filter((n) => n.unread).length };
}
