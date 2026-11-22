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

export type PushToggleResult = "ok" | "denied" | "unsupported" | "failed";

type SessionState = {
  member: Member | null;
  token: string | null;
  status: SessionStatus;
  pushStatus: PushStatus;
  pushToken: string | null;
  setPushEnabled: (next: boolean) => Promise<PushToggleResult>;
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
    void push.registerForPush(sessionToken).then((r) => {
      if (r.ok) rememberPushToken(r.pushToken);
    });
  }, [rememberPushToken]);

  useEffect(() => {
    if (status !== "authed" || !token) return;
    return push.addPushTokenChangeHandler(token, rememberPushToken);
  }, [status, token, rememberPushToken]);

  const setPushEnabled = useCallback(
    async (next: boolean): Promise<PushToggleResult> => {
      const sessionToken = token;
      if (!sessionToken) return "failed";
      if (!next) {
        const current = pushTokenRef.current;
        rememberPushToken(null);
        await push.unregisterPush(sessionToken, current);
        return "ok";
      }
      const registered = await push.registerForPush(sessionToken);
      if (!registered.ok) {
        // Only a build that can never register locks the switch; a denial can be fixed in Settings.
        if (registered.reason === "unsupported") setPushStatus("unsupported");
        return registered.reason;
      }
      rememberPushToken(registered.pushToken);
      return "ok";
    },
    [token, rememberPushToken],
  );

  // The logout routes retire this device (or every device) server-side, so only the local token is cleared here.
  const signOut = useCallback(async () => {
    const sessionToken = token;
    const current = pushTokenRef.current ?? (await push.getStoredPushToken());
    rememberPushToken(null);
    void push.clearStoredPushToken();
    if (sessionToken) void auth.logout(sessionToken, current);
    await auth.clearStoredToken();
    setToken(null);
    setMember(null);
    setStatus("guest");
  }, [token, rememberPushToken]);

  const signOutEverywhere = useCallback(async () => {
    const sessionToken = token;
    rememberPushToken(null);
    void push.clearStoredPushToken();
    if (sessionToken) void auth.logoutAll(sessionToken);
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
