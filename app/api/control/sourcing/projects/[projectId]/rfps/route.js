import { withControl } from "@/lib/control/http";
import { must, readJson } from "@/lib/control/scope";
import { newRfpRow, rfpRow, rfpStats, rfpSummaries } from "@/lib/control/sourcing/rfps";
import { assertProjectEvent, sourcingProject } from "@/lib/control/sourcing/scope";
import { normalizeBid, normalizeRecipient, normalizeRfp } from "@/lib/sourcing/rows";

const RECIPIENT_COLUMNS = "id, rfp_id, project_id, source, name, email, status, invited_at, created_at";
const BID_COLUMNS = "id, rfp_id, recipient_id, project_id, revision, is_current, total, currency, status, submitted_at";

// GET — every RFP with its response counts and best bid, plus the figures the dashboard's stats bar shows.
export async function GET(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const { db } = await sourcingProject(ctx, projectId);
    const [rfps, recipients, bids, events] = await Promise.all([
      db.from("rfps").select("*").eq("project_id", projectId).is("deleted_at", null).order("created_at", { ascending: false }).limit(500),
      db.from("rfp_recipients").select(RECIPIENT_COLUMNS).eq("project_id", projectId).is("deleted_at", null),
      db.from("rfp_bids").select(BID_COLUMNS).eq("project_id", projectId).eq("is_current", true).is("deleted_at", null),
      db.from("events").select("id,name").eq("project_id", projectId).is("deleted_at", null).order("created_at", { ascending: false }).limit(500),
    ]).then((results) => results.map((r, i) => must(r, `sourcing.rfps.${i}`)));
    const list = rfps.map(normalizeRfp);
    const recs = recipients.map(normalizeRecipient);
    const currentBids = bids.map(normalizeBid);
    const summaries = rfpSummaries(recs, currentBids);
    const eventNames = new Map(events.map((e) => [e.id, e.name]));
    return {
      rfps: list.map((r) => rfpRow(r, summaries[r.id], eventNames.get(r.eventId) || "")),
      stats: rfpStats(list, recs, currentBids, summaries),
      events: events.map((e) => ({ id: e.id, name: e.name || "Untitled event" })),
    };
  });
}

// POST { title, eventId?, startDate?, endDate?, attendees?, location?, … } — a new draft, seeded like the dashboard's.
export async function POST(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const { db } = await sourcingProject(ctx, projectId);
    const body = await readJson(request);
    const { data: auth } = await db.auth.getUser(ctx.token);
    const user = { id: ctx.principal.id, email: auth?.user?.email || "", name: auth?.user?.user_metadata?.full_name || auth?.user?.user_metadata?.name || "" };
    const row = newRfpRow(body, { projectId, user });
    await assertProjectEvent(db, projectId, row.event_id);
    const created = must(await db.from("rfps").insert(row).select("*").single(), "sourcing.rfps.create");
    return { rfp: normalizeRfp(created) };
  });
}
