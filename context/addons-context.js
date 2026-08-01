"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { INSTALLED_ADDONS } from "@/addons";
import { useOptionalProject } from "@/context/project-context";
import {
  listProjectAddons,
  upsertProjectAddon,
} from "@/lib/supabase/project_addons";

// Per-project addon enablement for the workspace shell.
//
// The catalog is static code; this context owns the *dynamic* half — which
// addons this project has turned on, where their nav sits, and their settings —
// backed by events.project_addons so a toggle survives a refresh and every
// teammate on the project sees the same sidebar.
//
// Writes are optimistic: local state updates immediately, then persists; a
// falsy return rolls the change back and the caller toasts.

const AddonsContext = createContext(null);

// Everything-off stand-in for trees with no provider (public event pages, the
// members portal, the landing playground). Shared components can call useAddons()
// anywhere without a crash — the flow registry threw here instead.
const DISABLED = Object.freeze({
  rows: [],
  enabledIds: [],
  positions: {},
  loading: false,
  available: false,
  isEnabled: () => false,
  getConfig: () => ({}),
  setEnabled: async () => false,
  setPosition: async () => false,
  setConfig: async () => false,
});

export function AddonsProvider({ children }) {
  const project = useOptionalProject();
  const projectId = project?.projectId || null;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load this project's addon rows. Every setState happens in the async
  // continuation — a synchronous setState in an effect body cascades renders.
  // With no project yet, resolve to an empty set rather than staying "loading"
  // forever, so consumers render their empty state instead of a spinner.
  useEffect(() => {
    let alive = true;
    (projectId ? listProjectAddons(projectId) : Promise.resolve([])).then(
      (result) => {
        if (!alive) return;
        setRows(result ?? []);
        setLoading(false);
      },
    );
    return () => {
      alive = false;
    };
  }, [projectId]);

  const byId = useMemo(
    () => Object.fromEntries(rows.map((r) => [r.addonId, r])),
    [rows],
  );

  // Only ids that are both enabled AND still present in the catalog — a row for
  // an addon that was since removed from the code must not reach the nav merge.
  const enabledIds = useMemo(
    () =>
      INSTALLED_ADDONS.filter((a) => byId[a.id]?.enabled).map((a) => a.id),
    [byId],
  );

  const positions = useMemo(
    () =>
      Object.fromEntries(
        rows
          .filter((r) => Number.isInteger(r.position))
          .map((r) => [r.addonId, r.position]),
      ),
    [rows],
  );

  // Optimistically merge a patch into the local row, persist, and roll back the
  // exact previous row on failure.
  const patch = useCallback(
    async (addonId, changes) => {
      if (!projectId) return false;
      const previous = byId[addonId] || null;
      setRows((prev) => {
        const existing = prev.find((r) => r.addonId === addonId);
        if (existing) {
          return prev.map((r) =>
            r.addonId === addonId ? { ...r, ...changes } : r,
          );
        }
        return [...prev, { id: null, projectId, addonId, enabled: false, position: null, config: {}, ...changes }];
      });

      const saved = await upsertProjectAddon(projectId, addonId, changes);
      if (!saved) {
        setRows((prev) =>
          previous
            ? prev.map((r) => (r.addonId === addonId ? previous : r))
            : prev.filter((r) => r.addonId !== addonId),
        );
        return false;
      }
      setRows((prev) =>
        prev.some((r) => r.addonId === addonId)
          ? prev.map((r) => (r.addonId === addonId ? saved : r))
          : [...prev, saved],
      );
      return true;
    },
    [projectId, byId],
  );

  const value = useMemo(
    () => ({
      rows,
      enabledIds,
      positions,
      loading,
      available: true,
      isEnabled: (addonId) => Boolean(byId[addonId]?.enabled),
      getConfig: (addonId) => byId[addonId]?.config || {},
      setEnabled: (addonId, enabled) => patch(addonId, { enabled }),
      setPosition: (addonId, position) => patch(addonId, { position }),
      setConfig: (addonId, config) => patch(addonId, { config }),
    }),
    [rows, enabledIds, positions, loading, byId, patch],
  );

  return (
    <AddonsContext.Provider value={value}>{children}</AddonsContext.Provider>
  );
}

export function useAddons() {
  return useContext(AddonsContext) ?? DISABLED;
}
