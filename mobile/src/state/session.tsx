import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { setUnauthorizedHandler } from "@/lib/api";
import * as auth from "@/lib/auth";
import * as push from "@/lib/push";
import type { Member } from "@/types/portal";

type SessionStatus = "loading" | "authed" | "guest";

type SessionState = {
  member: Member | null;
  token: string | null;
  status: SessionStatus;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  signOutEverywhere: () => Promise<void>;
  refreshMember: () => Promise<void>;
};

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [member, setMember] = useState<Member | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<SessionStatus>("loading");
  const pushTokenRef = useRef<string | null>(null);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      auth.clearStoredToken();
      setToken(null);
      setMember(null);
      setStatus("guest");
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const stored = await auth.getStoredToken();
      if (!active) return;
      if (!stored) {
        setStatus("guest");
        return;
      }
      const me = await auth.fetchMe(stored);
      if (!active) return;
      if (me?.member) {
        setMember(me.member);
        setToken(stored);
        setStatus("authed");
      } else {
        await auth.clearStoredToken();
        setStatus("guest");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (sessionToken: string) => {
    await auth.storeToken(sessionToken);
    const me = await auth.fetchMe(sessionToken);
    if (!me?.member) {
      await auth.clearStoredToken();
      setToken(null);
      setMember(null);
      setStatus("guest");
      return;
    }
    setToken(sessionToken);
    setMember(me.member);
    setStatus("authed");
    void push.registerForPush(sessionToken).then((t) => {
      pushTokenRef.current = t;
    });
  }, []);

  const signOut = useCallback(async () => {
    const sessionToken = token;
    const pushToken = pushTokenRef.current;
    pushTokenRef.current = null;
    if (sessionToken) {
      void push.unregisterPush(sessionToken, pushToken);
      void auth.logout(sessionToken);
    }
    await auth.clearStoredToken();
    setToken(null);
    setMember(null);
    setStatus("guest");
  }, [token]);

  const signOutEverywhere = useCallback(async () => {
    const sessionToken = token;
    const pushToken = pushTokenRef.current;
    pushTokenRef.current = null;
    if (sessionToken) {
      void push.unregisterPush(sessionToken, pushToken);
      void auth.logoutAll(sessionToken);
    }
    await auth.clearStoredToken();
    setToken(null);
    setMember(null);
    setStatus("guest");
  }, [token]);

  const refreshMember = useCallback(async () => {
    if (!token) return;
    const me = await auth.fetchMe(token);
    if (me?.member) setMember(me.member);
  }, [token]);

  const value = useMemo(
    () => ({ member, token, status, signIn, signOut, signOutEverywhere, refreshMember }),
    [member, token, status, signIn, signOut, signOutEverywhere, refreshMember],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within a SessionProvider");
  return ctx;
}
