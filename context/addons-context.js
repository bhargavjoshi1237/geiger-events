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
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import {
  listProjectAddons,
  upsertProjectAddon,
} from "@/lib/supabase/project_addons";
import {
  usePaintFromShellCache,
  writeShellCache,
} from "@/lib/workspace/shell_cache";

const CACHE = "addon-rows";

const AddonsContext = createContext(null);

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
  const { projectId: routeProjectId } = useWorkspaceUrl();
  const projectId = routeProjectId || project?.projectId || null;

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  usePaintFromShellCache(CACHE, projectId, (entry) => {
    if (!Array.isArray(entry.value)) return;
    setRows(entry.value);
    setLoading(false);
  });

  useEffect(() => {
    let alive = true;
    (projectId ? listProjectAddons(projectId) : Promise.resolve([])).then(
      (result) => {
        if (!alive) return;
        setLoading(false);
        if (result) setRows(result);
      },
    );
    return () => {
      alive = false;
    };
  }, [projectId]);

  useEffect(() => {
    if (loading) return;
    writeShellCache(CACHE, projectId, null, rows);
  }, [projectId, loading, rows]);

  const byId = useMemo(
    () => Object.fromEntries(rows.map((r) => [r.addonId, r])),
    [rows],
  );

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
