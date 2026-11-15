"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { documentsApi } from "@/lib/workspace/documents/client";

// One shared store per event for email and PDF templates (automation steps, the Documents screen and record sheets read it).
const stores = new Map();
const EMPTY = { status: "idle", data: null, error: null };

function createStore(eventId) {
  let state = EMPTY;
  let inflight = null;
  const listeners = new Set();
  const api = documentsApi(eventId);
  const set = (next) => { state = next; listeners.forEach((listener) => listener()); };
  const load = async () => {
    if (inflight) return inflight;
    if (!state.data) set({ ...state, status: "loading" });
    inflight = api.list().then(({ data, error }) => {
      inflight = null;
      if (error) { set({ status: "error", data: state.data, error }); return null; }
      set({ status: "ready", data, error: null });
      return data;
    });
    return inflight;
  };
  return { api, get: () => state, subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); }, load,
    ensure: () => (state.status === "idle" ? load() : null) };
}

function storeFor(eventId) {
  if (!stores.has(eventId)) stores.set(eventId, createStore(eventId));
  return stores.get(eventId);
}

export function useDocuments(eventId, { enabled = true } = {}) {
  const store = useMemo(() => storeFor(eventId ?? "none"), [eventId]);
  const state = useSyncExternalStore(store.subscribe, store.get, () => EMPTY);

  useEffect(() => {
    if (!eventId || !enabled) return undefined;
    store.ensure();
    return undefined;
  }, [eventId, enabled, store]);

  const run = useCallback(async (action, payload = {}, { handle = [], success, reload = true } = {}) => {
    const { data, error } = await store.api.command({ action, ...payload });
    if (error) {
      if (!handle.includes(error.code)) toast.error(error.message);
      return { data: null, error };
    }
    if (reload) await store.load();
    if (success) toast.success(success);
    return { data, error: null };
  }, [store]);

  return {
    status: state.status, error: state.error, data: state.data, api: store.api, run, reload: store.load,
    items: state.data?.documents ?? [],
  };
}
