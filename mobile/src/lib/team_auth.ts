import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import { AppState, Platform } from "react-native";

import { secureChunkStorage } from "@/lib/secure_chunks";

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
const text = (value: unknown) => (typeof value === "string" ? value : "");

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || text(extra.supabaseUrl);
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || text(extra.supabaseAnonKey);

export const SUITE_ORIGIN = (text(extra.suiteOrigin) || "https://geiger.studio").replace(/\/+$/, "");

// Must match MOBILE_STATE_PREFIX / MOBILE_RETURN in ../../lib/desktop/handoff_link.js.
const STATE_PREFIX = "mobile_";
const SESSION_KEY = "geiger.team.session";
const RETURN_URL = "geigerevents://team-auth";

export const teamAuthConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// Auth only: team data always comes from /api/control/*, never from Supabase tables.
export const teamAuth = teamAuthConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: Platform.OS === "web" ? undefined : secureChunkStorage,
        storageKey: SESSION_KEY,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    }).auth
  : null;

// Supabase only refreshes tokens while the app is in the foreground.
if (teamAuth) {
  AppState.addEventListener("change", (state) => {
    if (state === "active") void teamAuth.startAutoRefresh();
    else void teamAuth.stopAutoRefresh();
  });
}

export type TeamAuthResult = { ok: true } | { ok: false; error: string };

const NOT_CONFIGURED: TeamAuthResult = { ok: false, error: "Team sign-in isn't set up in this build." };

export async function signInWithPassword(email: string, password: string): Promise<TeamAuthResult> {
  if (!teamAuth) return NOT_CONFIGURED;
  try {
    const { error } = await teamAuth.signInWithPassword({ email: email.trim(), password });
    if (!error) return { ok: true };
    return {
      ok: false,
      error:
        error.status === 400
          ? "That email and password don't match a Geiger account."
          : "Couldn't sign in. Check your connection and try again.",
    };
  } catch {
    return { ok: false, error: "Couldn't sign in. Check your connection and try again." };
  }
}

// Google, GitHub, SSO and passkeys all run on geiger.studio; the desktop handoff mints a one-time token and deep-links it back here.
export async function signInWithBrowser(): Promise<TeamAuthResult> {
  if (!teamAuth) return NOT_CONFIGURED;
  try {
    const state = `${STATE_PREFIX}${Crypto.randomUUID().replace(/-/g, "")}${Crypto.randomUUID().slice(0, 8)}`;
    const url = `${SUITE_ORIGIN}/events/desktop/handoff?state=${encodeURIComponent(state)}`;
    const result = await WebBrowser.openAuthSessionAsync(url, RETURN_URL);
    if (result.type !== "success") return { ok: false, error: "" };

    const params = new URL(result.url).searchParams;
    if (params.get("state") !== state) return { ok: false, error: "That sign-in didn't come from this request. Try again." };
    const tokenHash = params.get("token_hash");
    if (params.get("error") || !tokenHash) return { ok: false, error: "The browser sign-in didn't finish. Try again." };

    const { data, error } = await teamAuth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
    if (error || !data.session) return { ok: false, error: "That sign-in link expired. Try again." };
    return { ok: true };
  } catch {
    return { ok: false, error: "The browser sign-in didn't finish. Try again." };
  }
}

// Reads the persisted session without a network call, so startup can show the last-known user while a refresh is slow.
export async function storedTeamUser(): Promise<{ id: string; email: string | null } | null> {
  if (Platform.OS === "web") return null;
  try {
    const raw = await secureChunkStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const user = (JSON.parse(raw) as { user?: { id?: unknown; email?: unknown } } | null)?.user;
    if (!user || typeof user.id !== "string" || !user.id) return null;
    return { id: user.id, email: typeof user.email === "string" ? user.email : null };
  } catch {
    return null;
  }
}

export async function signOutTeam(): Promise<void> {
  await teamAuth?.signOut({ scope: "local" });
}

export async function teamAccessToken(): Promise<string | null> {
  if (!teamAuth) return null;
  const { data } = await teamAuth.getSession();
  return data.session?.access_token ?? null;
}
