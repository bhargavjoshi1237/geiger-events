import { generateWebhookSecret } from "@/lib/api_webhooks/crypto";
import {
  ENDPOINT_COLUMNS,
  ManageError,
  UUID,
  must,
  readJson,
  withProjectManager,
} from "@/lib/api_webhooks/server/manage";

// POST { projectId, id, action: "reveal" | "rotate" } → { secret, endpoint? }. Rotation takes effect on the next send.
export async function POST(request) {
  const body = await readJson(request);
  return withProjectManager(request, body.projectId, async ({ db }) => {
    if (!UUID.test(body.id ?? "")) throw new ManageError(400, "invalid_request", "Choose an endpoint.");

    if (body.action === "rotate") {
      const secret = generateWebhookSecret();
      const endpoint = must(
        await db
          .from("webhook_endpoints")
          .update({ secret, secret_rotated_at: new Date().toISOString() })
          .eq("id", body.id)
          .eq("project_id", body.projectId)
          .is("deleted_at", null)
          .select(ENDPOINT_COLUMNS)
          .maybeSingle(),
        "Couldn't rotate the secret. Please try again.",
      );
      if (!endpoint) throw new ManageError(404, "not_found", "That endpoint no longer exists.");
      return { secret, endpoint };
    }

    if (body.action !== "reveal") throw new ManageError(400, "invalid_request", "Unknown action.");
    const row = must(
      await db
        .from("webhook_endpoints")
        .select("secret")
        .eq("id", body.id)
        .eq("project_id", body.projectId)
        .is("deleted_at", null)
        .maybeSingle(),
      "Couldn't load the secret. Please try again.",
    );
    if (!row) throw new ManageError(404, "not_found", "That endpoint no longer exists.");
    return { secret: row.secret };
  });
}
