import { withControl } from "@/lib/control/http";
import { eventsById } from "@/lib/control/money/queries";
import { parseRequestStatus, refundRequestView } from "@/lib/control/money/views";
import { CONTROL_CAPABILITIES } from "@/lib/control/profile";
import { must, readJson, recordScope } from "@/lib/control/scope";
import { ApiError } from "@/lib/staff_access/errors";

// PATCH { status: Requested | Approved | Denied } — decide a request without moving money, as the dashboard's inbox does.
export async function PATCH(request, { params }) {
  const { id } = await params;
  return withControl(request, async (ctx) => {
    const status = parseRequestStatus(await readJson(request));
    const scope = await recordScope(ctx, {
      table: "refund_requests",
      id,
      columns: "id,event_id,status,deleted_at",
      permission: CONTROL_CAPABILITIES.refund,
      notFound: "Refund request not found.",
    });
    if (scope.row.deleted_at) throw new ApiError("not_found", 404, "Refund request not found.");
    if (scope.row.status === "Refunded") throw new ApiError("invalid_state", 409, "This request has already been refunded.");
    const row = must(await scope.db.from("refund_requests").update({ status }).eq("id", id).select("*").single(), "money.requestStatus");
    const events = await eventsById(scope.db, [row.event_id]);
    return { request: refundRequestView(row, events.get(row.event_id)) };
  });
}
