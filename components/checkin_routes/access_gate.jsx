"use client";

import React, { useEffect, useState } from "react";
import { Loader2, Lock, ScanLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { validateCheckinCode } from "@/lib/supabase/checkin";

const codeKey = (eventId) => `checkin:code:${eventId}`;
const roleKey = (eventId) => `checkin:role:${eventId}`;

function readSession(eventId) {
  try {
    const code = sessionStorage.getItem(codeKey(eventId));
    const role = sessionStorage.getItem(roleKey(eventId));
    if (code) return { code, role: role ? JSON.parse(role) : null };
  } catch {
    // ignore storage failures
  }
  return null;
}

// Gates a staff route behind a per-event access code. On success it stores the
// validated code + role in sessionStorage and renders children(code, role). A
// `?code=` query param auto-attempts unlock so a shared link opens straight in.
// `require` (e.g. "canSell") fails validation unless the role grants it.
// `codeType` ("staff" | "kiosk") scopes which code space this route accepts —
// staff and kiosk codes are separate, so a leaked kiosk code can't open /door.
export function AccessGate({ eventId, title, subtitle, require: requiredPerm, codeType, children }) {
  const [unlocked, setUnlocked] = useState(null); // { code, role }
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [booting, setBooting] = useState(true);

  const attempt = async (candidate) => {
    const value = String(candidate || "").trim();
    if (!value) {
      setError("Enter the access code.");
      return false;
    }
    setChecking(true);
    setError("");
    const role = await validateCheckinCode(eventId, value, codeType);
    setChecking(false);
    if (!role) {
      setError("That code isn't valid for this event.");
      return false;
    }
    if (requiredPerm && !role?.permissions?.[requiredPerm]) {
      setError("This code doesn't have permission for this action.");
      return false;
    }
    try {
      sessionStorage.setItem(codeKey(eventId), value);
      sessionStorage.setItem(roleKey(eventId), JSON.stringify(role));
    } catch {
      // ignore storage failures
    }
    setUnlocked({ code: value, role });
    return true;
  };

  // Boot: reuse a stored session, else try the URL ?code=.
  useEffect(() => {
    if (!eventId) return;
    let alive = true;
    const boot = async () => {
      const stored = readSession(eventId);
      if (stored?.code) {
        // Re-validate silently so a revoked code doesn't linger.
        const role = await validateCheckinCode(eventId, stored.code, codeType);
        if (!alive) return;
        if (role && (!requiredPerm || role.permissions?.[requiredPerm])) {
          setUnlocked({ code: stored.code, role });
        }
        setBooting(false);
        return;
      }
      const params = new URLSearchParams(window.location.search);
      const urlCode = params.get("code");
      if (urlCode) {
        setCode(urlCode);
        await attempt(urlCode);
        if (alive) setBooting(false);
        return;
      }
      setBooting(false);
    };
    boot();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const exit = () => {
    try {
      sessionStorage.removeItem(codeKey(eventId));
      sessionStorage.removeItem(roleKey(eventId));
    } catch {
      // ignore
    }
    setUnlocked(null);
    setCode("");
  };

  if (booting) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center gap-2 bg-background text-sm text-text-secondary">
        <Loader2 className="h-4 w-4 animate-spin" /> Checking access…
      </div>
    );
  }

  if (unlocked) {
    return children({ code: unlocked.code, role: unlocked.role, exit });
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-6 text-foreground">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-surface-subtle text-muted-foreground">
          <ScanLine className="h-7 w-7" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
          <p className="text-sm text-text-secondary">
            {subtitle || "Enter the staff access code to begin."}
          </p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            attempt(code);
          }}
          className="space-y-3"
        >
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoFocus
            placeholder="Access code"
            className="h-12 text-center text-lg tracking-[0.4em]"
            aria-label="Access code"
          />
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <Button
            type="submit"
            disabled={checking}
            className="h-12 w-full bg-primary text-base text-primary-foreground hover:bg-primary/90"
          >
            {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            {checking ? "Checking…" : "Unlock"}
          </Button>
        </form>
        <p className="text-xs text-text-tertiary">
          Codes are managed under Check-in → Staff Scanning Roles.
        </p>
      </div>
    </div>
  );
}

export default AccessGate;
