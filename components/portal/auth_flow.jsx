"use client";

import React, { useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Loader2, Mail, Ticket, QrCode, CalendarPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/internal/shared/screen_kit";

const FEATURES = [
  { icon: Ticket, label: "All your tickets in one place" },
  { icon: QrCode, label: "Scan to get in at the door" },
  { icon: CalendarPlus, label: "Add events to your calendar" },
];

async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

// Email-first members auth. Steps: email -> password | setup-prompt -> check-email;
// a ?setup= token enters at set-password. First password / reset always goes
// through a one-time emailed link (ownership proof).
export function AuthFlow({ initialSetupToken = null }) {
  const [step, setStep] = useState(initialSetupToken ? "set-password" : "email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

  const submitEmail = async (e) => {
    e.preventDefault();
    setBusy(true);
    const { ok, data } = await postJson("/api/portal/lookup", { email });
    setBusy(false);
    if (!ok) return toast.error(data.error || "Try again.");
    if (data.exists && data.hasPassword) setStep("password");
    else if (data.exists) setStep("setup-prompt");
    else setStep("no-account");
  };

  const submitPassword = async (e) => {
    e.preventDefault();
    setBusy(true);
    const { ok, data } = await postJson("/api/portal/login", { email, password });
    setBusy(false);
    if (!ok) return toast.error(data.error || "Incorrect email or password.");
    window.location.href = `${basePath}/members`;
  };

  const sendSetup = async () => {
    setBusy(true);
    await postJson("/api/portal/request-setup", { email, origin, basePath });
    setBusy(false);
    setStep("check-email");
  };

  const submitSetPassword = async (e) => {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters.");
    setBusy(true);
    const { ok, data } = await postJson("/api/portal/set-password", {
      token: initialSetupToken,
      password,
    });
    setBusy(false);
    if (!ok) return toast.error(data.error || "This link is invalid or expired.");
    window.location.href = `${basePath}/members`;
  };

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-background px-4">
      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
        aria-hidden
      />
      <div className="relative w-full max-w-sm space-y-5 rounded-2xl border border-border bg-surface-subtle p-6 shadow-2xl shadow-black/30">
        <div className="space-y-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-card">
            <Image
              src={`${basePath}/logo1.svg`}
              alt="Geiger Events"
              width={22}
              height={22}
              className="geiger-logo"
              priority
            />
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-semibold text-foreground">Geiger Events</h1>
            <p className="text-sm text-text-secondary">
              Your tickets, orders, and memberships.
            </p>
          </div>
        </div>

        {step === "email" && (
          <form onSubmit={submitEmail} className="space-y-4">
            <Field label="Email">
              <Input
                type="email"
                value={email}
                autoFocus
                required
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
              />
            </Field>
            <Button
              type="submit"
              disabled={busy}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue"}
            </Button>
            <ul className="space-y-2 border-t border-border pt-4">
              {FEATURES.map((f) => (
                <li key={f.label} className="flex items-center gap-2.5 text-xs text-text-secondary">
                  <f.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  {f.label}
                </li>
              ))}
            </ul>
          </form>
        )}

        {step === "password" && (
          <form onSubmit={submitPassword} className="space-y-4">
            <p className="text-sm text-text-secondary">{email}</p>
            <Field label="Password">
              <Input
                type="password"
                value={password}
                autoFocus
                required
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </Field>
            <Button
              type="submit"
              disabled={busy}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Log in"}
            </Button>
            <button
              type="button"
              onClick={sendSetup}
              className="w-full text-xs text-text-tertiary hover:text-muted-foreground"
            >
              Forgot password?
            </button>
          </form>
        )}

        {step === "setup-prompt" && (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              Your account <span className="text-foreground">{email}</span> needs a
              password. We&apos;ll email you a secure link to set one.
            </p>
            <Button
              onClick={sendSetup}
              disabled={busy}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Email me a set-up link"}
            </Button>
          </div>
        )}

        {step === "check-email" && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <Mail className="h-8 w-8 text-text-tertiary" />
            <p className="text-sm text-text-secondary">
              If <span className="text-foreground">{email}</span> has an account, a
              link is on its way. Check your inbox to set your password.
            </p>
          </div>
        )}

        {step === "no-account" && (
          <div className="space-y-3 text-center">
            <p className="text-sm text-text-secondary">
              We couldn&apos;t find an account for{" "}
              <span className="text-foreground">{email}</span>. Buy a ticket to any
              event and your account is created automatically.
            </p>
            <button
              type="button"
              onClick={() => setStep("email")}
              className="text-xs text-text-tertiary hover:text-muted-foreground"
            >
              Try another email
            </button>
          </div>
        )}

        {step === "set-password" && (
          <form onSubmit={submitSetPassword} className="space-y-4">
            <p className="text-sm text-text-secondary">
              Choose a password for your account.
            </p>
            <Field label="New password" hint="At least 8 characters.">
              <Input
                type="password"
                value={password}
                autoFocus
                required
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </Field>
            <Button
              type="submit"
              disabled={busy}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Set password & sign in"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

export default AuthFlow;
