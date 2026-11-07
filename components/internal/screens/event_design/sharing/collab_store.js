"use client";

import { useSyncExternalStore } from "react";

import { getUser } from "@/lib/supabase/user";
import { listPlanComments, listPlanShares, listPlanVersions } from "@/lib/supabase/floor_plan_sharing";

// Per-plan collaboration state shared by the editor's extension slots (header, canvas overlay/HUD, inspector, status dock).
// Kept outside React so separate slots stay in sync; another screen can preset `activeId` before opening the editor.

const stores = new Map();

function createStore(planId) {
  let state = {
    planId,
    comments: null,
    versions: null,
    shares: null,
    user: null,
    pinMode: false,
    draft: null,
    activeId: null,
    showResolved: false,
    pendingRestore: null,
  };
  const listeners = new Set();
  const set = (patch) => {
    state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) };
    listeners.forEach((l) => l());
  };
  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set,
    async refreshComments() {
      const rows = await listPlanComments(planId);
      set((s) => ({ comments: rows ?? s.comments ?? [] }));
    },
    async refreshVersions() {
      const rows = await listPlanVersions(planId);
      set((s) => ({ versions: rows ?? s.versions ?? [] }));
    },
    async refreshShares() {
      const rows = await listPlanShares(planId);
      set((s) => ({ shares: rows ?? s.shares ?? [] }));
    },
    async loadUser() {
      if (state.user) return;
      const user = await getUser();
      set({ user: user ? { id: user.id, name: user.name } : { id: null, name: "" } });
    },
    upsertComment(comment) {
      if (!comment) return;
      set((s) => {
        const list = s.comments || [];
        const exists = list.some((c) => c.id === comment.id);
        return { comments: exists ? list.map((c) => (c.id === comment.id ? comment : c)) : [...list, comment] };
      });
    },
    removeComment(id) {
      set((s) => ({ comments: (s.comments || []).filter((c) => c.id !== id && c.parentId !== id) }));
    },
  };
}

export function getCollabStore(planId) {
  const key = planId || "none";
  if (!stores.has(key)) stores.set(key, createStore(planId));
  return stores.get(key);
}

const noop = async () => {};
const NO_STORE = {
  getState: () => null,
  subscribe: () => () => {},
  set: () => {},
  refreshComments: noop,
  refreshVersions: noop,
  refreshShares: noop,
  loadUser: noop,
  upsertComment: () => {},
  removeComment: () => {},
};

export function usePlanCollab(planId) {
  const store = planId ? getCollabStore(planId) : NO_STORE;
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  return [state, store];
}
