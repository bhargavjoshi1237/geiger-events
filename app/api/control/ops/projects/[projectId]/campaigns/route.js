import { withControl } from "@/lib/control/http";
import { OPS_PERMISSIONS } from "@/lib/control/ops/scope";
import { CAMPAIGN_LENSES, campaignView } from "@/lib/control/ops/views";
import { must, projectScope } from "@/lib/control/scope";
import { ApiError } from "@/lib/staff_access/errors";

// GET ?lens=newsletters|invites|reminders&status= — one of the dashboard's campaign lenses, newest first.
export async function GET(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await projectScope(ctx, projectId, OPS_PERMISSIONS.campaigns);
    const query = new URL(request.url).searchParams;
    const lens = CAMPAIGN_LENSES[query.get("lens")];
    if (!lens) throw new ApiError("invalid_input", 400, "Pick newsletters, invites or reminders.");
    let rows = scope.db.from("campaigns").select("*").eq("project_id", projectId).is("deleted_at", null).eq("type", lens.type);
    if (lens.channel) rows = rows.eq("channel", lens.channel);
    const status = query.get("status");
    if (["draft", "scheduled", "sending", "sent", "paused"].includes(status)) rows = rows.eq("status", status);
    return { campaigns: must(await rows.order("created_at", { ascending: false }).limit(300), "campaigns.list").map(campaignView) };
  });
}
