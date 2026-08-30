"use client";

import React, { useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { ArrowRight, Bell, Loader2, Mail, QrCode, WifiOff } from "lucide-react";

import { Button } from "@geiger/ui/button";
import { cn } from "@/lib/utils";
import { portalPostJson } from "@/lib/portal/portal_fetch";

const FEATURES = [
  { icon: QrCode, label: "Scan to get in at the door" },
  { icon: Bell, label: "Push for gate changes and refunds" },
  { icon: WifiOff, label: "Passes work with no signal" },
];

// basePath-aware; see lib/portal/portal_fetch.js for why bare fetch() breaks in
// production.
const postJson = portalPostJson;

// Mockup-styled field. Deliberately a bare <input> rather than the shared
// <Input>, whose radius/padding are pinned with !important utilities we'd have
// to fight to get the taller rounded look (and the inline mail icon).
const FIELD_CLASS =
  "h-[52px] w-full rounded-[14px] border border-border bg-surface-card px-4 text-[16px] text-foreground shadow-none outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/50";

// White pill CTA — the mockup's black-on-white button.
const CTA_CLASS =
  "h-[52px] w-full rounded-[14px] bg-primary text-[17px] font-semibold tracking-[-0.01em] text-primary-foreground hover:bg-primary/90";

// Email-first members auth. Steps: email -> password | setup-prompt -> check-email;
// a ?setup= token enters at set-password. First password / reset always goes
// through a one-time emailed link (ownership proof).
export function AuthFlow({ initialSetupToken = null, workspace = false }) {
  const [step, setStep] = useState(initialSetupToken ? "set-password" : "email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  // Where a successful sign-in lands: back to the internal workspace when the
  // visitor came from there, otherwise the members portal.
  const successUrl = `${basePath}${workspace ? "/project" : "/members"}`;

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
    window.location.href = successUrl;
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
    window.location.href = successUrl;
  };

  return (
    // Single flex column: content block grows, feature list sits after it — so
    // the footer is laid out once against the layout viewport and never moves
    // when the keyboard overlays the screen (see /login viewport export).
    // The `dark` class pins this screen to the dark palette from the mockup
    // regardless of the visitor's system theme.
    <div className="dark relative flex min-h-[100dvh] flex-col bg-background">
      <main className="mx-auto w-full max-w-sm flex-1 px-6 pb-12 pt-[max(6rem,16dvh)]">
        <Image
          src={`${basePath}/logo1.svg`}
          alt="Geiger Events"
          width={36}
          height={22}
          className="mb-10"
          priority
        />
        <h1 className="text-[32px] font-bold leading-[1.1] tracking-[-0.02em] text-foreground">
          Your tickets,
          <br />
          ready at the door.
        </h1>

        {step === "email" && (
          <>
            <p className="mt-4 max-w-[21rem] text-[15px] leading-relaxed text-text-secondary">
              {workspace
                ? "Sign in to open your workspace."
                : "Sign in with the email you bought with — your account already exists."}
            </p>
            <form onSubmit={submitEmail} className="mt-7 space-y-5">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  autoFocus
                  required
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  aria-label="Email"
                  autoComplete="email"
                  className={cn(FIELD_CLASS, "pl-11")}
                />
              </div>
              <Button type="submit" disabled={busy} className={CTA_CLASS}>
                Continue
                {busy ? (
                  <Loader2 className="size-[18px] animate-spin" />
                ) : (
                  <ArrowRight className="size-[18px]" />
                )}
              </Button>
            </form>
          </>
        )}

        {step === "password" && (
          <>
            <p className="mt-4 max-w-[21rem] text-[15px] leading-relaxed text-text-secondary">
              Signing in as{" "}
              <span className="text-foreground">{email}</span>
            </p>
            <form onSubmit={submitPassword} className="mt-7 space-y-5">
              <input
                type="password"
                value={password}
                autoFocus
                required
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                aria-label="Password"
                autoComplete="current-password"
                className={FIELD_CLASS}
              />
              <Button type="submit" disabled={busy} className={CTA_CLASS}>
                Log in
                {busy ? (
                  <Loader2 className="size-[18px] animate-spin" />
                ) : (
                  <ArrowRight className="size-[18px]" />
                )}
              </Button>
              <button
                type="button"
                onClick={sendSetup}
                className="w-full pt-1 text-center text-xs text-text-tertiary transition-colors hover:text-foreground"
              >
                Forgot password?
              </button>
            </form>
          </>
        )}

        {step === "setup-prompt" && (
          <div className="mt-8 space-y-3">
            <p className="max-w-[38ch] text-sm leading-relaxed text-text-secondary">
              Your account <span className="text-foreground">{email}</span> needs a
              password. We&apos;ll email you a secure link to set one.
            </p>
            <Button onClick={sendSetup} disabled={busy} className={CTA_CLASS}>
              Email me a set-up link
              {busy ? (
                <Loader2 className="size-[18px] animate-spin" />
              ) : (
                <ArrowRight className="size-[18px]" />
              )}
            </Button>
          </div>
        )}

        {step === "check-email" && (
          <div className="mt-8 flex items-start gap-3">
            <Mail className="mt-0.5 size-[18px] shrink-0 text-text-tertiary" />
            <p className="max-w-[38ch] text-sm leading-relaxed text-text-secondary">
              If <span className="text-foreground">{email}</span> has an account, a
              link is on its way. Check your inbox to set your password.
            </p>
          </div>
        )}

        {step === "no-account" && (
          <div className="mt-8 space-y-3">
            <p className="max-w-[38ch] text-sm leading-relaxed text-text-secondary">
              We couldn&apos;t find an account for{" "}
              <span className="text-foreground">{email}</span>. Buy a ticket to any
              event and your account is created automatically.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep("email")}
              className="h-11 w-full rounded-[14px] border-border bg-transparent text-sm font-medium text-foreground hover:bg-surface-hover"
            >
              Try another email
            </Button>
          </div>
        )}

        {step === "set-password" && (
          <>
            <p className="mt-4 max-w-[36ch] text-[15px] leading-relaxed text-text-secondary">
              Choose a password for your account.
            </p>
            <form onSubmit={submitSetPassword} className="mt-7 space-y-5">
              <input
                type="password"
                value={password}
                autoFocus
                required
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                aria-label="New password"
                autoComplete="new-password"
                className={FIELD_CLASS}
              />
              <p className="text-xs text-text-tertiary">At least 8 characters.</p>
              <Button type="submit" disabled={busy} className={CTA_CLASS}>
                Set password &amp; sign in
                {busy ? (
                  <Loader2 className="size-[18px] animate-spin" />
                ) : (
                  <ArrowRight className="size-[18px]" />
                )}
              </Button>
            </form>
          </>
        )}
      </main>

      {/* Pinned to the bottom of the layout viewport (main's flex-1 pushes it
          there). With interactiveWidget=resizes-visual on /login the keyboard
          covers it instead of pushing it up, so it never shifts while typing.
          Skipped in workspace context and emailed set-up links. */}
      {!workspace && !initialSetupToken ? (
        <footer className="mx-auto w-full max-w-sm shrink-0 px-6 pb-[calc(1.75rem+env(safe-area-inset-bottom))]">
          <ul className="space-y-3">
            {FEATURES.map((f) => (
              <li
                key={f.label}
                className="flex items-center gap-3 text-[13px] text-text-secondary"
              >
                <f.icon className="size-4 shrink-0 text-muted-foreground" />
                {f.label}
              </li>
            ))}
          </ul>
        </footer>
      ) : null}
    </div>
  );
}

export default AuthFlow;
