import { withControl } from "@/lib/control/http";
import { OPS_PERMISSIONS, ownedScope } from "@/lib/control/ops/scope";
import { parseVenuePatch, spaceView, venueView } from "@/lib/control/ops/views";
import { must, readJson } from "@/lib/control/scope";
import { ApiError } from "@/lib/staff_access/errors";

async function venueDetail(db, venue) {
  const spaces = must(
    await db
      .from("venue_spaces")
      .select("*")
      .eq("venue_id", venue.id)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    "venues.spaces",
  );
  return { venue: venueView(venue), spaces: spaces.map(spaceView) };
}

export async function GET(request, { params }) {
  const { venueId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await ownedScope(ctx, { table: "venues", id: venueId, permission: OPS_PERMISSIONS.venues, notFound: "Venue not found." });
    return venueDetail(scope.db, scope.row);
  });
}

// PATCH — the venue editor's core fields; layouts, maps and contracts stay on the dashboard.
export async function PATCH(request, { params }) {
  const { venueId } = await params;
  return withControl(request, async (ctx) => {
    const patch = parseVenuePatch(await readJson(request));
    const scope = await ownedScope(ctx, { table: "venues", id: venueId, permission: OPS_PERMISSIONS.venues, notFound: "Venue not found." });
    const updated = must(
      await scope.db.from("venues").update(patch).eq("id", venueId).is("deleted_at", null).select("*").maybeSingle(),
      "venues.update",
    );
    if (!updated) throw new ApiError("not_found", 404, "Venue not found.");
    return venueDetail(scope.db, updated);
  });
}
