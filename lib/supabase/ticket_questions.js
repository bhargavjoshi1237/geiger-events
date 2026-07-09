import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";

// Data-access layer for ticket-based questions. Owns the events.ticket_questions
// bank and the events.ticket_question_answers store (both resolved in the events
// schema by the shared client). Organizer reads/writes go direct to the tables
// (RLS-governed); public buyers reach questions/answers through SECURITY DEFINER
// RPCs (public_ticket_questions / save_ticket_answers / link_ticket_answers) so
// they never touch the whole bank or need a project-member session. Pure:
// validate, console.error on failure, return null / false / [] — never throw,
// never toast (the screen owns UX). DB is snake_case; UI is camelCase.

const TABLE = "ticket_questions";

// DB row -> camelCase view model.
export function normalizeQuestion(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    label: row.label ?? "",
    type: row.type ?? "text",
    options: Array.isArray(row.options) ? row.options : [],
    required: !!row.required,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? null,
  };
}

// camelCase patch -> snake_case columns. Emits a column only when its key is
// present, so one updateQuestion() serves a full save and a single-field edit.
function toRow(input) {
  const row = {};
  if ("projectId" in input) row.project_id = input.projectId;
  if ("label" in input) row.label = input.label || "Untitled question";
  if ("type" in input) row.type = input.type || "text";
  if ("options" in input) {
    row.options = Array.isArray(input.options) ? input.options : [];
  }
  if ("required" in input) row.required = !!input.required;
  if ("createdBy" in input) row.created_by = input.createdBy;
  return row;
}

// --- Organizer (direct table) ----------------------------------------------

// Every question in a project, newest first.
export async function listQuestions(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(TABLE)
      .select("*")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[ticket_questions.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeQuestion);
  } catch (e) {
    console.error("[ticket_questions.list]", e);
    return null;
  }
}

// Questions by an explicit id list (resolving a ticket's questionIds in the
// editor). Order is NOT guaranteed — the caller re-orders to match its array.
export async function getQuestionsByIds(ids) {
  if (!Array.isArray(ids) || !ids.length || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(TABLE)
      .select("*")
      .in("id", ids)
      .is("deleted_at", null);
    if (error) {
      console.error("[ticket_questions.getByIds]", error.message);
      return null;
    }
    return (data || []).map(normalizeQuestion);
  } catch (e) {
    console.error("[ticket_questions.getByIds]", e);
    return null;
  }
}

// Insert. Honors a caller-supplied `id` (the UI mints a UUID up front so the
// optimistic row and the ticket's questionIds array stay in sync).
export async function createQuestion(input) {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const payload = toRow(input);
    if (input.id) payload.id = input.id;
    const { data, error } = await sb
      .from(TABLE)
      .insert(payload)
      .select("*")
      .single();
    if (error) {
      console.error("[ticket_questions.create]", error.message);
      return null;
    }
    return normalizeQuestion(data);
  } catch (e) {
    console.error("[ticket_questions.create]", e);
    return null;
  }
}

export async function updateQuestion(id, patch) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(TABLE)
      .update(toRow(patch))
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      console.error("[ticket_questions.update]", error.message);
      return null;
    }
    return normalizeQuestion(data);
  } catch (e) {
    console.error("[ticket_questions.update]", e);
    return null;
  }
}

export async function softDeleteQuestion(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb
      .from(TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[ticket_questions.delete]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[ticket_questions.delete]", e);
    return false;
  }
}

// --- Public (SECURITY DEFINER RPCs) ----------------------------------------

// The questions attached to a ticket, in questionIds order. Returns [] when the
// ticket has none (or Supabase isn't configured) so the buyer flow just skips.
export async function getPublicTicketQuestions(ticketId) {
  if (!ticketId || !isSupabaseConfigured()) return [];
  try {
    const sb = createClient();
    const { data, error } = await sb.rpc("public_ticket_questions", {
      p_ticket_id: ticketId,
    });
    if (error) {
      console.error("[ticket_questions.public]", error.message);
      return [];
    }
    return (data || []).map((row) => ({
      id: row.id,
      label: row.label ?? "",
      type: row.type ?? "text",
      options: Array.isArray(row.options) ? row.options : [],
      required: !!row.required,
    }));
  } catch (e) {
    console.error("[ticket_questions.public]", e);
    return [];
  }
}

// Save per-seat answers. `answers` is an array of { questionId, seatIndex, value }.
// Pass registrationId for the free/approval path (known immediately) or clientRef
// for the paid path (linked to the order on return). Returns the inserted count,
// null when not configured, or false on error.
export async function saveTicketAnswers({
  eventId,
  ticketTypeId,
  ticketRef = null,
  registrationId = null,
  clientRef = null,
  answers,
}) {
  if (!eventId || !ticketTypeId || !Array.isArray(answers) || !answers.length) {
    return 0;
  }
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb.rpc("save_ticket_answers", {
      p_event_id: eventId,
      p_ticket_type_id: ticketTypeId,
      p_registration_id: registrationId,
      p_client_ref: clientRef,
      p_ticket_ref: ticketRef,
      p_answers: answers,
    });
    if (error) {
      console.error("[ticket_questions.saveAnswers]", error.message);
      return false;
    }
    return Number(data) || 0;
  } catch (e) {
    console.error("[ticket_questions.saveAnswers]", e);
    return false;
  }
}

// Attach pre-payment answers to the registration filed on the paid return trip.
export async function linkTicketAnswers(clientRef, registrationId) {
  if (!clientRef || !registrationId || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb.rpc("link_ticket_answers", {
      p_client_ref: clientRef,
      p_registration_id: registrationId,
    });
    if (error) {
      console.error("[ticket_questions.linkAnswers]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[ticket_questions.linkAnswers]", e);
    return false;
  }
}

// Organizer read: all answers for an event (for a future answers view). Returns
// camelCase rows the screen can group by registration / seat.
export async function listTicketAnswersByEvent(eventId) {
  if (!eventId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from("ticket_question_answers")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[ticket_questions.listAnswers]", error.message);
      return null;
    }
    return (data || []).map((row) => ({
      id: row.id,
      questionId: row.question_id ?? null,
      eventId: row.event_id ?? null,
      ticketTypeId: row.ticket_type_id ?? null,
      seatIndex: row.seat_index ?? 0,
      value: row.value,
      registrationId: row.registration_id ?? null,
      createdAt: row.created_at ?? null,
    }));
  } catch (e) {
    console.error("[ticket_questions.listAnswers]", e);
    return null;
  }
}
