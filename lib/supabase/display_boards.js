"use client";

import { createClient } from "./client";
import { isSupabaseConfigured, normalizeEvent } from "./events";
import { normalizeRecord } from "./records";

// Public read path for Display Boards — the /display/<boardId> route, which runs
// on a billboard that is never signed in.
//
// The workspace screen writes boards through the shared conferenceApi (module
// "board"), exactly like every other Conference record. Only this read is
// special: it resolves a board, its event, and that event's sessions in one call
// through the anon client, leaning on the public-read policies added in
// 20260812060147_display_boards_public.sql. Nothing here is member-scoped, so a
// board that isn't published simply resolves to null.
//
// Pure data access: validate, console.error on failure, return null — the route
// owns UX.

const TABLE = "conference_records";

// Board + event + sessions for a published board. Returns null when the board is
// missing, unpublished, or the DB isn't configured.
export async function getPublicBoard(boardId) {
  if (!boardId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();

    const { data: boardRow, error: boardError } = await sb
      .from(TABLE)
      .select("*")
      .eq("id", boardId)
      .eq("module", "board")
      .is("deleted_at", null)
      .maybeSingle();
    if (boardError) {
      console.error("[display.board]", boardError.message);
      return null;
    }

    const board = normalizeRecord(boardRow);
    // An unpublished board is invisible to anon anyway; this also stops a signed-in
    // organiser from handing out a URL that would 404 for everyone else.
    if (!board || board.config?.published !== true) return null;

    const eventId = board.config?.eventId || null;
    if (!eventId) return { board, event: null, sessions: [] };

    const [eventResult, sessionResult] = await Promise.all([
      sb.from("events").select("*").eq("id", eventId).is("deleted_at", null).maybeSingle(),
      sb
        .from(TABLE)
        .select("*")
        .eq("module", "session")
        .eq("project_id", board.projectId)
        .is("deleted_at", null),
    ]);

    if (eventResult.error) console.error("[display.event]", eventResult.error.message);
    if (sessionResult.error) console.error("[display.sessions]", sessionResult.error.message);

    const sessions = (sessionResult.data || [])
      .map(normalizeRecord)
      .filter((s) => s.config?.eventId === eventId);

    return {
      board,
      event: normalizeEvent(eventResult.data),
      sessions,
    };
  } catch (e) {
    console.error("[display.board]", e);
    return null;
  }
}
