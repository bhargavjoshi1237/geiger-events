"use client";

import { useCallback, useEffect, useState } from "react";
import { workspaceApi } from "@/lib/workspace/client";

const PAGE = 100;

// Pages of records for one list under the current view; `refresh` changing (e.g. the definition reloading) refetches.
export function useRecords(eventId, objectId, spec, refresh) {
  const key = JSON.stringify({ objectId, spec });
  const [page, setPage] = useState({ key: null, rows: [], total: 0, error: null });
  const [version, setVersion] = useState(0);
  const [more, setMore] = useState(null);

  useEffect(() => {
    if (!objectId) return undefined;
    const controller = new AbortController();
    const { spec: current } = JSON.parse(key);
    workspaceApi.records(eventId, objectId, { ...current, limit: PAGE, offset: 0 }, controller.signal)
      .then(({ data, error }) => setPage(error ? { key, rows: [], total: 0, error } : { key, rows: data.rows, total: data.total, error: null }))
      .catch(() => {});
    return () => controller.abort();
  }, [eventId, objectId, key, version, refresh]);

  const loadMore = useCallback(async () => {
    const offset = page.rows.length;
    setMore(offset);
    const { data } = await workspaceApi.records(eventId, objectId, { ...JSON.parse(key).spec, limit: PAGE, offset });
    setMore(null);
    if (data) setPage((current) => (current.key === key ? { ...current, rows: [...current.rows, ...data.rows], total: data.total } : current));
  }, [eventId, objectId, key, page.rows.length]);

  const fresh = page.key === key;
  return {
    rows: page.rows,
    total: page.total,
    error: page.error,
    status: page.error && fresh ? "error" : page.key === null ? "loading" : fresh ? "ready" : "refreshing",
    reload: () => setVersion((n) => n + 1),
    loadMore,
    loadingMore: more !== null,
    hasMore: fresh && page.rows.length < page.total,
    patchRow: (record) => setPage((current) => ({
      ...current,
      rows: current.rows.map((row) => (row.id === record.id ? { ...row, ...record, links: row.links, computed: row.computed } : row)),
    })),
    // Moves a row right after `afterId` (or before `beforeId`) with `patch` applied, ahead of the server confirming it.
    placeRow: (recordId, patch, { afterId = null, beforeId = null } = {}) => setPage((current) => {
      const row = current.rows.find((item) => item.id === recordId);
      if (!row) return current;
      const rest = current.rows.filter((item) => item.id !== recordId);
      const after = afterId ? rest.findIndex((item) => item.id === afterId) : -1;
      const before = beforeId ? rest.findIndex((item) => item.id === beforeId) : -1;
      const at = after >= 0 ? after + 1 : before >= 0 ? before : current.rows.indexOf(row);
      rest.splice(at, 0, { ...row, ...patch });
      return { ...current, rows: rest };
    }),
  };
}

// Every record matching a view, for CSV export (pages of 200).
export async function fetchAllRecords(eventId, objectId, spec, onProgress) {
  const out = [];
  for (let offset = 0; ; offset += 200) {
    const { data, error } = await workspaceApi.records(eventId, objectId, { ...spec, limit: 200, offset });
    if (error) throw new Error(error.message);
    out.push(...data.rows);
    onProgress?.(out.length, data.total);
    if (out.length >= data.total || !data.rows.length) return out;
  }
}
