import { withControl } from "@/lib/control/http";
import { estimateRecipients, segmentName } from "@/lib/control/ops/recipients";
import { OPS_PERMISSIONS, ownedScope } from "@/lib/control/ops/scope";
import { campaignTransition, campaignView } from "@/lib/control/ops/views";
import { must, readJson } from "@/lib/control/scope";
import { ApiError } from "@/lib/staff_access/errors";

// POST { action: send | schedule | unschedule | draft, scheduledAt? } — the campaign editor's buttons, recorded the same way.
export async function POST(request, { params }) {
  const { campaignId } = await params;
  return withControl(request, async (ctx) => {
    const body = await readJson(request);
    const scope = await ownedScope(ctx, { table: "campaigns", id: campaignId, permission: OPS_PERMISSIONS.campaigns, notFound: "Campaign not found." });
    const recipients = body.action === "send" ? await estimateRecipients(scope.db, scope.projectId, scope.row.segment_id) : 0;
    const patch = campaignTransition(scope.row, body.action, { scheduledAt: body.scheduledAt, recipients });
    const updated = must(
      await scope.db.from("campaigns").update(patch).eq("id", campaignId).is("deleted_at", null).select("*").maybeSingle(),
      "campaigns.status",
    );
    if (!updated) throw new ApiError("not_found", 404, "Campaign not found.");
    return {
      campaign: campaignView(updated),
      audience: await segmentName(scope.db, updated.segment_id),
      estimate: recipients || (await estimateRecipients(scope.db, scope.projectId, updated.segment_id)),
    };
  });
}
