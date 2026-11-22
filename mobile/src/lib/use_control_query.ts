import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { controlApi } from "@/lib/control_api";

type QueryState<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
  refreshing: boolean;
  reload: () => Promise<void>;
  setData: (next: T | ((prev: T | null) => T | null)) => void;
};

// One Control read: loads on mount and whenever the screen regains focus, so edits made on a pushed screen show on return.
export function useControlQuery<T>(path: string | null, { refetchOnFocus = true } = {}): QueryState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [refreshing, setRefreshing] = useState(false);
  const pathRef = useRef(path);
  const loadedRef = useRef(false);

  useEffect(() => {
    pathRef.current = path;
  }, [path]);

  const load = useCallback(async (asRefresh: boolean) => {
    const target = pathRef.current;
    if (!target) return;
    if (asRefresh) setRefreshing(true);
    const res = await controlApi<T>(target);
    // A response for a path the screen has moved past (new filter, new project) is dropped.
    if (pathRef.current !== target) {
      if (asRefresh) setRefreshing(false);
      return;
    }
    if (res.ok) {
      setData(res.data);
      setError(null);
    } else {
      setError(res.error);
    }
    loadedRef.current = true;
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    if (!path) return;
    loadedRef.current = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new path starts a fresh load
    setLoading(true);
    setData(null);
    setError(null);
    void load(false);
  }, [path, load]);

  useFocusEffect(
    useCallback(() => {
      if (refetchOnFocus && loadedRef.current) void load(false);
    }, [refetchOnFocus, load]),
  );

  const reload = useCallback(() => load(true), [load]);
  return { data, error, loading, refreshing, reload, setData };
}
