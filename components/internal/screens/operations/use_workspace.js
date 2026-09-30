"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { operationsClient } from "@/lib/operations/client";
import { initialWorkspaceState, workspaceReducer } from "./workspace_state";

export function useWorkspace(eventId) {
  const [state, dispatch] = useReducer(workspaceReducer, initialWorkspaceState);
  const scope = useRef(null);

  const load = useCallback(async (signal) => {
    dispatch({ type: "loading", eventId });
    const result = await operationsClient.workspace(eventId, signal);
    if (signal?.aborted) return;
    dispatch(result.error
      ? { type: "failed", eventId, error: result.error }
      : { type: "loaded", eventId, data: result.data });
  }, [eventId]);

  useEffect(() => {
    const controller = new AbortController();
    scope.current?.abort();
    scope.current = controller;
    dispatch({ type: "scope", eventId });
    load(controller.signal).catch((error) => {
      if (error.name !== "AbortError") dispatch({ type: "failed", eventId,
        error: { code: "network_error", message: "Couldn't load the workspace." } });
    });
    return () => controller.abort();
  }, [eventId, load]);

  const mutate = useCallback(async (operation) => {
    const result = await operation(scope.current?.signal);
    if (scope.current?.signal.aborted) return result;
    dispatch(result.error
      ? { type: "failed", eventId, error: result.error }
      : { type: "saved", eventId, data: result.data });
    return result;
  }, [eventId]);

  const setDraft = useCallback((draft) => dispatch({ type: "draft", eventId, draft }), [eventId]);
  const saveDraft = useCallback((modules, expectedRevision) => mutate((signal) =>
    operationsClient.saveDraft(eventId, { expectedRevision, modules }, signal)), [eventId, mutate]);
  const publish = useCallback((expectedRevision) => mutate((signal) =>
    operationsClient.publish(eventId, { expectedRevision, commandId: crypto.randomUUID() }, signal)),
  [eventId, mutate]);
  const archiveModule = useCallback((moduleKey, expectedRevision) => mutate((signal) =>
    operationsClient.archiveModule(eventId, { moduleKey, expectedRevision,
      commandId: crypto.randomUUID() }, signal)), [eventId, mutate]);

  return { ...state, loading: state.eventId !== eventId || state.loading,
    data: state.eventId === eventId ? state.data : null,
    draft: state.eventId === eventId ? state.draft : null,
    error: state.eventId === eventId ? state.error : null,
    load: () => load(scope.current?.signal), setDraft, saveDraft, publish, archiveModule };
}
