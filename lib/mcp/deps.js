import { createClient } from "@supabase/supabase-js";
import { adminClient } from "../supabase/admin.js";
import { authorizeEventAction, authorizeProjectAction } from "../operations/server/access.js";
import { MCP_RATE_LIMIT_PER_MINUTE } from "./config.js";

// A client acting as the user, so database rules apply to everything a tool reads or writes.
export function userClient(token, schema = "events") {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    db: { schema },
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function requireAdmin() {
  const admin = adminClient();
  if (!admin) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  return admin.schema("public");
}

async function loadConnection(token, userId, clientId) {
  const { data, error } = await userClient(token, "public")
    .from("mcp_connections")
    .select("id,project_ids,access")
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(`loadConnection: ${error.message}`);
  if (!data) return null;
  return { id: data.id, projectIds: data.project_ids || [], access: data.access };
}

async function isRateLimited(userId, clientId) {
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count, error } = await requireAdmin()
    .from("mcp_audit_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .gte("created_at", since);
  if (error) throw new Error(`isRateLimited: ${error.message}`);
  return (count || 0) >= MCP_RATE_LIMIT_PER_MINUTE;
}

async function writeAudit(entry) {
  const { error } = await requireAdmin().from("mcp_audit_log").insert(entry);
  if (error) throw new Error(`writeAudit: ${error.message}`);
}

// Issues the user's saved role the way a first visit to Events does.
async function ensureMembership(db, projectId) {
  const { error } = await db.rpc("rbac_ensure_membership", { p_project_id: projectId, p_default_role: null });
  if (error) console.error("[mcp.ensureMembership]", error.message);
}

export const defaultDeps = {
  userClient,
  loadConnection,
  isRateLimited,
  writeAudit,
  ensureMembership,
  authorizeEvent: authorizeEventAction,
  authorizeProject: authorizeProjectAction,
};
