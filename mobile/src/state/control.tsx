import * as SecureStore from "expo-secure-store";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

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
  const [profile, setProfile] = useState<ControlProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [storedMode, setStoredMode] = useState<AppMode | null>(null);

  // Mirror the Supabase Auth session; it persists and refreshes itself.
  useEffect(() => {
    const auth = team.teamAuth;
    if (!auth) return;
    let active = true;
    void auth.getSession().then(({ data }) => {
      if (!active) return;
      setTeamEmail(data.session?.user.email ?? null);
      setTeamStatus(data.session ? "signedIn" : "signedOut");
    });
    const { data } = auth.onAuthStateChange((_event, session) => {
      setTeamEmail(session?.user.email ?? null);
      setTeamStatus(session ? "signedIn" : "signedOut");
    });
    return () => {
      active = false;
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

  const refreshProfile = useCallback(async () => {
    const res = await controlApi<ControlProfile>("/api/control/me");
    if (res.ok) {
      setProfile(res.data);
      setProfileError(null);
    } else {
      setProfileError(res.error);
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect -- refreshProfile sets state only after the request resolves */
  useEffect(() => {
    if (teamStatus === "signedIn") void refreshProfile();
  }, [teamStatus, refreshProfile]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const setMode = useCallback(async (next: AppMode) => {
    setStoredMode(next);
    await SecureStore.setItemAsync(MODE_KEY, next).catch(() => undefined);
  }, []);

  const signOutTeam = useCallback(async () => {
    await team.signOutTeam();
    setProfile(null);
    await setMode("attendee");
  }, [setMode]);

  const hint = status === "authed" && hintState && hintState.token === token ? hintState.hint : null;
  const visibleProfile = teamStatus === "signedIn" ? profile : null;

  const value = useMemo<ControlState>(
    () => ({
      teamStatus,
      teamEmail,
      hint,
      profile: visibleProfile,
      profileError: teamStatus === "signedIn" ? profileError : null,
      mode: storedMode ?? "attendee",
      modeReady: storedMode !== null,
      setMode,
      signInWithPassword: team.signInWithPassword,
      signInWithBrowser: team.signInWithBrowser,
      signOutTeam,
      refreshProfile,
    }),
    [teamStatus, teamEmail, hint, visibleProfile, profileError, storedMode, setMode, signOutTeam, refreshProfile],
  );

  return <ControlContext.Provider value={value}>{children}</ControlContext.Provider>;
}

export function useControl(): ControlState {
  const ctx = useContext(ControlContext);
  if (!ctx) throw new Error("useControl must be used within a ControlProvider");
  return ctx;
}
