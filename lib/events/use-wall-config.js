"use client";

import { useState } from "react";
import { toast } from "sonner";
import { updateWallMeta } from "@/lib/supabase/event_wall";

// Per-section config state for the Event Wall editor, backed by the wall's
// metadata bag. Mirrors useEventConfig (lib/events/use-event-config.js) but
// persists through updateWallMeta — the wall is a singleton, so there's no id
// to thread through, just a key + fallback.
export function useWallConfig(wall, key, fallback) {
  const [value, setValue] = useState(wall?.[key] ?? fallback);
  const [saving, setSaving] = useState(false);

  const [seeded, setSeeded] = useState(Boolean(wall));
  if (wall && !seeded) {
    setSeeded(true);
    setValue(wall[key] ?? fallback);
  }

  const save = async (next, opts = {}) => {
    const payload = next === undefined ? value : next;
    if (next !== undefined) setValue(next);
    setSaving(true);
    const res = await updateWallMeta({ [key]: payload });
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
