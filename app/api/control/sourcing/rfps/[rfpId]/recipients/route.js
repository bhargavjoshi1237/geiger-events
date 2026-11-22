import { withControl } from "@/lib/control/http";
import { must, readJson } from "@/lib/control/scope";
import { parseRecipient } from "@/lib/control/sourcing/rfps";
import { rfpScope } from "@/lib/control/sourcing/scope";
import { normalizeRecipient, recipientToRow } from "@/lib/sourcing/rows";
import { ApiError } from "@/lib/staff_access/errors";

// POST { name, contactName?, email? } — a venue added by hand; it isn't emailed until the RFP's links are sent.
export async function POST(request, { params }) {
  const { rfpId } = await params;
  return withControl(request, async (ctx) => {
    const body = await readJson(request);
    const { db, rfp } = await rfpScope(ctx, rfpId);
    if (["awarded", "cancelled"].includes(rfp.status)) throw new ApiError("invalid_state", 409, "This RFP is finished, so venues can't be added.");
    const input = parseRecipient(body);
    const row = { ...recipientToRow({ ...input, rfpId: rfp.id, projectId: rfp.projectId, createdBy: ctx.principal.id }), status: "invited" };
    const created = must(await db.from("rfp_recipients").insert(row).select("*").single(), "sourcing.recipient.add");
    return { recipient: normalizeRecipient(created) };
  });
}
