import { withControl } from "@/lib/control/http";
import { estimateRecipients, segmentName } from "@/lib/control/ops/recipients";
import { OPS_PERMISSIONS, ownedScope } from "@/lib/control/ops/scope";
import { campaignView } from "@/lib/control/ops/views";

// GET — one campaign, who it targets, and how many contacts that is right now.
export async function GET(request, { params }) {
  const { campaignId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await ownedScope(ctx, { table: "campaigns", id: campaignId, permission: OPS_PERMISSIONS.campaigns, notFound: "Campaign not found." });
    const [audience, estimate] = await Promise.all([
      segmentName(scope.db, scope.row.segment_id),
      estimateRecipients(scope.db, scope.projectId, scope.row.segment_id),
    ]);
    return { campaign: campaignView(scope.row), audience, estimate };
  });
}
