"use client";

import { useCallback, useEffect, useState } from "react";

import { getPushScheduler } from "@/lib/push/client";

const EMPTY = { projectId: null, data: null, error: null };

// Background job health and recent dispatcher runs, read while `enabled`; `refresh` re-reads quietly.
export function usePushScheduler(projectId, enabled) {
  const [state, setState] = useState(EMPTY);
  const [tick, setTick] = useState(0);

  const active = Boolean(enabled && projectId);

  useEffect(() => {
    if (!active) return undefined;
    let alive = true;
    getPushScheduler(projectId).then((result) => {
      if (!alive) return;
      setState((current) => {
        if (!result.error) return { projectId, data: result, error: null };
        // A failed re-read keeps what's already on screen.
        return current.projectId === projectId && current.data ? current : { projectId, data: null, error: result.error };
      });
    });
    return () => {
      alive = false;
    };
  }, [projectId, active, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const current = state.projectId === projectId ? state : EMPTY;
  return {
    data: current.data,
    error: current.data ? null : current.error,
    loading: active && state.projectId !== projectId,
    refresh,
  };
}
