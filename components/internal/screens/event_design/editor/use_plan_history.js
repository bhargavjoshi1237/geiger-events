"use client";

import { useCallback, useMemo, useState } from "react";

const LIMIT = 150;

// Undo/redo over the editor document. apply() = one undo step (same `coalesce` key merges, e.g. typing a label);
// begin() → preview()… → commit()/cancel() wraps a drag into a single step.
export function usePlanHistory(initialDoc) {
  const [state, setState] = useState({ doc: initialDoc, past: [], future: [], pending: null, key: null });

  const apply = useCallback((updater, { coalesce = null } = {}) => {
    setState((s) => {
      const next = typeof updater === "function" ? updater(s.doc) : updater;
      if (next === s.doc) return s;
      if (coalesce && s.key === coalesce && s.past.length) return { ...s, doc: next, future: [] };
      return { doc: next, past: [...s.past, s.doc].slice(-LIMIT), future: [], pending: null, key: coalesce };
    });
  }, []);

  const begin = useCallback(() => setState((s) => (s.pending ? s : { ...s, pending: s.doc, key: null })), []);

  const preview = useCallback(
    (updater) => setState((s) => ({ ...s, doc: typeof updater === "function" ? updater(s.doc) : updater })),
    [],
  );

  const commit = useCallback(() => {
    setState((s) => {
      if (!s.pending) return s;
      if (s.pending === s.doc) return { ...s, pending: null };
      return { doc: s.doc, past: [...s.past, s.pending].slice(-LIMIT), future: [], pending: null, key: null };
    });
  }, []);

  const cancel = useCallback(() => setState((s) => (s.pending ? { ...s, doc: s.pending, pending: null } : s)), []);

  const undo = useCallback(() => {
    setState((s) => {
      if (!s.past.length) return s;
      return {
        doc: s.past[s.past.length - 1],
        past: s.past.slice(0, -1),
        future: [s.doc, ...s.future].slice(0, LIMIT),
        pending: null,
        key: null,
      };
    });
  }, []);

  const redo = useCallback(() => {
    setState((s) => {
      if (!s.future.length) return s;
      return { doc: s.future[0], past: [...s.past, s.doc].slice(-LIMIT), future: s.future.slice(1), pending: null, key: null };
    });
  }, []);

  const reset = useCallback((doc) => setState({ doc, past: [], future: [], pending: null, key: null }), []);

  return useMemo(
    () => ({
      doc: state.doc,
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
      apply,
      begin,
      preview,
      commit,
      cancel,
      undo,
      redo,
      reset,
    }),
    [state.doc, state.past.length, state.future.length, apply, begin, preview, commit, cancel, undo, redo, reset],
  );
}
