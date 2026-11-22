import { randomUUID } from "node:crypto";

import { mergeTickets, ticketView } from "@/lib/control/event_fields";
import { withControl } from "@/lib/control/http";
import { CONTROL_CAPABILITIES } from "@/lib/control/profile";
import { eventScope, must, readJson } from "@/lib/control/scope";
import { ApiError } from "@/lib/staff_access/errors";

async function currentTickets(db, eventId) {
  const row = must(
    await db.from("events").select("tickets:metadata->tickets").eq("id", eventId).is("deleted_at", null).maybeSingle(),
    "tickets.load",
  );
  if (!row) throw new ApiError("not_found", 404, "Event not found.");
  return Array.isArray(row.tickets) ? row.tickets : [];
}

export async function GET(request, { params }) {
  const { eventId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await eventScope(ctx, eventId, CONTROL_CAPABILITIES.events);
    return { tickets: (await currentTickets(scope.db, eventId)).map(ticketView) };
  });
}

// PUT { tickets: [{ id?, name, price, qty, description }] } — the app's full list, in order.
export async function PUT(request, { params }) {
  const { eventId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await eventScope(ctx, eventId, CONTROL_CAPABILITIES.edit);
    const body = await readJson(request);
    const next = mergeTickets(await currentTickets(scope.db, eventId), body.tickets, randomUUID);
    must(await scope.db.rpc("event_merge_meta", { p_id: eventId, p_patch: { tickets: next } }), "tickets.save");
    return { tickets: next.map(ticketView) };
  });
}
