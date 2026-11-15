"use client";

import { useEffect, useState } from "react";
import { usePortalView } from "./portal_context";

// Loads one block's data through the adapter; reloads when its params change or after a write anywhere on the page.
// While new params load, the previous result stays on screen (`refreshing`).
export function useBlockData(block, params = {}, { enabled = true } = {}) {
  const { api, page, record, version } = usePortalView();
  const [reload, setReload] = useState(0);
  const key = JSON.stringify({ pageId: page?.id, blockId: block?.id, recordId: record?.id ?? null, params: params ?? {}, version, reload });
  const [state, setState] = useState({ key: null, data: null, error: null });

  useEffect(() => {
    if (!enabled) return undefined;
    const request = JSON.parse(key);
    if (!request.pageId || !request.blockId) return undefined;
    const controller = new AbortController();
    api.blockData({ pageId: request.pageId, blockId: request.blockId, params: request.params, recordId: request.recordId }, controller.signal)
      .then(({ data, error }) => { if (!controller.signal.aborted) setState({ key, data, error }); })
      .catch(() => { /* superseded by a newer request */ });
    return () => controller.abort();
  }, [api, key, enabled]);

  const fresh = state.key === key;
  return {
    data: state.data,
    error: fresh ? state.error : null,
    loading: enabled && state.key === null,
    refreshing: enabled && state.key !== null && !fresh,
    reload: () => setReload((n) => n + 1),
  };
}
