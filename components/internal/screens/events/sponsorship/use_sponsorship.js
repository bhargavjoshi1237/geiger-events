"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useProject } from "@/context/project-context";
import { conferenceApi } from "@/lib/supabase/conference";
import { getEventSponsorship, saveEventSponsorship } from "@/lib/supabase/event_sponsorship";
import {
  confirmedSponsorIds,
  normalizeSponsorship,
  refreshSnapshots,
} from "@/lib/events/sponsorship";

// Spots plus the project's sponsor records; every save refreshes fill snapshots and keeps metadata.sponsorIds in step.
export function useSponsorship(event, onPatch) {
  const { projectId } = useProject();
  const scopeKey = `${projectId}:${event?.id}`;
  const [data, setData] = useState(() => normalizeSponsorship(event?.sponsorship));
  const [seedId, setSeedId] = useState(scopeKey);
  if (scopeKey !== seedId) {
    setSeedId(scopeKey);
    setData(normalizeSponsorship(event?.sponsorship));
  }

  const [loaded, setLoaded] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const current = loaded?.key === scopeKey ? loaded : null;
  const records = current?.records ?? null;
  useEffect(() => {
    let alive = true;
    Promise.all([
      conferenceApi.list(projectId, "sponsor"),
      getEventSponsorship(event?.id),
    ]).then(([rows, privateData]) => {
      if (!alive) return;
      const failed = rows === null || privateData === null;
      setLoaded({ key: scopeKey, records: rows ?? [], failed });
      if (!failed) setData(privateData);
    });
    return () => {
      alive = false;
    };
  }, [projectId, event?.id, scopeKey, attempt]);

  const saveSpots = async (spots, successMsg) => {
    if (!current || current.failed) {
      toast.error("Load sponsorship successfully before saving changes.");
      return false;
    }
    const next = { spots: refreshSnapshots(spots, records || []) };
    const prev = data;
    setData(next);
    const patch = { sponsorship: next, sponsorIds: confirmedSponsorIds(next.spots) };
    const ok = await saveEventSponsorship(event?.id, next.spots);
    if (ok === false) {
      setData(prev);
      toast.error("Couldn't save to the server.");
      return false;
    }
    onPatch?.(patch);
    if (successMsg) toast.success(successMsg);
    return true;
  };

  const addRecord = (record) => setLoaded((value) => value?.key === scopeKey
    ? { ...value, records: [record, ...value.records] }
    : value);
  const reload = () => {
    setLoaded(null);
    setAttempt((value) => value + 1);
  };

  return { spots: data.spots, saveSpots, records, addRecord, projectId,
    loadError: current?.failed ?? false, reload };
}
