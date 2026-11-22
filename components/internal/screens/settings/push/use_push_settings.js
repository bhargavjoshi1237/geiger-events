"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { getPushSettings, savePushSettings } from "@/lib/push/client";
import { normalizeSettings } from "@/lib/push/types";

const EMPTY = { projectId: null, settings: null, error: null };

// The project's push settings, read while `enabled`; `update` saves at once and rolls back with a toast if the server refuses.
export function usePushSettings(projectId, enabled) {
  const [state, setState] = useState(EMPTY);
  const [tick, setTick] = useState(0);
  // What's on screen and what the server last accepted, so back-to-back changes build on each other.
  const shown = useRef({ projectId: null, settings: null });
  const confirmed = useRef({ seq: 0, settings: null });
  const seq = useRef(0);

  const active = Boolean(enabled && projectId);

  useEffect(() => {
    if (!active) return undefined;
    let alive = true;
    const startedAt = seq.current;
    getPushSettings(projectId).then((result) => {
      if (!alive) return;
      const loaded = shown.current.projectId === projectId;
      if (result.error) {
        setState({ projectId, settings: loaded ? shown.current.settings : null, error: result.error });
        return;
      }
      // A save started while this was loading; its outcome owns the screen.
      if (loaded && seq.current !== startedAt) return;
      shown.current = { projectId, settings: result.settings };
      confirmed.current = { seq: seq.current, settings: result.settings };
      setState({ projectId, settings: result.settings, error: null });
    });
    return () => {
      alive = false;
    };
  }, [projectId, active, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  // `patch` is an object or (settings) => object.
  const update = useCallback(
    async (patch) => {
      const base = shown.current.projectId === projectId ? shown.current.settings : null;
      if (!base) return false;
      const delta = typeof patch === "function" ? patch(base) : patch;
      const next = normalizeSettings({ ...base, ...delta });
      const mine = ++seq.current;
      shown.current = { projectId, settings: next };
      setState({ projectId, settings: next, error: null });

      const result = await savePushSettings(projectId, next);
      if (!result.error && mine > confirmed.current.seq) confirmed.current = { seq: mine, settings: result.settings };
      // A newer change is already on its way and carries this one with it.
      if (mine !== seq.current || shown.current.projectId !== projectId) return !result.error;

      const settled = result.error ? confirmed.current.settings : result.settings;
      shown.current = { projectId, settings: settled };
      setState({ projectId, settings: settled, error: null });
      if (result.error) toast.error(result.error.message);
      return !result.error;
    },
    [projectId],
  );

  const current = state.projectId === projectId ? state : EMPTY;
  return {
    settings: current.settings,
    error: current.settings ? null : current.error,
    loading: active && state.projectId !== projectId,
    refresh,
    update,
  };
}
