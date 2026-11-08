import { createClient } from "@supabase/supabase-js";

import { adminClient } from "../supabase/admin.js";
import { OperationsError } from "../operations/errors.js";
import { operationsBoundary } from "../operations/server/access.js";

const EVENT_COLUMNS = "id,name,status,event_date,event_time,venue,city,timezone,capacity,sold,cover_url";

// UTC today minus one day, so an event dated "today" in a timezone behind UTC is never cut.
export function eventCutoff(now = new Date()) {
  return new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
}

// Org members, or the creator of an org-less project — never any org-less project.
export function projectsFilter(userId, orgIds) {
  const owned = `and(organization_id.is.null,created_by.eq.${userId})`;
  return orgIds.length ? `organization_id.in.(${orgIds.join(",")}),${owned}` : owned;
}

function requireData(result) {
  if (result.error) throw new OperationsError("service_unavailable", 503, "Control is unavailable.");
  return result.data;
}

// Service-role reads for Control, layered on the operations boundary (rbac config, membership, roles, grants).
export async function controlBoundary() {
  const base = await operationsBoundary();
  const db = adminClient();
  if (!db) throw new OperationsError("service_unavailable", 503, "Control is unavailable.");
  return {
    ...base,
    // Same rule as verifiedProjectMembership: org members, or the creator of an org-less project â€” never any org-less project.
    async listProjects(userId) {
      const links = requireData(await db.schema("public").from("organization_users").select("organization").eq("user", userId));
      const orgIds = [...new Set(links.map((link) => link.organization))];
      const projects = requireData(
        await db
          .schema("public")
          .from("projects")
          .select("id,name,organization_id,created_at")
          .is("deleted_at", null)
          .or(projectsFilter(userId, orgIds))
          .order("created_at", { ascending: true }),
      );
      const orgs = orgIds.length
        ? requireData(await db.schema("public").from("organizations").select("id,name").in("id", orgIds))
        : [];
      const orgName = new Map(orgs.map((org) => [org.id, org.name]));
      return projects.map((p) => ({
        id: p.id,
        name: p.name,
        organizationName: p.organization_id ? orgName.get(p.organization_id) || null : null,
      }));
    },
    // Current/upcoming first (so a large project never hides today), plus a few past events for arrangeEvents.
    async listEvents(projectId, now = new Date()) {
      const cutoff = eventCutoff(now);
      const base = () => db.from("events").select(EVENT_COLUMNS).eq("project_id", projectId).is("deleted_at", null);
      const [current, past] = await Promise.all([
        base().or(`event_date.gte.${cutoff},event_date.is.null`).order("event_date", { ascending: true, nullsFirst: false }).limit(200),
        base().lt("event_date", cutoff).order("event_date", { ascending: false }).limit(11),
      ]);
      return [...requireData(current), ...requireData(past)];
    },
    async loadEventRow(eventId) {
      return requireData(await db.from("events").select(EVENT_COLUMNS).eq("id", eventId).is("deleted_at", null).maybeSingle());
    },
  };
}

// Runs the RPC as the signed-in user so auth.uid() and the function's own access check apply.
export async function ensureMembership(accessToken, projectId) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !accessToken) return null;
  const client = createClient(url, key, {
    db: { schema: "events" },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.rpc("rbac_ensure_membership", { p_project_id: projectId });
  if (error) {
    console.error("[control.ensureMembership]", error.message);
    return null;
  }
  return data ?? null;
}
