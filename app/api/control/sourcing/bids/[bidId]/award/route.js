import { POST as sendAwardNotices } from "@/app/api/sourcing/rfps/[rfpId]/notify/route";
import { withControl } from "@/lib/control/http";
import { readJson } from "@/lib/control/scope";
import { forwardRfpAction } from "@/lib/control/sourcing/forward";
import { awardError } from "@/lib/control/sourcing/rfps";
import { bidScope } from "@/lib/control/sourcing/scope";
import { ApiError } from "@/lib/staff_access/errors";

// POST { linkEvent?, notify? } — awards through the atomic rfp_award RPC (adds the venue to the book, links the event),
// then optionally sends the award and regret notices through the dashboard's own notify route.
export async function POST(request, { params }) {
  const { bidId } = await params;
  return withControl(request, async (ctx) => {
    const body = await readJson(request);
    const { db, bid } = await bidScope(ctx, bidId);
    const { data, error } = await db.rpc("rfp_award", { p_bid: bid.id, p_venue: {}, p_link_event: body.linkEvent !== false });
    if (error) {
      console.error("[control.sourcing.award]", error.message);
      throw new ApiError("award_failed", 409, awardError(error.message));
    }
    const result = data && typeof data === "object" ? data : {};
    if (result.ok === false) throw new ApiError("award_failed", 409, result.error || "Couldn't award the bid.");

    let notices = null;
    if (body.notify === true) {
      try {
        const sent = await forwardRfpAction(sendAwardNotices, request, bid.rfpId, { kind: "award" });
        notices = { ok: true, sent: Array.isArray(sent.results) ? sent.results.filter((r) => r.emailed).length : 0 };
      } catch (e) {
        notices = { ok: false, error: e instanceof ApiError ? e.message : "Couldn't send the notices." };
      }
    }
    return {
      awarded: true,
      venueName: result.venueName || "",
      venueCreated: Boolean(result.venueCreated),
      eventLinked: Boolean(result.eventLinked),
      notices,
    };
  });
}
