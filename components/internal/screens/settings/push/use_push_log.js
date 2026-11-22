"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { listPushLog } from "@/lib/push/client";

const EMPTY = { key: null, items: [], nextCursor: null, pages: 0, error: null };

function filterParams({ status, type }) {
  return { status: status === "all" ? undefined : status, type: type === "all" ? undefined : type };
}

// The push log for the current filters, newest first, read while `enabled`; `loadMore` follows the cursor.
export function usePushLog(projectId, enabled) {
  const [filters, setFilters] = useState({ status: "all", type: "all" });
  const [state, setState] = useState(EMPTY);
  const [loadingMore, setLoadingMore] = useState(false);
  const [tick, setTick] = useState(0);
  // Bumped by every first-page read so slower, older answers (and in-flight "load more"s) are dropped.
  const request = useRef(0);

  const active = Boolean(enabled && projectId);
  const key = `${projectId}|${filters.status}|${filters.type}`;

  useEffect(() => {
    if (!active) return;
    const id = ++request.current;
    listPushLog(projectId, filterParams(filters)).then((result) => {
      if (id !== request.current) return;
      setState((current) => {
        if (!result.error) return { key, items: result.items, nextCursor: result.nextCursor, pages: 1, error: null };
        // A failed re-read keeps what's already on screen.
        return current.key === key ? current : { ...EMPTY, key, error: result.error };
      });
    });
  }, [active, projectId, filters, key, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const setFilter = useCallback((name, value) => setFilters((current) => ({ ...current, [name]: value })), []);

  const cursor = state.key === key ? state.nextCursor : null;

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    const id = request.current;
    setLoadingMore(true);
    const result = await listPushLog(projectId, { ...filterParams(filters), cursor });
    setLoadingMore(false);
    if (id !== request.current) return;
    if (result.error) {
      toast.error(result.error.message);
      return;
    }
    setState((current) => {
      const seen = new Set(current.items.map((item) => item.id));
      return {
        ...current,
        items: [...current.items, ...result.items.filter((item) => !seen.has(item.id))],
        nextCursor: result.nextCursor,
        pages: current.pages + 1,
      };
    });
  }, [cursor, loadingMore, projectId, filters]);

  // Swaps in a row the server just changed (a retry), keeping its place in the list.
  const replaceItem = useCallback((item) => {
    if (!item?.id) return;
    setState((current) => ({
      ...current,
      items: current.items.map((row) => (row.id === item.id ? { ...row, ...item } : row)),
    }));
  }, []);

  const current = state.key === key ? state : EMPTY;
  return {
    items: current.items,
    hasMore: Boolean(current.nextCursor),
    error: current.items.length ? null : current.error,
    loading: active && state.key !== key,
    loadingMore,
    // More than the first page is on screen, so a background re-read would cut the list short.
    extended: current.pages > 1,
    filters,
    setFilter,
    loadMore,
    refresh,
    replaceItem,
  };
}
