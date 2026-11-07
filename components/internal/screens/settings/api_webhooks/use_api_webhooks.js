"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getWebhookHealth,
  listApiKeys,
  listWebhookDeliveries,
  listWebhookEndpoints,
} from "@/lib/supabase/api_webhooks";

const EMPTY = { keys: [], endpoints: [], deliveries: [], health: {}, failed: false };

// Everything the API & Webhooks screen shows, loaded together; `refresh` re-reads quietly (no loading flash).
export function useApiWebhooks(projectId) {
  const [data, setData] = useState(EMPTY);
  const [loadedFor, setLoadedFor] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!projectId) return undefined;
    let alive = true;
    Promise.all([
      listApiKeys(projectId),
      listWebhookEndpoints(projectId),
      listWebhookDeliveries(projectId),
      getWebhookHealth(projectId),
    ]).then(([keys, endpoints, deliveries, health]) => {
      if (!alive) return;
      setData({
        keys: keys ?? [],
        endpoints: endpoints ?? [],
        deliveries: deliveries ?? [],
        health: health ?? {},
        failed: keys === null && endpoints === null && deliveries === null,
      });
      setLoadedFor(projectId);
    });
    return () => {
      alive = false;
    };
  }, [projectId, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const upsertKey = useCallback((key) => {
    if (!key) return;
    setData((d) => ({
      ...d,
      keys: d.keys.some((k) => k.id === key.id) ? d.keys.map((k) => (k.id === key.id ? key : k)) : [key, ...d.keys],
    }));
  }, []);

  const upsertEndpoint = useCallback((endpoint) => {
    if (!endpoint) return;
    setData((d) => ({
      ...d,
      endpoints: d.endpoints.some((e) => e.id === endpoint.id)
        ? d.endpoints.map((e) => (e.id === endpoint.id ? endpoint : e))
        : [...d.endpoints, endpoint],
    }));
  }, []);

  const removeEndpoint = useCallback((id) => {
    setData((d) => ({ ...d, endpoints: d.endpoints.filter((e) => e.id !== id) }));
  }, []);

  const endpointById = useMemo(() => {
    const map = {};
    for (const e of data.endpoints) map[e.id] = e;
    return map;
  }, [data.endpoints]);

  return {
    ...data,
    loading: Boolean(projectId) && loadedFor !== projectId,
    endpointById,
    refresh,
    upsertKey,
    upsertEndpoint,
    removeEndpoint,
  };
}
