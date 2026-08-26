import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

export type LivePlayerState = {
  roomId: string;
  roomName: string;
  eventName: string;
  startedAt: number;
} | null;

type LivePlayerContextValue = {
  playing: LivePlayerState;
  dock(room: { id: string; name: string; eventName: string }): void;
  clear(): void;
};

const LivePlayerContext = createContext<LivePlayerContextValue | null>(null);

export function LivePlayerProvider({ children }: { children: React.ReactNode }) {
  const [playing, setPlaying] = useState<LivePlayerState>(null);

  const dock = useCallback((room: { id: string; name: string; eventName: string }) => {
    setPlaying({ roomId: room.id, roomName: room.name, eventName: room.eventName, startedAt: Date.now() });
  }, []);

  const clear = useCallback(() => setPlaying(null), []);

  const value = useMemo(() => ({ playing, dock, clear }), [playing, dock, clear]);

  return <LivePlayerContext.Provider value={value}>{children}</LivePlayerContext.Provider>;
}

export function useLivePlayer(): LivePlayerContextValue {
  const ctx = useContext(LivePlayerContext);
  if (!ctx) throw new Error("useLivePlayer must be used within LivePlayerProvider");
  return ctx;
}
