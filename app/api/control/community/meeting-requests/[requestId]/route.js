import { meetingRequestScope } from "@/lib/control/community/scope";
import { withControl } from "@/lib/control/http";
import { must } from "@/lib/control/scope";
import { ApiError } from "@/lib/staff_access/errors";

// DELETE — the organiser withdraws a pending request, as the dashboard's cancel does; an answered one can't be.
export async function DELETE(request, { params }) {
  const { requestId } = await params;
  return withControl(request, async (ctx) => {
    const { db } = await meetingRequestScope(ctx, requestId);
    const row = must(
      await db
        .from("meeting_requests")
        .update({ status: "cancelled", cancelled_by: "organiser", responded_at: new Date().toISOString() })
        .eq("id", requestId)
        .eq("status", "pending")
        .select("id,status")
        .maybeSingle(),
      "community.cancelRequest",
    );
    if (!row) throw new ApiError("invalid_state", 409, "This request was already answered.");
    return { status: row.status };
  });
}
