"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { processApi } from "@/lib/workspace/process/client";

// One shared store per event for stage rules, automations and review setups (the nav, screens and record sheet read it).
const stores = new Map();
const EMPTY = { status: "idle", data: null, error: null };

function createStore(eventId) {
  let state = EMPTY;
  let inflight = null;
  const listeners = new Set();
  const api = processApi(eventId);
  const set = (next) => { state = next; listeners.forEach((listener) => listener()); };
  const load = async () => {
    if (inflight) return inflight;
    if (!state.data) set({ ...state, status: "loading" });
    inflight = api.overview().then(({ data, error }) => {
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

export function useProcess(eventId, { enabled = true } = {}) {
  const store = useMemo(() => storeFor(eventId ?? "none"), [eventId]);
  const state = useSyncExternalStore(store.subscribe, store.get, () => EMPTY);

  useEffect(() => {
    if (!eventId || !enabled) return undefined;
    store.ensure();
    return undefined;
  }, [eventId, enabled, store]);

  // Runs one action, then reloads. Errors toast unless the caller handles that code.
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

  const data = state.data;
  return {
    status: state.status, error: state.error, data, api: store.api, run, reload: store.load,
    automations: data?.automations ?? [],
    processes: data?.processes ?? {},
    setups: data?.reviewSetups ?? [],
    members: data?.members ?? [],
  };
}

// The approvals badge: how many wait on the signed-in person (refreshed on focus).
export function useApprovalCount(eventId, { enabled = true } = {}) {
  const store = useMemo(() => storeFor(eventId ?? "none"), [eventId]);
  const key = `approvals:${eventId}`;
  const count = useSyncExternalStore(
    (listener) => { counts.listeners.add(listener); return () => counts.listeners.delete(listener); },
    () => counts.values.get(key) ?? 0, () => 0,
  );
  useEffect(() => {
    if (!eventId || !enabled) return undefined;
    const refresh = () => store.api.approvalCount().then(({ data }) => counts.set(key, data?.mine ?? 0));
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [eventId, enabled, store, key]);
  return count;
}

const counts = {
  values: new Map(), listeners: new Set(),
  set(key, value) { this.values.set(key, value); this.listeners.forEach((listener) => listener()); },
};
export const setApprovalCount = (eventId, value) => counts.set(`approvals:${eventId}`, value);
