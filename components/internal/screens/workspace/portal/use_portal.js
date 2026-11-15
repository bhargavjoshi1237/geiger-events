"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { portalBuilderApi } from "@/lib/workspace/portal/client";

// One shared portal-builder store per event: the nav (team pages) and every portal screen read the same copy.
const stores = new Map();
const EMPTY = { status: "idle", data: null, error: null };

function createStore(eventId) {
  let state = EMPTY;
  let inflight = null;
  const listeners = new Set();
  const api = portalBuilderApi(eventId);
  const set = (next) => { state = next; listeners.forEach((listener) => listener()); };
  const load = async () => {
    if (inflight) return inflight;
    if (!state.data) set({ ...state, status: "loading" });
    inflight = api.state().then(({ data, error }) => {
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

export function usePortal(eventId, { enabled = true } = {}) {
  const store = useMemo(() => storeFor(eventId ?? "none"), [eventId]);
  const state = useSyncExternalStore(store.subscribe, store.get, () => EMPTY);

  useEffect(() => {
    if (!eventId || !enabled) return undefined;
    store.ensure();
    return undefined;
  }, [eventId, enabled, store]);

  // Runs one builder action, then reloads the draft. Errors toast unless the caller handles that code.
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
    portal: data?.portal ?? null,
    roles: useMemo(() => (data?.roles ?? []).filter((role) => !role.deletedAt).sort((a, b) => a.position - b.position), [data]),
    pages: useMemo(() => (data?.pages ?? []).filter((page) => !page.deletedAt).sort((a, b) => a.position - b.position), [data]),
    can: data?.can ?? {},
  };
}

// Team pages appear in the Workspace sidebar group.
export const teamPagesOf = (portal) => portal.pages.filter((page) => page.kind === "page" && page.audience?.team);
