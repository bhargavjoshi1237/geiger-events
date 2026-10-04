"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { commandFor, createWorkflowClient, initialWorkflowState, workflowReducer } from "./workflow_client";

const client = createWorkflowClient();

export function useWorkflow(eventId, portal = false) {
  const scope = `${portal ? "portal" : "staff"}:${eventId}`;
  const [state, dispatch] = useReducer(workflowReducer, initialWorkflowState);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState(null);
  const [uncertain, setUncertain] = useState(false);
  const current = useRef({ scope, controller: null, sequence: 0, pending: null, busy: false });

  const load = useCallback(async () => {
    const record = current.current;
    const sequence = ++record.sequence;
    dispatch({ type: "loading", scope });
    try {
      const response = await client.load(eventId, portal, record.controller?.signal);
      if (record !== current.current || record.controller?.signal.aborted || sequence !== record.sequence) return;
      dispatch(response.error ? { type: "failed", scope, error: response.error } : { type: "loaded", scope, data: response.data });
      return response;
    } catch (error) { if (error.name !== "AbortError") throw error; }
  }, [eventId, portal, scope]);

  useEffect(() => {
    const controller = new AbortController();
    current.current.controller?.abort();
    current.current = { scope, controller, sequence: 0, pending: null, busy: false };
    dispatch({ type: "scope", scope });
    load();
    return () => controller.abort();
  }, [scope, load]);

  const perform = useCallback(async (pending) => {
    const record = current.current;
    if (record.busy) return { error: { message: "A command is already in progress." } };
    record.busy = true;
    setBusy(true);
    setOutcome(null);
    record.pending = pending;
    try {
      const response = pending.accept
        ? await client.accept(pending.body, record.controller?.signal)
        : await client.mutate(eventId, pending.body, portal, record.controller?.signal);
      if (record !== current.current || record.controller?.signal.aborted) return { error: { code: "aborted" } };
      if (response.error) {
        setUncertain(Boolean(response.error.uncertain));
        if (!response.error.uncertain) record.pending = null;
        dispatch({ type: "failed", scope, error: response.error });
      } else {
        record.pending = null;
        setUncertain(false);
        setOutcome({ action: pending.body.action || "acceptInvitation", result: response.data.result, revision: response.data.revision });
        if (pending.formKey) dispatch({ type: "draft", scope, key: pending.formKey, value: null });
        // A confirmed command has a known revision even if the subsequent read fails.
        if (state.data) dispatch({ type: "loaded", scope, data: { ...state.data, revision: response.data.revision } });
        await load();
        if (record === current.current && !record.controller?.signal.aborted) pending.onConfirmed?.(response.data);
      }
      return response;
    } catch (error) {
      if (error.name === "AbortError") return { error: { code: "aborted" } };
      throw error;
    } finally {
      record.busy = false;
      if (record === current.current && !record.controller?.signal.aborted) setBusy(false);
    }
  }, [eventId, portal, scope, load, state.data]);

  const submit = useCallback((action, payload, formKey) => {
    if (current.current.pending) return Promise.resolve({ error: { message: "Retry the pending command before starting another." } });
    return perform({ ...commandFor(null, action, payload, state.data?.revision ?? 0), formKey });
  }, [perform, state.data?.revision]);
  const accept = useCallback((token, onConfirmed) => perform({ accept: true, onConfirmed, body: { eventId, token, commandId: crypto.randomUUID() } }), [eventId, perform]);
  const draft = useCallback((key, value) => dispatch({ type: "draft", scope, key, value }), [scope]);

  return { ...state, data: state.scope === scope ? state.data : null, loading: state.scope !== scope || state.loading,
    busy, outcome, uncertain, load, submit, accept, retry: () => current.current.pending ? perform(current.current.pending) : Promise.resolve(),
    setDraft: draft };
}
