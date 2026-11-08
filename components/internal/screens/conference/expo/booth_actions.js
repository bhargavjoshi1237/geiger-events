"use client";

import { toast } from "sonner";

import { assignBooth, blockBooths, releaseBoothAssignment, unblockBooths } from "@/lib/supabase/expo";

// Box-office actions on one booth for one event (comp, block, unblock, release); each toasts and resolves to success.

export async function assignBoothTo(event, booth, exhibitor) {
  const saved = await assignBooth(event.id, booth.id, exhibitor);
  if (!saved) {
    toast.error(`Couldn't assign ${booth.code || "the booth"} — it may have just been sold or held.`);
    return false;
  }
  toast.success(`${booth.code || "Booth"} assigned to ${exhibitor.name}.`);
  return true;
}

export async function blockBooth(event, booth) {
  const ok = await blockBooths(event.id, [booth.id], "Blocked from Expo Booths");
  if (!ok) {
    toast.error(`Couldn't block ${booth.code || "the booth"} — it may have just been taken.`);
    return false;
  }
  toast.success(`${booth.code || "Booth"} is off sale for ${event.name || "the event"}.`);
  return true;
}

export async function unblockBooth(event, booth) {
  const ok = await unblockBooths(event.id, [booth.id]);
  if (!ok) {
    toast.error("Couldn't put the booth back on sale.");
    return false;
  }
  toast.success(`${booth.code || "Booth"} is back on sale.`);
  return true;
}

export async function releaseBooth(booth, assignment) {
  const ok = await releaseBoothAssignment(assignment.id);
  if (!ok) {
    toast.error("Couldn't release the booth.");
    return false;
  }
  toast.success(`${booth.code || "Booth"} released${assignment.exhibitorName ? ` from ${assignment.exhibitorName}` : ""}.`);
  return true;
}

// The menu items a booth offers for one event, by its current state.
export function boothEventActions({ event, booth, state, onAssign, onDone }) {
  const run = (fn) => async () => (await fn()) && onDone?.();
  if (state.key === "available") {
    return [
      { label: "Assign exhibitor…", onSelect: () => onAssign({ event, booth }) },
      { label: "Block from sale", onSelect: run(() => blockBooth(event, booth)) },
    ];
  }
  if (state.key === "blocked") return [{ label: "Put back on sale", onSelect: run(() => unblockBooth(event, booth)) }];
  if (state.key === "comp" && state.assignment) {
    return [{ label: "Release booth", destructive: true, onSelect: run(() => releaseBooth(booth, state.assignment)) }];
  }
  return [];
}
