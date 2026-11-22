import { API_BASE_URL, API_KEY_EXPIRY_OPTIONS, API_SCOPES } from "@/lib/api_webhooks/catalog";
import { withControl } from "@/lib/control/http";
import { must, projectPermissions } from "@/lib/control/scope";
import { TEAM_KEYS, requireAllowed } from "@/lib/control/team/keys";

const KEY_COLUMNS = "id,name,prefix,scopes,last_used_at,expires_at,revoked_at,created_at";
const ENDPOINT_COLUMNS = "id,url,description,event_types,active,failure_streak,last_success_at,last_failure_at,disabled_at,disabled_reason,created_at";

function keyStatus(row) {
  if (row.revoked_at) return "revoked";
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return "expired";
  return "active";
}

// GET — API keys (prefix only; the secret is never stored) and webhook endpoints, plus the choices for a new key.
export async function GET(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const access = await projectPermissions(ctx, projectId, [TEAM_KEYS.view, TEAM_KEYS.manage]);
    requireAllowed(access, TEAM_KEYS.view, "Your role can't see API keys and webhooks.");
    const [keys, endpoints] = await Promise.all([
      access.db.from("api_keys").select(KEY_COLUMNS).eq("project_id", projectId).is("deleted_at", null).order("created_at", { ascending: false }),
      access.db.from("webhook_endpoints").select(ENDPOINT_COLUMNS).eq("project_id", projectId).is("deleted_at", null).order("created_at", { ascending: true }),
    ]);
    return {
      keys: must(keys, "team.apiKeys").map((k) => ({
        id: k.id,
        name: k.name ?? "",
        prefix: k.prefix ?? "",
        scopes: Array.isArray(k.scopes) ? k.scopes : [],
        lastUsedAt: k.last_used_at ?? null,
        expiresAt: k.expires_at ?? null,
        createdAt: k.created_at ?? null,
        status: keyStatus(k),
      })),
      webhooks: must(endpoints, "team.webhooks").map((w) => ({
        id: w.id,
        url: w.url ?? "",
        description: w.description ?? "",
        eventTypes: Array.isArray(w.event_types) ? w.event_types : [],
        active: w.active !== false,
        failureStreak: w.failure_streak ?? 0,
        lastSuccessAt: w.last_success_at ?? null,
        lastFailureAt: w.last_failure_at ?? null,
        disabledReason: w.disabled_reason ?? "",
      })),
      scopes: API_SCOPES.map(({ key, label, description }) => ({ key, label, description })),
      expiries: API_KEY_EXPIRY_OPTIONS.map(({ value, label }) => ({ value, label })),
      baseUrl: API_BASE_URL,
      canManage: access.allowed(TEAM_KEYS.manage),
    };
  });
}
