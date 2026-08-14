import { adminClient } from "@/lib/supabase/admin";
import { listMemberPushTokens, sendExpoPush } from "@/lib/portal/push";

// Pull-based fan-out of organiser announcements to mobile push. Nothing in the
// organiser UI is modified: scans events.community_records for announcement rows
// not yet pushed (no config.pushedAt), sends to the connected members' registered
// devices, and stamps the record so it is safely re-runnable.

// Inverse of listMemberProjectIds(email) in lib/portal/memberships.js: the member
// ids connected to a set of projects, via their orders and memberships.
async function listMemberIdsForProjects(projectIds) {
  const sb = adminClient();
  if (!sb || !projectIds?.length) return [];
  const [orders, memberships] = await Promise.all([
    sb.from("event_orders").select("buyer_email").in("project_id", projectIds),
    sb
      .from("membership_members")
      .select("email")
      .in("project_id", projectIds)
      .is("deleted_at", null),
  ]);
  const emails = new Set();
  for (const r of orders.data || []) {
    const e = String(r.buyer_email || "").trim().toLowerCase();
    if (e) emails.add(e);
  }
  for (const r of memberships.data || []) {
    const e = String(r.email || "").trim().toLowerCase();
    if (e) emails.add(e);
  }
  if (!emails.size) return [];
  const { data, error } = await sb
    .from("portal_members")
    .select("id")
    .in("email", [...emails]);
  if (error) {
    console.error("[portal.pushFanout.members]", error.message);
    return [];
  }
  return (data || []).map((m) => m.id).filter(Boolean);
}

export async function fanOutPendingAnnouncements({ limit = 20 } = {}) {
  const sb = adminClient();
  if (!sb) return { scanned: 0, pushed: 0 };
  const { data, error } = await sb
    .from("community_records")
    .select("id, name, config, project_id, updated_at")
    .eq("module", "announcement")
    .eq("status", "Sent")
    .is("deleted_at", null)
    // Filter unpushed rows server-side: filtering after the limit would let a
    // backlog of already-pushed rows fill the window and starve new ones.
    .is("config->>pushedAt", null)
    .order("updated_at", { ascending: true })
    .limit(limit);
  if (error) {
    console.error("[portal.pushFanout.scan]", error.message);
    return { scanned: 0, pushed: 0 };
  }

  const pending = (data || []).filter((r) => {
    const cfg = r.config && typeof r.config === "object" ? r.config : {};
    return !cfg.pushedAt;
  });

  let pushed = 0;
  for (const record of pending) {
    const cfg = record.config && typeof record.config === "object" ? record.config : {};
    const memberIds = await listMemberIdsForProjects([record.project_id]);
    const tokens = await listMemberPushTokens(memberIds);
    if (tokens.length) {
      const result = await sendExpoPush(tokens, {
        title: record.name || "Announcement",
        body: cfg.body || "",
        data: { type: "announcement", id: record.id },
      });
      pushed += result.sent;
    }
    // Stamp even when the audience was empty so the row never re-scans.
    await sb
      .from("community_records")
      .update({ config: { ...cfg, pushedAt: new Date().toISOString() } })
      .eq("id", record.id);
  }
  return { scanned: pending.length, pushed };
}
