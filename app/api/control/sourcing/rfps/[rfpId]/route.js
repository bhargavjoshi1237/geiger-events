import { withControl } from "@/lib/control/http";
import { must, readJson } from "@/lib/control/scope";
import { briefNeeds, parseBrief, statusMove } from "@/lib/control/sourcing/rfps";
import { assertProjectEvent, rfpScope } from "@/lib/control/sourcing/scope";
import { validateRfpForSend } from "@/lib/sourcing/rfp_model";
import { normalizeBid, normalizeRecipient, normalizeRfp, rfpToRow } from "@/lib/sourcing/rows";
import { ApiError } from "@/lib/staff_access/errors";

// The RFP with its venues, each venue's current bid, and whether the brief is ready to send.
async function detail(db, rfp) {
  const [recipients, bids, event] = await Promise.all([
    db.from("rfp_recipients").select("*").eq("rfp_id", rfp.id).is("deleted_at", null).order("created_at", { ascending: true }),
    db.from("rfp_bids").select("*").eq("rfp_id", rfp.id).eq("is_current", true).is("deleted_at", null),
    rfp.eventId ? db.from("events").select("id,name").eq("id", rfp.eventId).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]).then((results) => results.map((r, i) => must(r, `sourcing.rfp.${i}`)));
  const bidByRecipient = new Map(bids.map(normalizeBid).map((b) => [b.recipientId, b]));
  return {
    rfp,
    eventName: event?.name || "",
    recipients: recipients.map(normalizeRecipient).map((r) => {
      const bid = bidByRecipient.get(r.id) || null;
      return {
        id: r.id,
        name: r.name,
        contactName: r.contactName,
        email: r.email,
        source: r.source,
        status: r.invitedAt ? r.status : "pending",
        invitedAt: r.invitedAt,
        declineReason: r.declineReason,
        emailStatus: r.emailStatus?.status || "",
        bid: bid
          ? { id: bid.id, total: bid.total, currency: bid.currency, status: bid.status, revision: bid.revision, submittedAt: bid.submittedAt, capacity: bid.capacity, message: bid.message, validUntil: bid.validUntil }
          : null,
      };
    }),
    readiness: validateRfpForSend(rfp, Date.now()),
    hasRequirements: briefNeeds(rfp),
  };
}

export async function GET(request, { params }) {
  const { rfpId } = await params;
  return withControl(request, async (ctx) => {
    const { db, rfp } = await rfpScope(ctx, rfpId);
    return detail(db, rfp);
  });
}

// PATCH { status } moves bidding (close, reopen, cancel); anything else edits the brief, which only a draft allows.
export async function PATCH(request, { params }) {
  const { rfpId } = await params;
  return withControl(request, async (ctx) => {
    const body = await readJson(request);
    const { db, rfp } = await rfpScope(ctx, rfpId);
    let patch;
    if ("status" in body) {
      patch = { status: statusMove(rfp.status, body.status) };
    } else {
      if (rfp.status !== "draft") throw new ApiError("invalid_state", 409, "The brief is locked once it has gone out, so every venue prices the same thing.");
      patch = parseBrief(body);
      if ("eventId" in patch) await assertProjectEvent(db, rfp.projectId, patch.eventId);
    }
    const updated = must(await db.from("rfps").update(rfpToRow(patch)).eq("id", rfp.id).is("deleted_at", null).select("*").maybeSingle(), "sourcing.rfp.update");
    if (!updated) throw new ApiError("not_found", 404, "RFP not found.");
    return detail(db, normalizeRfp(updated));
  });
}

// Soft delete, as on the dashboard; a deleted RFP's venue links stop resolving.
export async function DELETE(request, { params }) {
  const { rfpId } = await params;
  return withControl(request, async (ctx) => {
    const { db, rfp } = await rfpScope(ctx, rfpId);
    must(await db.from("rfps").update({ deleted_at: new Date().toISOString() }).eq("id", rfp.id), "sourcing.rfp.delete");
    return { deleted: true };
  });
}
