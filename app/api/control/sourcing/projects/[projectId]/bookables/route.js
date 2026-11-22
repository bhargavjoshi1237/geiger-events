import { withControl } from "@/lib/control/http";
import { must } from "@/lib/control/scope";
import { HOLD_HOURS, spaceFromRow } from "@/lib/control/sourcing/bookings";
import { sourcingProject } from "@/lib/control/sourcing/scope";
import { rateSummary } from "@/lib/venue_booking/pricing";
import { SETUP_STYLES } from "@/lib/venue_booking/styles";

// GET — what can be booked: venues with at least one bookable space, their spaces, and the project's events to link.
export async function GET(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const { db } = await sourcingProject(ctx, projectId);
    const [venues, spaces, events] = await Promise.all([
      db.from("venues").select("id,name,city,timezone").eq("project_id", projectId).is("deleted_at", null).order("name"),
      db.from("venue_spaces").select("*").eq("project_id", projectId).eq("bookable", true).is("deleted_at", null).order("sort_order").order("created_at"),
      db.from("events").select("id,name").eq("project_id", projectId).is("deleted_at", null).order("created_at", { ascending: false }).limit(500),
    ]).then((results) => results.map((r, i) => must(r, `bookables.${i}`)));
    const venueIds = new Set(venues.map((v) => v.id));
    const bookable = spaces.map(spaceFromRow).filter((s) => venueIds.has(s.venueId));
    return {
      venues: venues
        .filter((v) => bookable.some((s) => s.venueId === v.id))
        .map((v) => ({ id: v.id, name: v.name || "Untitled venue", city: v.city || "", timezone: v.timezone || "UTC" })),
      spaces: bookable.map((s) => ({
        id: s.id,
        venueId: s.venueId,
        name: s.name || "Space",
        minHours: s.minHours,
        rates: rateSummary(s),
        capacities: SETUP_STYLES.filter((st) => Number(s.capacities[st.key]) > 0).map((st) => ({ key: st.key, label: st.label, capacity: Number(s.capacities[st.key]) })),
      })),
      events: events.map((e) => ({ id: e.id, name: e.name || "Untitled event" })),
      setupStyles: SETUP_STYLES.map((s) => ({ value: s.key, label: s.label })),
      holdHours: HOLD_HOURS,
    };
  });
}
