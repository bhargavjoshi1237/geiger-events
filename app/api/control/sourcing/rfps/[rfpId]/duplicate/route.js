import { withControl } from "@/lib/control/http";
import { must } from "@/lib/control/scope";
import { COPY_KEYS } from "@/lib/control/sourcing/rfps";
import { rfpScope } from "@/lib/control/sourcing/scope";
import { defaultDecisionDate, defaultDeadline } from "@/lib/sourcing/drafting";
import { normalizeRfp, rfpToRow } from "@/lib/sourcing/rows";

// POST — a new draft with the same brief and a fresh deadline; recipients and bids aren't copied, as on the dashboard.
export async function POST(request, { params }) {
  const { rfpId } = await params;
  return withControl(request, async (ctx) => {
    const { db, rfp } = await rfpScope(ctx, rfpId);
    const responseDeadline = defaultDeadline(Date.now());
    const copy = Object.fromEntries(COPY_KEYS.map((k) => [k, rfp[k]]));
    const row = rfpToRow({
      ...copy,
      title: `${rfp.title || "Untitled RFP"} (copy)`,
      responseDeadline,
      decisionDate: defaultDecisionDate(responseDeadline),
      status: "draft",
      projectId: rfp.projectId,
      createdBy: ctx.principal.id,
    });
    const created = must(await db.from("rfps").insert(row).select("*").single(), "sourcing.rfp.duplicate");
    return { rfp: normalizeRfp(created) };
  });
}
