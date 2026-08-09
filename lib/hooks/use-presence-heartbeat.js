"use client";

import { useEffect } from "react";

// One presence heartbeat per open player, per browser tab: an immediate ping on
// open, then every 30s while it stays open. Every organiser-side live metric
// rolls up from these writes, so both the Live room view and the Watch player
// use it. Fails open — a rejected beat is swallowed so a metric problem can
// never interrupt playback.

export const HEARTBEAT_MS = 30000;
const HEARTBEAT_SECONDS = HEARTBEAT_MS / 1000;

export function usePresenceHeartbeat(roomId) {
  useEffect(() => {
    if (!roomId) return undefined;
    const sessionKey = crypto.randomUUID();
    let cancelled = false;
    const beat = (seconds) => {
      if (cancelled) return;
      fetch("/api/portal/live/heartbeat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roomId, sessionKey, seconds }),
      }).catch(() => {});
    };
    const timer = setInterval(() => beat(HEARTBEAT_SECONDS), HEARTBEAT_MS);
    beat(0);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [roomId]);
}
