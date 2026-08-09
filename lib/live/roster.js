import { adminClient } from "@/lib/supabase/admin";
import { loadMemberGrants } from "@/lib/portal/grants";
import { resolveItemGrant } from "@/lib/live/access";

// Server-only roster for breakout assignment: everyone entitled to the parent
// session's event. Presence is deliberately NOT the source — it only says who is
// watching right now, and rooms have to be filled before anybody arrives.
// Fails closed: any read problem returns [], never a partial roster.

const asObject = (v) => (v && typeof v === "object" ? v : {});

function sessionEventIds(config) {
  const c = asObject(config);
  if (Array.isArray(c.eventIds)) return c.eventIds.filter(Boolean);
  return c.eventId ? [c.eventId] : [];
}

export async function listEntitledMembers(sessionId) {
  if (!sessionId) return [];
  const sb = adminClient();
  if (!sb) return [];

  try {
    // The parent session tells us the project and the event to draw from.
    const { data: session, error } = await sb
      .from("conference_records")
      .select("id, project_id, config")
      .eq("id", sessionId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error || !session) {
      if (error) console.error("[live.roster.session]", error.message);
      return [];
    }

    const eventIds = sessionEventIds(session.config);
    const access = asObject(asObject(session.config).access);

    // Everyone with a live membership in the session's project.
    const { data: rows, error: membersError } = await sb
      .from("membership_members")
      .select("id, email, name, project_id, status")
      .eq("project_id", session.project_id)
      .eq("status", "Active")
      .is("deleted_at", null);
    if (membersError) {
      console.error("[live.roster.members]", membersError.message);
      return [];
    }

    const out = [];
    // One member can hold several plans in a project; resolve each email once.
    const seen = new Set();
    for (const m of rows || []) {
      if (!m.email) continue;
      const key = m.email.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const prepared = await loadMemberGrants(sb, m.email);
      if (!prepared) continue;
      const grant = resolveItemGrant({
        access,
        eventIds,
        projectId: session.project_id,
        grants: prepared.grants,
        planIdsByProject: prepared.planIdsByProject,
        planExpiry: prepared.planExpiry,
        planName: prepared.planName,
        events: prepared.events,
      });
      if (!grant.granted) continue;
      if (grant.expiresAt && new Date(grant.expiresAt).getTime() <= Date.now()) continue;
      out.push({ id: m.id, name: m.name || m.email, email: m.email });
    }
    // Stable order so a re-run of the same roster assigns the same way.
    out.sort((a, b) => a.email.localeCompare(b.email));
    return out;
  } catch (e) {
    console.error("[live.roster]", e);
    return [];
  }
}
