"use client";

import { useEffect } from "react";


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
