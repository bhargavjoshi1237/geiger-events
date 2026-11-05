"use client";

import React, { useCallback, useEffect, useReducer, useRef, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";

import { createAuthState, getDesktopBridge } from "@/lib/desktop/bridge";
import { consumeAuthState, forgetAuthState, openInBrowser, rememberAuthState } from "@/lib/desktop/browser";
import { OAUTH_PROVIDERS, browserLoginUrl, desktopPath, ssoUrl } from "@/lib/desktop/config";
import { createDesktopClient } from "@/lib/desktop/supabase";
import { DesktopOrgPicker } from "./desktop_org_picker";
import { DesktopSignIn, DesktopWaiting } from "./desktop_sign_in";
import { BrowserOnlyState, DesktopLoading } from "./desktop_states";

const MISMATCH = "That sign-in link didn't match. Please try again.";
const INCOMPLETE = "Sign-in didn't complete. Please try again.";
const BROWSER_FAILED = "Couldn't open your browser. Please try again.";
const SIGN_OUT_FAILED = "Couldn't sign out. Check your connection and try again.";

const subscribeNothing = () => () => {};
const hasBridge = () => getDesktopBridge() !== null;
const unknownOnServer = () => null;

const INITIAL = { view: "boot", user: null, error: "", browserUrl: "" };

function toUser(user) {
  return { id: user.id, email: user.email || "" };
}

function reducer(state, action) {
  switch (action.type) {
    // The boot check only decides the first screen; anything that already moved on wins.
    case "booted":
      if (state.view !== "boot") return state;
      return action.user ? { ...INITIAL, view: "orgs", user: toUser(action.user) } : { ...INITIAL, view: "sign-in" };
    case "signed-in":
      return { ...INITIAL, view: "orgs", user: toUser(action.user) };
    case "signed-out":
      return { ...INITIAL, view: "sign-in", error: action.error || "" };
    case "waiting":
      return { ...INITIAL, view: "waiting", browserUrl: action.url };
    case "verifying":
      return { ...INITIAL, view: "verifying" };
    // A callback with no sign-in on record is a stale repeat unless the user is waiting for one.
    case "unmatched":
      return state.view === "waiting" ? { ...INITIAL, view: "sign-in", error: MISMATCH } : state;
    default:
      return state;
  }
}

// Passkeys run on the suite login page itself, so they get the plain login URL.
function browserSignInUrl(method, authState, email) {
  if (method === "sso") return ssoUrl(authState, email);
  return OAUTH_PROVIDERS.includes(method) ? browserLoginUrl(authState, method) : browserLoginUrl(authState);
}

function DesktopFlow({ preview }) {
  const searchParams = useSearchParams();
  const [signOutFirst] = useState(() => searchParams.get("signout") === "1");
  const [supabase] = useState(createDesktopClient);
  const [state, dispatch] = useReducer(reducer, INITIAL);
  // The pending copy and the live event can both deliver one callback.
  const handledRef = useRef(new Set());

  const completeBrowserSignIn = useCallback(
    async (payload) => {
      const key = payload ? `${payload.state}|${payload.tokenHash || payload.error}` : "";
      if (!key || handledRef.current.has(key)) return;
      handledRef.current.add(key);

      const match = consumeAuthState(payload.state);
      if (match === "missing") return dispatch({ type: "unmatched" });
      if (match !== "ok") return dispatch({ type: "signed-out", error: MISMATCH });
      if (payload.error || !payload.tokenHash) return dispatch({ type: "signed-out", error: INCOMPLETE });

      dispatch({ type: "verifying" });
      try {
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: payload.tokenHash,
          type: payload.type || "magiclink",
        });
        if (error || !data?.user) dispatch({ type: "signed-out", error: error?.message || INCOMPLETE });
        else dispatch({ type: "signed-in", user: data.user });
      } catch {
        dispatch({ type: "signed-out", error: INCOMPLETE });
      }
    },
    [supabase],
  );

  useEffect(() => {
    const bridge = getDesktopBridge();
    // The shell also buffers live callbacks; drain that copy so a later load doesn't replay it.
    const unsubscribe = bridge?.onAuthCallback((payload) => {
      bridge.takePendingAuth().catch(() => null);
      completeBrowserSignIn(payload);
    });

    (async () => {
      try {
        if (signOutFirst) {
          await supabase.auth.signOut({ scope: "local" });
          // Native history, not router.replace: the router would prefix the basePath a second time.
          window.history.replaceState(null, "", desktopPath());
        }
        const [pending, { data }] = await Promise.all([
          bridge ? bridge.takePendingAuth().catch(() => null) : null,
          supabase.auth.getUser(),
        ]);
        dispatch({ type: "booted", user: data?.user ?? null });
        if (pending) completeBrowserSignIn(pending);
      } catch {
        dispatch({ type: "booted", user: null });
      }
    })();

    return () => unsubscribe?.();
  }, [supabase, signOutFirst, completeBrowserSignIn]);

  const openOrGiveUp = async (url) => {
    if (await openInBrowser(url)) return;
    forgetAuthState();
    dispatch({ type: "signed-out", error: BROWSER_FAILED });
  };

  const startBrowserSignIn = (method, email) => {
    const authState = createAuthState();
    const url = browserSignInUrl(method, authState, email);
    rememberAuthState(authState);
    dispatch({ type: "waiting", url });
    openOrGiveUp(url);
  };

  const cancelBrowserSignIn = () => {
    forgetAuthState();
    dispatch({ type: "signed-out" });
  };

  const signInWithPassword = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data?.user) dispatch({ type: "signed-out", error: error?.message || INCOMPLETE });
      else dispatch({ type: "signed-in", user: data.user });
    } catch {
      dispatch({ type: "signed-out", error: INCOMPLETE });
    }
  };

  // Local scope ends only this app's session, not the user's browser or other devices.
  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) return error.message || SIGN_OUT_FAILED;
    } catch {
      return SIGN_OUT_FAILED;
    }
    dispatch({ type: "signed-out" });
    return "";
  };

  if (state.view === "sign-in") {
    return (
      <DesktopSignIn
        error={state.error}
        preview={preview}
        onBrowserSignIn={startBrowserSignIn}
        onPasswordSignIn={signInWithPassword}
      />
    );
  }
  if (state.view === "waiting") {
    return <DesktopWaiting onReopen={() => openOrGiveUp(state.browserUrl)} onCancel={cancelBrowserSignIn} />;
  }
  if (state.view === "orgs") {
    return <DesktopOrgPicker supabase={supabase} user={state.user} onSignOut={signOut} />;
  }
  return <DesktopLoading label={state.view === "verifying" ? "Signing you in" : "Loading"} />;
}

// The flow needs the desktop shell's bridge; dev keeps it reachable in a browser for previewing.
export function DesktopApp() {
  const bridgePresent = useSyncExternalStore(subscribeNothing, hasBridge, unknownOnServer);
  if (bridgePresent === null) return <DesktopLoading />;
  if (!bridgePresent && process.env.NODE_ENV === "production") return <BrowserOnlyState />;
  return <DesktopFlow preview={!bridgePresent} />;
}
