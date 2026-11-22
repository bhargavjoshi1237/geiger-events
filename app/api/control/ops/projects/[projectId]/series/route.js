import { withControl } from "@/lib/control/http";
import { OPS_PERMISSIONS } from "@/lib/control/ops/scope";
import { seriesView } from "@/lib/control/ops/views";
import { must, projectScope } from "@/lib/control/scope";

// GET — the project's event series with how many events each holds.
export async function GET(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await projectScope(ctx, projectId, OPS_PERMISSIONS.events);
    const [series, members] = await Promise.all([
      scope.db.from("event_series").select("*").eq("project_id", projectId).is("deleted_at", null).order("created_at", { ascending: false }),
      scope.db.from("events").select("series_id").eq("project_id", projectId).is("deleted_at", null).not("series_id", "is", null).limit(5000),
    ]);
    const counts = new Map();
    for (const row of must(members, "series.members")) counts.set(row.series_id, (counts.get(row.series_id) || 0) + 1);
    return { series: must(series, "series.list").map((row) => seriesView(row, counts.get(row.id) || 0)) };
  });
}
