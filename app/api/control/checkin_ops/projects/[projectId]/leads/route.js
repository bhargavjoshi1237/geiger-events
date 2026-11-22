import { leadView } from "@/lib/control/checkin_ops/views";
import { withControl } from "@/lib/control/http";
import { CONTROL_CAPABILITIES } from "@/lib/control/profile";
import { searchTerm } from "@/lib/control/records";
import { must, projectScope } from "@/lib/control/scope";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET ?eventId=&q= — contacts exhibitors captured by scanning badges, newest first.
export async function GET(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await projectScope(ctx, projectId, CONTROL_CAPABILITIES.checkIn);
    const query = new URL(request.url).searchParams;
    let list = scope.db.from("checkin_leads").select("*").eq("project_id", projectId).is("deleted_at", null);
    const eventId = query.get("eventId");
    if (eventId && UUID.test(eventId)) list = list.eq("event_id", eventId);
    const term = searchTerm(query.get("q"));
    if (term) list = list.or(`attendee_name.ilike.%${term}%,exhibitor.ilike.%${term}%`);
    const rows = must(await list.order("captured_at", { ascending: false }).limit(300), "leads.list");

    const eventIds = [...new Set(rows.map((r) => r.event_id).filter(Boolean))];
    const names = new Map();
    if (eventIds.length) {
      for (const e of must(await scope.db.from("events").select("id,name").in("id", eventIds), "leads.events")) names.set(e.id, e.name);
    }
    const leads = rows.map((r) => leadView(r, names.get(r.event_id) || ""));
    return { leads, exhibitors: [...new Set(leads.map((l) => l.exhibitor).filter(Boolean))].length };
  });
}
