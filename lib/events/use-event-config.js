"use client";

import { useState } from "react";
import { toast } from "sonner";
import { updateEventMeta } from "@/lib/supabase/events";

// Reusable per-section config state backed by the event's metadata bag.
//
//   const [tickets, setTickets, saveTickets] = useEventConfig(event, "tickets", DEFAULT_TICKETS);
//   // transient edits: setTickets(next)
//   // persist (immediately or on a Save button): saveTickets(next, { successMsg })
//
// `event[key]` comes from normalizeEvent spreading metadata, so a saved section
// rehydrates on reload. Persistence shallow-merges just this key (flow_event
// _merge_meta), so sections never clobber each other.
export function useEventConfig(event, key, fallback) {
  const [value, setValue] = useState(event?.[key] ?? fallback);
  const [saving, setSaving] = useState(false);

  // Re-seed when a different event is opened (render-phase reset).
  const [seedId, setSeedId] = useState(event?.id);
  if (event?.id !== seedId) {
    setSeedId(event?.id);
    setValue(event?.[key] ?? fallback);
  }

  // Set + persist. Pass the next value; omit to persist the current value.
  const save = async (next, opts = {}) => {
    const payload = next === undefined ? value : next;
    if (next !== undefined) setValue(next);
    setSaving(true);
    const res = await updateEventMeta(event?.id, { [key]: payload });
    setSaving(false);
    if (res === false) {
      toast.error(opts.errorMsg || "Couldn't save to the server.");
      return false;
    }
    if (opts.successMsg) toast.success(opts.successMsg);
    return true;
  };

  return [value, setValue, save, saving];
}
