import { blockedMessage, scanQuery } from "@/lib/checkin/scan";
import {
  ApiError,
  apiRoute,
  callRpc,
  listBody,
  parsePage,
  parseTime,
  parseUuid,
} from "@/lib/api_webhooks/server/public_api";

// GET /api/v1/checkins?event_id=&since=&limit=&starting_after=
export const GET = apiRoute("read:checkins", async ({ db, projectId, query }) => {
  const { limit, startingAfter } = parsePage(query);
  const result = await callRpc(db, "api_list_checkins", {
    p_project: projectId,
    p_limit: limit,
    p_starting_after: startingAfter,
    p_event: parseUuid(query.get("event_id"), "event_id"),
    p_since: parseTime(query.get("since"), "since"),
  });
  return listBody(result);
});

function cleanText(value, max) {
  const text = value == null ? "" : String(value).trim();
  return text ? text.slice(0, max) : null;
}

// The door runs through check-in staff roles; API check-ins use the project's first active staff code.
async function staffCode(db, projectId) {
  const { data, error } = await db
    .from("checkin_staff_roles")
    .select("access_code")
    .eq("project_id", projectId)
    .eq("type", "staff")
    .eq("active", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(10);
  if (error) {
    console.error("[api.v1.checkins.code]", error.message);
    throw new ApiError(503, "unavailable", "The API isn't available right now.");
  }
  return (data || []).map((row) => String(row.access_code || "").trim()).find(Boolean) || null;
}

// POST /api/v1/checkins { event_id, ticket_code, gate?, session_id? } — admits a ticket the way a door scanner does.
export const POST = apiRoute("write:checkins", async ({ request, db, projectId, key }) => {
  let body;
  try {
    body = await request.json();
  } catch {
    throw new ApiError(400, "invalid_json", "Send a JSON body.");
  }
  const eventId = parseUuid(body?.event_id, "event_id", { required: true });
  const code = cleanText(body?.ticket_code, 200);
  if (!code) throw new ApiError(400, "missing_parameter", "ticket_code is required.");
  const gate = cleanText(body?.gate, 80);
  const session = cleanText(body?.session_id, 120);

  const { data: event, error: eventError } = await db
    .from("events")
    .select("id")
    .eq("id", eventId)
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .maybeSingle();
  if (eventError) {
    console.error("[api.v1.checkins.event]", eventError.message);
    throw new ApiError(503, "unavailable", "The API isn't available right now.");
  }
  if (!event) throw new ApiError(404, "not_found", "No event with that id in this project.");

  const accessCode = await staffCode(db, projectId);
  if (!accessCode) {
    throw new ApiError(
      409,
      "checkin_not_configured",
      "Add an active staff role with an access code under Check-in → Staff roles; API check-ins are recorded through it.",
    );
  }

  // Ticket codes, full order/registration ids and QR contents (which may wrap the id in a URL) all resolve.
  const { query, id } = scanQuery(code);
  const rows = await callRpc(db, "checkin_search", {
    p_event: eventId,
    p_code: accessCode,
    p_query: query,
    p_session: session,
  });
  const upper = query.toUpperCase();
  const match = (rows || []).find((r) =>
    id ? r.registration_id === id || r.order_id === id : String(r.ticket_code || "").toUpperCase() === upper,
  );
  if (!match) throw new ApiError(404, "ticket_not_found", "No ticket with that code for this event.");

  const result = await callRpc(db, "checkin_admit", {
    p_event: eventId,
    p_code: accessCode,
    p_registration: match.registration_id || null,
    p_order: match.order_id || null,
    p_ticket_code: match.ticket_code || null,
    p_gate: gate,
    p_session: session,
    p_method: "api",
    p_staff: `API: ${key.name || "key"}`.slice(0, 120),
  });

  const attendee = {
    name: result?.name || match.name || "",
    ticket_code: match.ticket_code || null,
    order_id: match.order_id || null,
    registration_id: match.registration_id || null,
    party_size: result?.party ?? match.party_size ?? 1,
  };

  if (result?.ok) {
    const checkin = result.id
      ? await callRpc(db, "api_get_checkin", { p_project: projectId, p_id: result.id })
      : null;
    return {
      status: 201,
      body: { object: "checkin_result", admitted: true, already_checked_in: false, attendee, checkin },
    };
  }
  if (result?.already) {
    return {
      body: {
        object: "checkin_result",
        admitted: false,
        already_checked_in: true,
        reason: result.reason || "inside",
        attendee,
        checkin: null,
      },
    };
  }
  if (result?.capacity) {
    throw new ApiError(409, "capacity_full", "This area is at capacity. Admit them from the door app to override.");
  }
  const reason = String(result?.reason || "blocked");
  throw new ApiError(409, `ticket_${reason}`, blockedMessage(reason, attendee.name));
});
