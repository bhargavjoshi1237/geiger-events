import { arrangeEvents } from "@/lib/control/events";
import { withControl } from "@/lib/control/http";
import { CONTROL_CAPABILITIES } from "@/lib/control/profile";
import { loadDoorCounts } from "@/lib/control/queries";
import { must, projectScope } from "@/lib/control/scope";

const UPCOMING = 3;

// GET — live door numbers across today's events (and the next few), plus the latest admissions project-wide.
export async function GET(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await projectScope(ctx, projectId, CONTROL_CAPABILITIES.checkIn);
    const now = new Date();
    const arranged = arrangeEvents(await scope.boundary.listEvents(projectId, now), now);
    const today = arranged.filter((e) => e.when === "today");
    const next = arranged.filter((e) => e.when === "upcoming").slice(0, UPCOMING);
    const watched = [...today, ...next];

    const [counts, recent] = await Promise.all([
      Promise.all(watched.map((e) => loadDoorCounts(scope.db, e.id))),
      scope.db
        .from("checkin_attendance")
        .select("id,event_id,attendee_name,ticket_code,gate,zone,method,checked_in_by,checked_in_at")
        .eq("project_id", projectId)
        .eq("status", "in")
        .is("deleted_at", null)
        .order("checked_in_at", { ascending: false })
        .limit(20)
        .then((r) => must(r, "attendance.recent")),
    ]);
    const names = new Map(arranged.map((e) => [e.id, e.name]));
    const missing = [...new Set(recent.map((r) => r.event_id).filter((id) => id && !names.has(id)))];
    if (missing.length) {
      for (const e of must(await scope.db.from("events").select("id,name").in("id", missing), "attendance.events")) names.set(e.id, e.name);
    }

    const events = watched.map((e, i) => ({
      id: e.id,
      name: e.name,
      when: e.when,
      date: e.date,
      time: e.time,
      venue: e.venue,
      admitted: counts[i].admitted,
      expected: counts[i].expected,
    }));
    return {
      events,
      totals: {
        admitted: events.filter((e) => e.when === "today").reduce((s, e) => s + e.admitted, 0),
        expected: events.filter((e) => e.when === "today").reduce((s, e) => s + e.expected, 0),
      },
      recent: recent.map((r) => ({
        id: r.id,
        eventId: r.event_id,
        eventName: names.get(r.event_id) || "",
        name: r.attendee_name || "Guest",
        code: r.ticket_code || "",
        area: [r.gate, r.zone].filter(Boolean).join(" · "),
        method: r.method || "manual",
        by: r.checked_in_by || "",
        at: r.checked_in_at,
      })),
    };
  });
}
