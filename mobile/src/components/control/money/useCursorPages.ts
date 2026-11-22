import { useMemo, useState } from "react";

import { controlApi } from "@/lib/control_api";
import { useControlQuery } from "@/lib/use_control_query";

type Paged = { nextBefore: string | null };

// A newest-first list paged by a created_at cursor; later pages hang off one first page, so a refetch or new filter starts over.
export function useCursorPages<P extends Paged, T extends { id: string }>(path: string | null, itemsOf: (page: P) => T[]) {
  const query = useControlQuery<P>(path);
  const [extra, setExtra] = useState<{ base: P; items: T[]; nextBefore: string | null } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const more = extra && extra.base === query.data ? extra : null;
  const items = useMemo(() => {
    if (!query.data) return [];
    const first = itemsOf(query.data);
    if (!more) return first;
    const seen = new Set(first.map((i) => i.id));
    return [...first, ...more.items.filter((i) => !seen.has(i.id))];
  }, [query.data, more, itemsOf]);
  const nextBefore = more ? more.nextBefore : query.data?.nextBefore ?? null;

  // Returns an error message, or null once the page is in.
  const loadMore = async (): Promise<string | null> => {
    const base = query.data;
    if (!base || !nextBefore || loadingMore || !path) return null;
    setLoadingMore(true);
    const res = await controlApi<P>(`${path}${path.includes("?") ? "&" : "?"}before=${encodeURIComponent(nextBefore)}`);
    setLoadingMore(false);
    if (!res.ok) return res.error;
    setExtra({ base, items: [...(more?.items ?? []), ...itemsOf(res.data)], nextBefore: res.data.nextBefore });
    return null;
  };

  return { ...query, items, nextBefore, loadMore, loadingMore };
}
