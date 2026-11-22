import { POST as sendRfpLinks } from "@/app/api/sourcing/rfps/[rfpId]/send/route";
import { withControl } from "@/lib/control/http";
import { readJson } from "@/lib/control/scope";
import { forwardRfpAction } from "@/lib/control/sourcing/forward";
import { rfpScope } from "@/lib/control/sourcing/scope";

// POST { mode: "invite" | "reminder", recipientIds? } — emails venues their private response links through the
// dashboard's own send route, after Control has checked this role may run Sourcing in the RFP's project.
export async function POST(request, { params }) {
  const { rfpId } = await params;
  return withControl(request, async (ctx) => {
    const body = await readJson(request);
    const { rfp } = await rfpScope(ctx, rfpId);
    const mode = body.mode === "reminder" ? "reminder" : "invite";
    const recipientIds = Array.isArray(body.recipientIds) ? body.recipientIds.filter((id) => typeof id === "string") : undefined;
    const data = await forwardRfpAction(sendRfpLinks, request, rfp.id, { mode, recipientIds });
    const results = Array.isArray(data.results) ? data.results : [];
    return {
      mode,
      emailed: results.filter((r) => r.emailed).length,
      attempted: results.length,
      skipped: Array.isArray(data.skipped) ? data.skipped.length : 0,
    };
  });
}
