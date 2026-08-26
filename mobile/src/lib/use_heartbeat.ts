import { useEffect, useRef } from "react";

import { api } from "@/lib/api";
import { useSession } from "@/state/session";

const HEARTBEAT_MS = 30_000;

function newSessionKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

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
