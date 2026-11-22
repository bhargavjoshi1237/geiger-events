import { userDb } from "@/lib/control/boundary";
import { badgeView, parseBadgeStatus } from "@/lib/control/checkin_ops/views";
import { requireId, withControl } from "@/lib/control/http";
import { CONTROL_CAPABILITIES } from "@/lib/control/profile";
import { eventScope, must, readJson } from "@/lib/control/scope";
import { ApiError } from "@/lib/staff_access/errors";

const COLUMNS = "id,event_id,serial,label,nfc_uid,status,active,metadata,notes,issued_at,created_at";

// POST { status: "active" | "lost" | "revoked", reason? } — through the same RPC as the dashboard's badge drawer, which logs the history.
export async function POST(request, { params }) {
  const { badgeId } = await params;
  return withControl(request, async (ctx) => {
    requireId(badgeId);
    const body = await readJson(request);
    const row = must(await userDb(ctx.token).from("nfc_credentials").select(COLUMNS).eq("id", badgeId).is("deleted_at", null).maybeSingle(), "badge.load");
    if (!row?.event_id) throw new ApiError("not_found", 404, "Badge not found.");
    const scope = await eventScope(ctx, row.event_id, CONTROL_CAPABILITIES.checkIn);
    const { status, reason } = parseBadgeStatus(body, badgeView(row).status);
    const result = must(await scope.db.rpc("smart_badge_set_status", { p_badge: badgeId, p_status: status, p_reason: reason }), "badge.status");
    if (!result?.ok) throw new ApiError("invalid_state", 409, "That badge can't change status right now.");
    const updated = must(await scope.db.from("nfc_credentials").select(COLUMNS).eq("id", badgeId).single(), "badge.reload");
    return { badge: badgeView(updated) };
  });
}
