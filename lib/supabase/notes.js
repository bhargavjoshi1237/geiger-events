"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";

// Data-access layer for per-event pre-launch notes. The only place that talks to
// the events.event_notes table (one row per event, a JSON array of notes).
// Pure: validate, console.error on failure, return null/false — never throw,
// never toast (the screen owns UX).

const TABLE = "event_notes";

// Normalize a raw JSON array into clean { id, text, done } note view models.
export function normalizeNotes(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((n) => n && typeof n === "object")
    .map((n) => ({
      id: String(n.id ?? ""),
      text: String(n.text ?? ""),
      done: Boolean(n.done),
      // Optional ISO date (YYYY-MM-DD); "" when no due date is set.
      dueDate: n.dueDate ? String(n.dueDate) : "",
    }))
    .filter((n) => n.id);
}

// Fetch the notes for one event. Returns [] when the row doesn't exist yet, and
// null only when the DB isn't reachable (so the screen can fall back to local).
export async function getEventNotes(eventId) {
  if (!eventId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(TABLE)
      .select("notes")
      .eq("event_id", eventId)
      .maybeSingle();
    if (error) {
      console.error("[notes.get]", error.message);
      return null;
    }
    return normalizeNotes(data?.notes);
  } catch (e) {
    console.error("[notes.get]", e);
    return null;
  }
}

// Upsert the whole notes array for an event. Returns true on success.
export async function saveEventNotes(eventId, notes) {
  if (!eventId || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb
      .from(TABLE)
      .upsert(
        { event_id: eventId, notes: normalizeNotes(notes) },
        { onConflict: "event_id" },
      );
    if (error) {
      console.error("[notes.save]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[notes.save]", e);
    return false;
  }
}
