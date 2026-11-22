import { scanQuery } from "@/lib/checkin/scan";
import { requireId, withControl } from "@/lib/control/http";
import { CONTROL_CAPABILITIES } from "@/lib/control/profile";
import { loadDoorCounts } from "@/lib/control/queries";
import { admitOutcome, codeRange, ticketCode } from "@/lib/control/records";
import { eventScope, must, readJson } from "@/lib/control/scope";
import { ApiError } from "@/lib/staff_access/errors";

const NOT_FOUND = "No ticket with that code for this event.";

// GET — door numbers: who's inside, who's expected, and the latest admissions.
export async function GET(request, { params }) {
  const { eventId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await eventScope(ctx, eventId, CONTROL_CAPABILITIES.checkIn);
    const [{ admitted, expected }, recent] = await Promise.all([
      loadDoorCounts(scope.db, eventId),
      scope.db
        .from("checkin_attendance")
        .select("id,attendee_name,ticket_code,method,gate,checked_in_by,checked_in_at")
        .eq("event_id", eventId)
        .is("session_id", null)
        .is("deleted_at", null)
        .order("checked_in_at", { ascending: false })
        .limit(15)
        .then((res) => must(res, "checkin.recent")),
    ]);
    return {
      admitted,
      expected,
      recent: recent.map((r) => ({
        id: r.id,
        name: r.attendee_name || "Guest",
        code: r.ticket_code || "",
        method: r.method || "manual",
        gate: r.gate || "",
        by: r.checked_in_by || "",
        at: r.checked_in_at,
      })),
    };
  });
}

// The registration or order a scan, typed code or picked guest means — only ever one belonging to this event.
async function resolveTicket(db, eventId, body) {
  const pick = async (table, columns, apply) =>
    must(await apply(db.from(table).select(columns).eq("event_id", eventId)).limit(2), `checkin.find.${table}`);
  const registration = (apply) => pick("registrations", "id,name", (q) => apply(q.is("deleted_at", null)));
  const order = (apply) => pick("event_orders", "id,buyer_name", apply);

  if (body.registrationId) {
    const [row] = await registration((q) => q.eq("id", requireId(body.registrationId)));
    if (row) return { registrationId: row.id, orderId: null, name: row.name, code: ticketCode(row.id) };
    throw new ApiError("not_found", 404, NOT_FOUND);
  }
  if (body.orderId) {
    const [row] = await order((q) => q.eq("id", requireId(body.orderId)));
    if (row) return { registrationId: null, orderId: row.id, name: row.buyer_name, code: ticketCode(row.id) };
    throw new ApiError("not_found", 404, NOT_FOUND);
  }

  const raw = typeof body.code === "string" ? body.code.slice(0, 400) : "";
  const { query, id } = scanQuery(raw);
  if (id) {
    const [reg] = await registration((q) => q.eq("id", id));
    if (reg) return { registrationId: reg.id, orderId: null, name: reg.name, code: ticketCode(reg.id) };
    const [ord] = await order((q) => q.eq("id", id));
    if (ord) return { registrationId: null, orderId: ord.id, name: ord.buyer_name, code: ticketCode(ord.id) };
    throw new ApiError("not_found", 404, NOT_FOUND);
  }
  const range = codeRange(query);
  if (!range) throw new ApiError("not_found", 404, "Scan a ticket QR or type its 8-character code.");
  const within = (q) => q.gte("id", range.from).lte("id", range.to);
  const [reg] = await registration(within);
  if (reg) return { registrationId: reg.id, orderId: null, name: reg.name, code: ticketCode(reg.id) };
  const [ord] = await order(within);
  if (ord) return { registrationId: null, orderId: ord.id, name: ord.buyer_name, code: ticketCode(ord.id) };
  throw new ApiError("not_found", 404, NOT_FOUND);
}

// POST { code? | registrationId? | orderId?, method?, overrideReason?, clientId? } — admits through the dashboard's capacity-aware core.
export async function POST(request, { params }) {
  const { eventId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await eventScope(ctx, eventId, CONTROL_CAPABILITIES.checkIn);
    const body = await readJson(request);
    const ticket = await resolveTicket(scope.db, eventId, body);
    const overrideReason = typeof body.overrideReason === "string" ? body.overrideReason.trim().slice(0, 300) || null : null;
    const clientId = typeof body.clientId === "string" && /^[0-9a-f-]{36}$/i.test(body.clientId) ? body.clientId : null;
    const result = must(
      await scope.db.rpc("checkin_admit_member", {
        p_event: eventId,
        p_registration: ticket.registrationId,
        p_order: ticket.orderId,
        p_name: ticket.name || "",
        p_method: body.method === "qr" ? "qr" : "manual",
        p_staff: "Control app",
        p_override_reason: overrideReason,
        p_client_id: clientId,
      }),
      "checkin.admit",
    );
    return { ...admitOutcome(result, ticket.name), code: ticket.code };
  });
}
