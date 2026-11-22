import { withControl } from "@/lib/control/http";
import { OPS_PERMISSIONS } from "@/lib/control/ops/scope";
import { venueView } from "@/lib/control/ops/views";
import { searchTerm } from "@/lib/control/records";
import { must, projectScope } from "@/lib/control/scope";

// GET ?q= — the project's venue book, newest first, searchable by name and city.
export async function GET(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await projectScope(ctx, projectId, OPS_PERMISSIONS.venues);
    let query = scope.db.from("venues").select("*").eq("project_id", projectId).is("deleted_at", null);
    const term = searchTerm(new URL(request.url).searchParams.get("q"));
    if (term) query = query.or(`name.ilike.%${term}%,city.ilike.%${term}%`);
    const rows = must(await query.order("created_at", { ascending: false }).limit(300), "venues.list");
    return { venues: rows.map(venueView) };
  });
}
