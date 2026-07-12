import { adminClient } from "@/lib/supabase/admin";
import { listMemberProjectIds } from "@/lib/portal/memberships";

// Server-only notifications feed for the portal. Rather than a bespoke store, we
// surface the organiser's own "announcement" records (events.community_records,
// module 'announcement', status Sent) for the projects the member is connected
// to — so an attendee receives the updates an organiser already publishes. Read
// state is a single `notificationsSeenAt` timestamp on the member's metadata.

export async function listMemberNotifications(email, seenAt) {
  const sb = adminClient();
  if (!sb || !email) return { items: [], unread: 0 };
  const projectIds = await listMemberProjectIds(email);
  if (!projectIds.length) return { items: [], unread: 0 };

  const { data, error } = await sb
    .from("community_records")
    .select("id, name, status, config, created_at, updated_at")
    .eq("module", "announcement")
    .eq("status", "Sent")
    .in("project_id", projectIds)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) {
    console.error("[portal.notifications]", error.message);
    return { items: [], unread: 0 };
  }

  const seen = seenAt ? new Date(seenAt).getTime() : 0;
  let unread = 0;
  const items = (data || []).map((r) => {
    const cfg = r.config && typeof r.config === "object" ? r.config : {};
    const at = r.updated_at || r.created_at;
    const isUnread = at ? new Date(at).getTime() > seen : false;
    if (isUnread) unread += 1;
    return {
      id: r.id,
      title: r.name || "Announcement",
      body: cfg.body || "",
      channel: cfg.channel || "",
      createdAt: at,
      unread: isUnread,
    };
  });
  return { items, unread };
}
