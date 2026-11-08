"use client";

import React, { useEffect, useRef, useState } from "react";
import { CircleAlert, CircleCheck, Compass } from "lucide-react";

import { Button } from "@geiger/ui/button";
import { suiteUrl } from "@/lib/desktop/config";
import { handoffDeepLink } from "@/lib/desktop/handoff_link";
import { DesktopLoading, DesktopShell, StatePanel, useHydrated } from "./desktop_states";

// The handoff route puts the result in the fragment; null when there's nothing to hand over.
function readHandoff() {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const error = params.get("error") || "";
  const tokenHash = params.get("token_hash") || "";
  if (!error && !tokenHash) return null;
  return {
    error,
    tokenHash,
    type: params.get("type") || "magiclink",
    state: params.get("state") || "",
    email: params.get("email") || "",
  };
}

function ReturnContent() {
  const [handoff] = useState(readHandoff);
  const deepLink = handoff ? handoffDeepLink(handoff) : "";
  // Strict mode re-runs effects; the app should only be opened once.
  const firedRef = useRef(false);

  useEffect(() => {
    if (!deepLink || firedRef.current) return;
    firedRef.current = true;
    // Drop the one-time token from the address bar and history before handing it to the app.
    window.history.replaceState(null, "", window.location.pathname);
    window.location.href = deepLink;
  }, [deepLink]);

  if (!handoff) {
    return (
      <StatePanel
        icon={Compass}
        title="Nothing to do here"
        description="This page finishes signing in to the Geiger Events desktop app."
      >
        <Button asChild variant="outline">
          <a href={suiteUrl("/org")}>Open the dashboard</a>
        </Button>
      </StatePanel>
    );
  }

  if (handoff.error) {
    return (
      <StatePanel
        icon={CircleAlert}
        title="Sign-in didn't complete"
        description="Go back to the Geiger Events app and try again."
      />
    );
  }

  return (
    <StatePanel
      icon={CircleCheck}
      title="You're signed in"
      description={`Signed in as ${handoff.email}. Return to the Geiger Events app to continue.`}
      note="Didn't open? Make sure the desktop app is installed."
    >
      <Button asChild>
        <a href={deepLink}>Open Geiger Events</a>
      </Button>
    </StatePanel>
  );
}

// Runs in the system browser after the suite handoff; the fragment only exists on the client.
export function DesktopReturn() {
  const hydrated = useHydrated();
  if (!hydrated) return <DesktopLoading />;
  return (
    <DesktopShell>
      <ReturnContent />
    </DesktopShell>
  );
}
