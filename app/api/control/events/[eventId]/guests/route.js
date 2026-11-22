import { withControl } from "@/lib/control/http";
import { CONTROL_CAPABILITIES } from "@/lib/control/profile";
import {
  REGISTRATION_COLUMNS,
  REGISTRATION_STATUSES,
  parseGuest,
  registrationView,
  searchTerm,
} from "@/lib/control/records";
import { eventScope, must, readJson } from "@/lib/control/scope";

const PAGE = 100;

const doorAttendance = (db, eventId) =>
  db
    .from("checkin_attendance")
    .select("registration_id,checked_in_at")
    .eq("event_id", eventId)
    .eq("status", "in")
    .is("session_id", null)
    .is("deleted_at", null)
    .not("registration_id", "is", null);

// GET ?status=<registration status>|in&q=&offset= — the guest list, marking who is inside right now.
export async function GET(request, { params }) {
  const { eventId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await eventScope(ctx, eventId, CONTROL_CAPABILITIES.guests);
    const query = new URL(request.url).searchParams;
    const status = query.get("status");
    const offset = Math.max(0, Math.min(100000, Number(query.get("offset")) || 0));
    const term = searchTerm(query.get("q"));

    // "Inside" pages the attendance ledger (latest first), then reads just those guests; a search narrows the ledger first.
    if (status === "in") {
      let ledger = doorAttendance(scope.db, eventId);
      if (term) {
        const matches = must(
          await scope.db
            .from("registrations")
            .select("id")
            .eq("event_id", eventId)
            .is("deleted_at", null)
            .or(`name.ilike.%${term}%,email.ilike.%${term}%`)
            .limit(PAGE),
          "guests.insideSearch",
        ).map((r) => r.id);
        if (!matches.length) return { guests: [], nextOffset: null };
        ledger = ledger.in("registration_id", matches);
      }
      const entries = must(
        await ledger.order("checked_in_at", { ascending: false }).order("id").range(offset, offset + PAGE - 1),
        "guests.inside",
      );
      const ids = entries.map((e) => e.registration_id);
      const rows = ids.length
        ? must(await scope.db.from("registrations").select(REGISTRATION_COLUMNS).in("id", ids).is("deleted_at", null), "guests.insideRows")
        : [];
      const byId = new Map(rows.map((r) => [r.id, r]));
      return {
        guests: ids.map((id) => byId.get(id)).filter(Boolean).map((r) => registrationView(r, true)),
        nextOffset: entries.length === PAGE ? offset + PAGE : null,
      };
    }

    let list = scope.db.from("registrations").select(REGISTRATION_COLUMNS).eq("event_id", eventId).is("deleted_at", null);
    if (REGISTRATION_STATUSES.includes(status)) list = list.eq("status", status);
    if (term) list = list.or(`name.ilike.%${term}%,email.ilike.%${term}%`);
    const rows = must(await list.order("name", { ascending: true }).order("id").range(offset, offset + PAGE - 1), "guests.list");

    const ids = rows.map((r) => r.id);
    const inside = new Set(
      ids.length
        ? must(await doorAttendance(scope.db, eventId).in("registration_id", ids), "guests.insideFlags").map((e) => e.registration_id)
        : [],
    );
    return {
      guests: rows.map((r) => registrationView(r, inside.has(r.id))),
      nextOffset: rows.length === PAGE ? offset + PAGE : null,
    };
  });
}

// POST { name, email?, phone?, partySize? } — a guest added at the desk or by the organiser, confirmed straight away.
export async function POST(request, { params }) {
  const { eventId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await eventScope(ctx, eventId, CONTROL_CAPABILITIES.edit);
    const guest = parseGuest(await readJson(request));
    const row = must(
      await scope.db
        .from("registrations")
        .insert({
          event_id: eventId,
          project_id: scope.projectId,
          name: guest.name,
          email: guest.email,
          phone: guest.phone || null,
          party_size: guest.partySize,
          status: "Confirmed",
          source: "Manual",
          created_by: ctx.principal.id,
        })
        .select(REGISTRATION_COLUMNS)
        .single(),
      "guests.add",
    );
    return { guest: registrationView(row, false) };
  });
}
