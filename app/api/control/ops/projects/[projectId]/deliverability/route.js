import { withControl } from "@/lib/control/http";
import { OPS_PERMISSIONS } from "@/lib/control/ops/scope";
import { deliverabilityView } from "@/lib/control/ops/views";
import { must, projectScope } from "@/lib/control/scope";

// GET — the sender identity and domain checks from Campaigns → Deliverability, read-only on the phone.
export async function GET(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await projectScope(ctx, projectId, OPS_PERMISSIONS.campaigns);
    const row = must(
      await scope.db.from("campaign_settings").select("config").eq("project_id", projectId).is("deleted_at", null).maybeSingle(),
      "campaigns.settings",
    );
    return { deliverability: deliverabilityView(row?.config) };
  });
}
