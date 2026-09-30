"use client";

import { useState } from "react";
import { toast } from "sonner";
import { updateEventMeta } from "@/lib/supabase/events";

// `onPatch` (the editor's section prop) mirrors a successful save into the editor's event, so sibling sections see it.
export function useEventConfig(event, key, fallback, onPatch) {
  const [value, setValue] = useState(event?.[key] ?? fallback);
  const [saving, setSaving] = useState(false);

  const [seedId, setSeedId] = useState(event?.id);
  if (event?.id !== seedId) {
    setSeedId(event?.id);
    setValue(event?.[key] ?? fallback);
  }

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
    onPatch?.({ [key]: payload });
    if (opts.successMsg) toast.success(opts.successMsg);
    return true;
  };

  return [value, setValue, save, saving];
}
