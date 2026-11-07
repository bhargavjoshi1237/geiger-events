"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CheckinEngine } from "./engine";

// One offline-capable check-in engine per mounted staff route (the route remounts on unlock, so code/role are fixed).
export function useCheckinEngine({ eventId, code, role, route }) {
  const [engine] = useState(() => new CheckinEngine({ eventId, code, role, route }));

  useEffect(() => {
    engine.start();
    return () => engine.stop();
  }, [engine]);

  const status = useSyncExternalStore(engine.subscribe, engine.getStatus, engine.getStatus);
  return { engine, status };
}

export default useCheckinEngine;
