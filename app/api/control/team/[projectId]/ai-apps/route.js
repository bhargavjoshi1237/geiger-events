import { randomUUID } from "node:crypto";

import { validateCallbackUrl } from "@/lib/mcp/app_catalog";
import { MCP_RESOURCE_URL } from "@/lib/mcp/config";
import { requireId, withControl } from "@/lib/control/http";
import { must, projectPermissions, readJson } from "@/lib/control/scope";
import { TEAM_KEYS, requireAllowed } from "@/lib/control/team/keys";
import { ApiError } from "@/lib/staff_access/errors";

// AI apps are per person: the custom MCP clients this user added, plus the server address any app connects to.

const COLUMNS = "id,name,redirect_uri,created_at";

const view = (row) => ({ id: row.id, name: row.name ?? "", redirectUri: row.redirect_uri ?? "", createdAt: row.created_at ?? null });

async function access(ctx, projectId) {
  const scope = await projectPermissions(ctx, projectId, [TEAM_KEYS.view]);
  requireAllowed(scope, TEAM_KEYS.view, "Your role can't open AI apps.");
  return scope.db.schema("public").from("mcp_custom_clients");
}

export async function GET(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const table = await access(ctx, projectId);
    const rows = must(await table.select(COLUMNS).eq("user_id", ctx.principal.id).is("deleted_at", null).order("created_at", { ascending: false }), "team.aiApps");
    return { serverUrl: MCP_RESOURCE_URL, apps: rows.map(view) };
  });
}

// POST { name, redirectUri? } — its id is the client id the AI app asks for.
export async function POST(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const body = await readJson(request);
    const name = String(body.name ?? "").trim().slice(0, 80);
    if (!name) throw new ApiError("invalid_input", 400, "Name the app.");
    const callback = validateCallbackUrl(body.redirectUri);
    if (!callback.ok) throw new ApiError("invalid_input", 400, callback.error);
    const table = await access(ctx, projectId);
    const row = must(
      await table
        .insert({ id: randomUUID(), user_id: ctx.principal.id, created_by: ctx.principal.id, name, redirect_uri: callback.value || null })
        .select(COLUMNS)
        .single(),
      "team.aiAppAdd",
    );
    return { app: view(row) };
  });
}

// DELETE { id } — the app can no longer sign in with this client id.
export async function DELETE(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const { id } = await readJson(request);
    requireId(id);
    const table = await access(ctx, projectId);
    const removed = must(
      await table.update({ deleted_at: new Date().toISOString() }).eq("id", id).eq("user_id", ctx.principal.id).is("deleted_at", null).select("id").maybeSingle(),
      "team.aiAppRemove",
    );
    if (!removed) throw new ApiError("not_found", 404, "That app was already removed.");
    return { removed: true };
  });
}
