import { useEffect, useRef } from "react";

import { api } from "@/lib/api";
import { useSession } from "@/state/session";

const HEARTBEAT_MS = 30_000;

// A uuid for the presence session; crypto.randomUUID is unavailable on Hermes.
function newSessionKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

// A presence heartbeat every 30s for a room or library item the member is
// watching. Fails open on purpose — a metrics error never interrupts playback.
export function useHeartbeat(roomId: string | null, active: boolean) {
  const { token } = useSession();
  const sessionKeyRef = useRef(newSessionKey());

  useEffect(() => {
    if (!roomId || !active || !token) return undefined;
    const beat = () => {
      void api("/api/portal/live/heartbeat", {
        method: "POST",
        token,
        body: { roomId, sessionKey: sessionKeyRef.current, seconds: 30 },
      });
    };
    beat();
    const id = setInterval(beat, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [roomId, active, token]);
}
