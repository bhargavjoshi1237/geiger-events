import { arrangeEvents, toControlEvent } from "@/lib/control/events";
import { withControl } from "@/lib/control/http";
import { EVENT_COLUMNS, OPS_PERMISSIONS, ownedScope } from "@/lib/control/ops/scope";
import { seriesView } from "@/lib/control/ops/views";
import { must } from "@/lib/control/scope";

// GET — one series, its events in date order, and the project's other events that could join it.
export async function GET(request, { params }) {
  const { seriesId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await ownedScope(ctx, {
      table: "event_series",
      id: seriesId,
      permission: OPS_PERMISSIONS.events,
      notFound: "Series not found.",
    });
    const events = must(
      await scope.db
        .from("events")
        .select(EVENT_COLUMNS)
        .eq("project_id", scope.projectId)
        .is("deleted_at", null)
        .order("event_date", { ascending: true, nullsFirst: false })
        .limit(500),
      "series.events",
    );
    const now = new Date();
    const members = events.filter((e) => e.series_id === seriesId);
    return {
      series: seriesView(scope.row, members.length),
      events: members.map((row) => toControlEvent(row, now)),
      // Only events not already in another series, so adding never silently moves one.
      candidates: arrangeEvents(events.filter((e) => !e.series_id), now),
    };
  });
}
