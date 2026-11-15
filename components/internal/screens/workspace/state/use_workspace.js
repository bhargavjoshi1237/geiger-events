"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { workspaceApi } from "@/lib/workspace/client";

// One shared definition store per event: the editor nav and every workspace screen read the same copy.
const stores = new Map();
const EMPTY = { status: "idle", data: null, error: null };

function createStore(eventId) {
  let state = EMPTY;
  let inflight = null;
  const listeners = new Set();
  const set = (next) => { state = next; listeners.forEach((listener) => listener()); };
  const load = async () => {
    if (!eventId) return null;
    if (inflight) return inflight;
    if (!state.data) set({ ...state, status: "loading" });
    inflight = workspaceApi.definition(eventId).then(({ data, error }) => {
      inflight = null;
      if (error) {
        set({ status: "error", data: state.data, error });
        return null;
      }
      set({ status: "ready", data, error: null });
      return data;
    });
    return inflight;
  };
  return {
    get: () => state,
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    load,
    ensure: () => (state.status === "idle" ? load() : null),
  };
}

function storeFor(eventId) {
  if (!stores.has(eventId)) stores.set(eventId, createStore(eventId));
  return stores.get(eventId);
}

const STRUCTURAL = /^(workspace|object|field|view|change)\./;
const UNDO_LABELS = {
  "object.create": "List added", "object.update": "List updated", "object.delete": "List moved to the trash", "object.restore": "List restored",
  "field.create": "Field added", "field.update": "Field updated", "field.delete": "Field moved to the trash", "field.restore": "Field restored",
  "records.delete": "Moved to the trash", "records.restore": "Restored",
};

export function useWorkspace(eventId) {
  const store = useMemo(() => storeFor(eventId ?? "none"), [eventId]);
  const state = useSyncExternalStore(store.subscribe, store.get, () => EMPTY);

  useEffect(() => {
    if (!eventId) return undefined;
    store.ensure();
    const onFocus = () => store.load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [eventId, store]);

  // Runs one action. Errors become a toast unless the caller handles that code; structure changes offer Undo.
  const run = useCallback(async function runAction(action, payload = {}, options = {}) {
    const { quiet = false, handle = [], undo = true, success } = options;
    const { data, error } = await workspaceApi.command(eventId, { action, ...payload });
    if (error) {
      // A move the stage rules refuse: people who can configure may push it through.
      if (error.code === "move_not_allowed" && !handle.includes(error.code) && store.get().data?.can?.configure) {
        toast.error(error.message, { action: { label: "Move anyway", onClick: () => runAction(action, { ...payload, force: true }, options) } });
      } else if (!handle.includes(error.code)) toast.error(error.message);
      return { data: null, error };
    }
    if (STRUCTURAL.test(action) || action.startsWith("records.")) await store.load();
    else if (action === "record.create") store.load();
    if (!quiet) {
      const label = success ?? UNDO_LABELS[action];
      const undoIt = async () => {
        const result = await workspaceApi.command(eventId, { action: "change.undo", changeId: data.changeId, objectId: payload.objectId });
        if (result.error) { toast.error(result.error.message); return; }
        await store.load();
        toast.success("Undone");
      };
      if (label && undo && data?.changeId) toast.success(label, { action: { label: "Undo", onClick: undoIt } });
      else if (label) toast.success(label);
    }
    return { data, error: null };
  }, [eventId, store]);

  const data = state.data;
  return {
    status: state.status,
    error: state.error,
    data,
    exists: Boolean(data?.workspace),
    can: data?.can ?? {},
    objects: useMemo(() => (data?.objects ?? []).filter((object) => !object.deletedAt), [data]),
    reload: store.load,
    run,
  };
}

export const liveFieldsOf = (data, objectId) =>
  (data?.fields ?? []).filter((field) => field.objectId === objectId && !field.deletedAt).sort((a, b) => a.position - b.position);
