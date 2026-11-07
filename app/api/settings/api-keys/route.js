import { API_KEY_EXPIRY_OPTIONS, normalizeScopes } from "@/lib/api_webhooks/catalog";
import { generateApiKey } from "@/lib/api_webhooks/crypto";
import {
  KEY_COLUMNS,
  ManageError,
  UUID,
  must,
  readJson,
  withProjectManager,
} from "@/lib/api_webhooks/server/manage";

const MAX_ACTIVE_KEYS = 25;

// POST { projectId, name, scopes, expiry } → { key, secret }. The secret is returned this once and never stored.
export async function POST(request) {
  const body = await readJson(request);
  return withProjectManager(request, body.projectId, async ({ db, userId }) => {
    const name = String(body.name || "").trim().slice(0, 80);
    if (!name) throw new ManageError(400, "invalid_request", "Name the key so you can tell it apart later.");
    const scopes = normalizeScopes(body.scopes);
    if (!scopes.length) throw new ManageError(400, "invalid_request", "Choose at least one permission.");
    const expiry = API_KEY_EXPIRY_OPTIONS.find((option) => option.value === String(body.expiry || "never"));
    if (!expiry) throw new ManageError(400, "invalid_request", "Choose when the key expires.");

    const { count } = await db
      .from("api_keys")
      .select("id", { count: "exact", head: true })
      .eq("project_id", body.projectId)
      .is("revoked_at", null)
      .is("deleted_at", null);
    if ((count || 0) >= MAX_ACTIVE_KEYS) {
      throw new ManageError(409, "limit_reached", `A project can have ${MAX_ACTIVE_KEYS} active keys. Revoke one first.`);
    }

    const { secret, prefix, hash } = generateApiKey();
    const key = must(
      await db
        .from("api_keys")
        .insert({
          project_id: body.projectId,
          name,
          prefix,
          key_hash: hash,
          scopes,
          expires_at: expiry.days ? new Date(Date.now() + expiry.days * 86_400_000).toISOString() : null,
          created_by: userId,
        })
        .select(KEY_COLUMNS)
        .single(),
      "Couldn't create the key. Please try again.",
    );
    return { key, secret };
  });
}

// DELETE { projectId, id } → { key }. Revoking is permanent; the row stays for the audit trail.
export async function DELETE(request) {
  const body = await readJson(request);
  return withProjectManager(request, body.projectId, async ({ db, userId }) => {
    if (!UUID.test(body.id ?? "")) throw new ManageError(400, "invalid_request", "Choose a key to revoke.");
    const key = must(
      await db
        .from("api_keys")
        .update({ revoked_at: new Date().toISOString(), revoked_by: userId })
        .eq("id", body.id)
        .eq("project_id", body.projectId)
        .is("revoked_at", null)
        .is("deleted_at", null)
        .select(KEY_COLUMNS)
        .maybeSingle(),
      "Couldn't revoke the key. Please try again.",
    );
    if (!key) throw new ManageError(404, "not_found", "That key was already revoked.");
    return { key };
  });
}
