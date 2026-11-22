import { buildZoneCards } from "@/lib/checkin/capacity";
import { cardView, occupancyFromRow, overrideView, parseCapacityRule, ruleFromRow } from "@/lib/control/checkin_ops/capacity";
import { withControl } from "@/lib/control/http";
import { CONTROL_CAPABILITIES } from "@/lib/control/profile";
import { eventScope, must, readJson } from "@/lib/control/scope";
import { ApiError } from "@/lib/staff_access/errors";

// Every area's card (venue, the event's zones, and any zone staff scanned into) plus the latest overrides.
async function capacityBoard(db, eventId) {
  const [event, rules, occupancy, overrides] = await Promise.all([
    db.from("events").select("id,name,capacity,zones:metadata->checkinGates->zones").eq("id", eventId).is("deleted_at", null).maybeSingle().then((r) => must(r, "capacity.event")),
    db.from("checkin_capacity").select("*").eq("event_id", eventId).is("deleted_at", null).then((r) => must(r, "capacity.rules")),
    db.from("zone_occupancy").select("*").eq("event_id", eventId).then((r) => must(r, "capacity.occupancy")),
    db
      .from("capacity_overrides")
      .select("*")
      .eq("event_id", eventId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(20)
      .then((r) => must(r, "capacity.overrides")),
  ]);
  if (!event) throw new ApiError("not_found", 404, "Event not found.");
  const cards = buildZoneCards({
    zones: Array.isArray(event.zones) ? event.zones : [],
    rules: rules.map(ruleFromRow),
    occupancy: occupancy.map(occupancyFromRow),
  });
  return {
    event: { id: event.id, name: event.name, capacity: event.capacity ?? null },
    cards: cards.map(cardView),
    overrides: overrides.map(overrideView),
  };
}

export async function GET(request, { params }) {
  const { eventId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await eventScope(ctx, eventId, CONTROL_CAPABILITIES.checkIn);
    return capacityBoard(scope.db, eventId);
  });
}

// POST { zoneKey, zoneName, hardCap, warnPct, reentry } — upserts one area's cap; scanners refuse entry at it.
export async function POST(request, { params }) {
  const { eventId } = await params;
  return withControl(request, async (ctx) => {
    const body = await readJson(request);
    const scope = await eventScope(ctx, eventId, CONTROL_CAPABILITIES.checkIn);
    const rule = parseCapacityRule(body);
    must(
      await scope.db.from("checkin_capacity").upsert({ ...rule, project_id: scope.projectId, event_id: eventId }, { onConflict: "event_id,zone_key" }),
      "capacity.save",
    );
    return capacityBoard(scope.db, eventId);
  });
}
