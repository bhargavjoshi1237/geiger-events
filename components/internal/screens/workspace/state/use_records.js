"use client";

import { useCallback, useEffect, useState } from "react";
import { usePageState } from "@/components/internal/shared/pagination";
import { workspaceApi } from "@/lib/workspace/client";

const PAGE = 100;

// Records for one list under the current view; `refresh` changing (e.g. the definition reloading) refetches.
// `paged` fetches one page at a time (a table, driven by `pager`); otherwise the rows grow with loadMore (a board).
export function useRecords(eventId, objectId, spec, refresh, { paged = false } = {}) {
  const key = JSON.stringify({ objectId, spec });
  const [page, setPage] = useState({ key: null, rows: [], total: 0, error: null });
  const [version, setVersion] = useState(0);
  const [more, setMore] = useState(null);
  const pager = usePageState(page.total, { resetKey: `${key}|${paged}` });
  const limit = paged ? pager.pageSize : PAGE;
  const offset = paged ? (pager.page - 1) * pager.pageSize : 0;
  const fetchKey = `${key}|${limit}|${offset}`;

  useEffect(() => {
    if (!objectId) return undefined;
    const controller = new AbortController();
    const { spec: current } = JSON.parse(key);
    workspaceApi.records(eventId, objectId, { ...current, limit, offset }, controller.signal)
      .then(({ data, error }) => setPage(error ? { key: fetchKey, rows: [], total: 0, error } : { key: fetchKey, rows: data.rows, total: data.total, error: null }))
      .catch(() => {});
    return () => controller.abort();
  }, [eventId, objectId, key, fetchKey, limit, offset, version, refresh]);

  const loadMore = useCallback(async () => {
    const from = page.rows.length;
    setMore(from);
    const { data } = await workspaceApi.records(eventId, objectId, { ...JSON.parse(key).spec, limit: PAGE, offset: from });
    setMore(null);
    if (data) setPage((current) => (current.key === fetchKey ? { ...current, rows: [...current.rows, ...data.rows], total: data.total } : current));
  }, [eventId, objectId, key, fetchKey, page.rows.length]);

  const fresh = page.key === fetchKey;
  return {
    rows: page.rows,
    total: page.total,
    error: page.error,
    status: page.error && fresh ? "error" : page.key === null ? "loading" : fresh ? "ready" : "refreshing",
    reload: () => setVersion((n) => n + 1),
    pager: paged ? pager : null,
    loadMore,
    loadingMore: more !== null,
    hasMore: !paged && fresh && page.rows.length < page.total,
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
