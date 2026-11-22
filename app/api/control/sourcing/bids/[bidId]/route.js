import { withControl } from "@/lib/control/http";
import { must, readJson } from "@/lib/control/scope";
import { BID_MOVES } from "@/lib/control/sourcing/rfps";
import { bidScope } from "@/lib/control/sourcing/scope";
import { normalizeBid } from "@/lib/sourcing/rows";
import { ApiError } from "@/lib/staff_access/errors";

// PATCH { status: submitted | shortlisted | rejected } — the dashboard's shortlist and reject; awarding has its own route.
export async function PATCH(request, { params }) {
  const { bidId } = await params;
  return withControl(request, async (ctx) => {
    const { status } = await readJson(request);
    if (!BID_MOVES.includes(status)) throw new ApiError("invalid_input", 400, "That bid status can't be set here.");
    const { db, bid } = await bidScope(ctx, bidId);
    if (bid.status === "awarded") throw new ApiError("invalid_state", 409, "This bid has been awarded.");
    const updated = must(await db.from("rfp_bids").update({ status }).eq("id", bid.id).select("*").single(), "sourcing.bid.status");
    return { bid: normalizeBid(updated) };
  });
}
