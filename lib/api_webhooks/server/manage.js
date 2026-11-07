import { authorizeProjectAction } from "@/lib/operations/server/access";
import { resolveStaffPrincipal } from "@/lib/operations/server/staff_identity";
import { adminClient } from "@/lib/supabase/admin";

// Guard for the dashboard's API & Webhooks routes: a signed-in member with "Manage settings" on the project.

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const MANAGE_PERMISSION = "events.settings.manage";

export const KEY_COLUMNS =
  "id,project_id,name,prefix,scopes,last_used_at,last_used_ip,expires_at,revoked_at,created_by,created_at";

export const ENDPOINT_COLUMNS =
  "id,project_id,url,description,secret_rotated_at,event_types,active,failure_streak,last_delivery_at," +
  "last_success_at,last_failure_at,disabled_at,disabled_reason,created_by,created_at,updated_at";

export class ManageError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function readJson(request) {
  return request.json().catch(() => ({}));
}

const FRIENDLY = {
  401: "Sign in to continue.",
  403: "You need the Manage settings permission to change API keys and webhooks.",
  404: "That project wasn't found.",
};

export async function withProjectManager(request, projectId, work) {
  try {
    if (!UUID.test(projectId ?? "")) throw new ManageError(400, "invalid_request", "Open a project first.");
    const principal = await resolveStaffPrincipal(request);
    await authorizeProjectAction(principal, projectId, MANAGE_PERMISSION);
    const db = adminClient();
    if (!db) {
      throw new ManageError(503, "unavailable", "API & Webhooks needs SUPABASE_SERVICE_ROLE_KEY on the server.");
    }
    const result = await work({ db, userId: principal.id });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error("[settings.api_webhooks]", error);
    const message =
      error instanceof ManageError
        ? error.message
        : FRIENDLY[status] || (status >= 500 ? "Something went wrong. Please try again." : error?.message);
    return Response.json(
      { error: { code: error?.code || "internal_error", message } },
      { status: Math.min(Math.max(status, 400), 599), headers: { "Cache-Control": "no-store" } },
    );
  }
}

// Throws a ManageError for a failed store call so the route answers with a clean message.
export function must(result, message) {
  if (result.error) {
    console.error("[settings.api_webhooks.store]", result.error.message);
    throw new ManageError(500, "store_error", message);
  }
  return result.data;
}
