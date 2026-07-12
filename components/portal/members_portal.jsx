"use client";

import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import AuthFlow from "./auth_flow";
import PortalShell from "./portal_shell";

// Members portal root (auth gate). A `?setup=<token>` link jumps straight to the
// set-password form; otherwise we resolve the session via /api/portal/me.
export function MembersPortal() {
  const [state, setState] = useState({
    loading: true,
    member: null,
    setupToken: null,
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const setupToken = params.get("setup");
      if (setupToken) {
        if (alive) setState({ loading: false, member: null, setupToken });
        return;
      }
      try {
        const r = await fetch("/api/portal/me");
        const d = await r.json();
        if (alive) setState({ loading: false, member: d.member, setupToken: null });
      } catch {
        if (alive) setState({ loading: false, member: null, setupToken: null });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (state.loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center gap-2 bg-background text-sm text-text-secondary">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }
  if (state.member) return <PortalShell member={state.member} />;
  return <AuthFlow initialSetupToken={state.setupToken} />;
}

export default MembersPortal;
