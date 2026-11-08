import * as SecureStore from "expo-secure-store";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { api } from "@/lib/api";
import { controlApi } from "@/lib/control_api";
import * as team from "@/lib/team_auth";
import { useSession } from "@/state/session";
import type { ControlProfile, RolesHint } from "@/types/portal";

export type AppMode = "attendee" | "control";
type TeamStatus = "loading" | "signedIn" | "signedOut";

const MODE_KEY = "geiger.app.mode";

type ControlState = {
  teamStatus: TeamStatus;
  teamEmail: string | null;
  hint: RolesHint | null;
  profile: ControlProfile | null;
  profileError: string | null;
  mode: AppMode;
  modeReady: boolean;
  setMode: (next: AppMode) => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<team.TeamAuthResult>;
  signInWithBrowser: () => Promise<team.TeamAuthResult>;
  signOutTeam: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const ControlContext = createContext<ControlState | null>(null);

export function ControlProvider({ children }: { children: React.ReactNode }) {
  const { token, status } = useSession();
  const [teamStatus, setTeamStatus] = useState<TeamStatus>(team.teamAuth ? "loading" : "signedOut");
  const [teamEmail, setTeamEmail] = useState<string | null>(null);
  const [hintState, setHintState] = useState<{ token: string; hint: RolesHint } | null>(null);
  const [teamUserId, setTeamUserId] = useState<string | null>(null);
  const [profileState, setProfileState] = useState<{ userId: string; profile: ControlProfile | null; error: string | null } | null>(null);
  const teamUserIdRef = useRef<string | null>(null);
  const [storedMode, setStoredMode] = useState<AppMode | null>(null);

  // Mirror the Supabase Auth session; it persists and refreshes itself.
  useEffect(() => {
    const auth = team.teamAuth;
    if (!auth) return;
    let active = true;
    let settled = false;
    // supabase-js can spend ~30s refreshing an expired session offline, so show the stored user after 2s.
    const timer = setTimeout(() => {
      void team.storedTeamUser().then((user) => {
        if (!active || settled) return;
        setTeamEmail(user?.email ?? null);
        setTeamUserId(user?.id ?? null);
        setTeamStatus(user ? "signedIn" : "signedOut");
      });
    }, 2000);
    void auth
      .getSession()
      .then(({ data }) => {
        settled = true;
        clearTimeout(timer);
        if (!active) return;
        setTeamEmail(data.session?.user.email ?? null);
        setTeamUserId(data.session?.user.id ?? null);
        setTeamStatus(data.session ? "signedIn" : "signedOut");
      })
      .catch(() => {
        // A failed read counts as signed out so the splash never hangs.
        settled = true;
        clearTimeout(timer);
        if (!active) return;
        setTeamEmail(null);
        setTeamUserId(null);
        setTeamStatus("signedOut");
      });
    const { data } = auth.onAuthStateChange((_event, session) => {
      setTeamEmail(session?.user.email ?? null);
      setTeamUserId(session?.user.id ?? null);
      setTeamStatus(session ? "signedIn" : "signedOut");
    });
    return () => {
      active = false;
      clearTimeout(timer);
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    void SecureStore.getItemAsync(MODE_KEY)
      .catch(() => null)
      .then((stored) => setStoredMode(stored === "control" ? "control" : "attendee"));
  }, []);

  // Detection rides on the attendee session: it can only suggest Control, never open it.
  useEffect(() => {
    if (status !== "authed" || !token) return;
    let active = true;
    void api<RolesHint>("/api/portal/roles", { token }).then((res) => {
      if (active && res.ok) setHintState({ token, hint: res.data });
    });
    return () => {
      active = false;
    };
  }, [status, token]);

  // The ref lets in-flight fetches see the current user without re-creating refreshProfile.
  useEffect(() => {
    teamUserIdRef.current = teamUserId;
  }, [teamUserId]);

  const refreshProfile = useCallback(async () => {
    const userId = teamUserIdRef.current;
    if (!userId) return;
    const res = await controlApi<ControlProfile>("/api/control/me");
    // Drop responses for a user who is no longer signed in.
    if (teamUserIdRef.current !== userId) return;
    setProfileState(res.ok ? { userId, profile: res.data, error: null } : { userId, profile: null, error: res.error });
  }, []);

  useEffect(() => {
    if (teamStatus === "signedIn" && teamUserId) void refreshProfile();
  }, [teamStatus, teamUserId, refreshProfile]);

  const setMode = useCallback(async (next: AppMode) => {
    setStoredMode(next);
    await SecureStore.setItemAsync(MODE_KEY, next).catch(() => undefined);
  }, []);

  const signOutTeam = useCallback(async () => {
    try {
      await team.signOutTeam();
    } finally {
      setProfileState(null);
      await setMode("attendee");
    }
  }, [setMode]);

  const hint = status === "authed" && hintState && hintState.token === token ? hintState.hint : null;
  const owned = teamStatus === "signedIn" && teamUserId && profileState?.userId === teamUserId ? profileState : null;
  const visibleProfile = owned?.profile ?? null;
  const visibleError = owned?.error ?? null;

  const value = useMemo<ControlState>(
    () => ({
      teamStatus,
      teamEmail,
      hint,
      profile: visibleProfile,
      profileError: visibleError,
      mode: storedMode ?? "attendee",
      modeReady: storedMode !== null,
      setMode,
      signInWithPassword: team.signInWithPassword,
      signInWithBrowser: team.signInWithBrowser,
      signOutTeam,
      refreshProfile,
    }),
    [teamStatus, teamEmail, hint, visibleProfile, visibleError, storedMode, setMode, signOutTeam, refreshProfile],
  );

  return <ControlContext.Provider value={value}>{children}</ControlContext.Provider>;
}

export function useControl(): ControlState {
  const ctx = useContext(ControlContext);
  if (!ctx) throw new Error("useControl must be used within a ControlProvider");
  return ctx;
}
