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

// "unsupported" is a simulator or Expo Go build that can never register.
type PushStatus = "on" | "off" | "unsupported";

type SessionState = {
  member: Member | null;
  token: string | null;
  status: SessionStatus;
  pushStatus: PushStatus;
  pushToken: string | null;
  setPushEnabled: (next: boolean) => Promise<boolean>;
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
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState<PushStatus>("off");
  const pushTokenRef = useRef<string | null>(null);

  const rememberPushToken = useCallback((next: string | null) => {
    pushTokenRef.current = next;
    setPushToken(next);
    setPushStatus(next ? "on" : "off");
  }, []);

  useEffect(() => {
    void push.getStoredPushToken().then((stored) => {
      if (stored) rememberPushToken(stored);
    });
  }, [rememberPushToken]);

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
      if (t) rememberPushToken(t);
    });
  }, [rememberPushToken]);

  const setPushEnabled = useCallback(
    async (next: boolean) => {
      const sessionToken = token;
      if (!sessionToken) return false;
      if (!next) {
        const current = pushTokenRef.current;
        rememberPushToken(null);
        await push.unregisterPush(sessionToken, current);
        return true;
      }
      const registered = await push.registerForPush(sessionToken);
      if (!registered) {
        setPushStatus("unsupported");
        return false;
      }
      rememberPushToken(registered);
      return true;
    },
    [token, rememberPushToken],
  );

  const signOut = useCallback(async () => {
    const sessionToken = token;
    const current = pushTokenRef.current;
    rememberPushToken(null);
    if (sessionToken) {
      void push.unregisterPush(sessionToken, current);
      void auth.logout(sessionToken);
    }
    await auth.clearStoredToken();
    setToken(null);
    setMember(null);
    setStatus("guest");
  }, [token, rememberPushToken]);

  const signOutEverywhere = useCallback(async () => {
    const sessionToken = token;
    const current = pushTokenRef.current;
    rememberPushToken(null);
    if (sessionToken) {
      void push.unregisterPush(sessionToken, current);
      void auth.logoutAll(sessionToken);
    }
    await auth.clearStoredToken();
    setToken(null);
    setMember(null);
    setStatus("guest");
  }, [token, rememberPushToken]);

  const refreshMember = useCallback(async () => {
    if (!token) return;
    const me = await auth.fetchMe(token);
    if (me?.member) setMember(me.member);
  }, [token]);

  const value = useMemo(
    () => ({
      member,
      token,
      status,
      pushStatus,
      pushToken,
      setPushEnabled,
      signIn,
      signOut,
      signOutEverywhere,
      refreshMember,
    }),
    [
      member,
      token,
      status,
      pushStatus,
      pushToken,
      setPushEnabled,
      signIn,
      signOut,
      signOutEverywhere,
      refreshMember,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within a SessionProvider");
  return ctx;
}
