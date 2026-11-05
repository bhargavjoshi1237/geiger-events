"use client";

import React, { useState } from "react";
import { ArrowLeft, Fingerprint, Github, Globe, KeyRound, Loader2, RotateCw } from "lucide-react";

import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Label } from "@geiger/ui/label";
import { Separator } from "@geiger/ui/separator";
import { DesktopShell, ErrorNote, StatePanel } from "./desktop_states";

// Brand mark, not in Lucide; copied from the suite login.
function GoogleIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

// Provider ids match OAUTH_PROVIDERS in lib/desktop/config.js.
const PROVIDER_BUTTONS = [
  { provider: "google", label: "Continue with Google", icon: GoogleIcon },
  { provider: "github", label: "Continue with GitHub", icon: Github },
];

function MethodButton({ icon: Icon, onClick, children }) {
  return (
    <Button type="button" variant="outline" size="lg" className="w-full" onClick={onClick}>
      <Icon className="size-4" />
      {children}
    </Button>
  );
}

function SubmitButton({ pending = false, children }) {
  return (
    <Button
      type="submit"
      variant="secondary"
      size="lg"
      disabled={pending}
      className="w-full border border-border bg-surface-subtle hover:bg-surface-hover"
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : null}
      {children}
    </Button>
  );
}

function SsoForm({ email, onEmailChange, onSubmit, onBack }) {
  const handleSubmit = (event) => {
    event.preventDefault();
    const value = email.trim();
    if (value) onSubmit(value);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="desktop-sso-email">Work email</Label>
        <Input
          id="desktop-sso-email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          required
          autoFocus
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
        />
      </div>
      <SubmitButton>Continue in your browser</SubmitButton>
      <button
        type="button"
        onClick={onBack}
        className="mx-auto flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back to sign in
      </button>
    </form>
  );
}

function PasswordForm({ email, onEmailChange, onSubmit }) {
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setPending(true);
    await onSubmit(email.trim(), password);
    setPending(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="desktop-email">Email</Label>
        <Input
          id="desktop-email"
          type="email"
          autoComplete="email"
          placeholder="Your email address"
          required
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="desktop-password">Password</Label>
        <Input
          id="desktop-password"
          type="password"
          autoComplete="current-password"
          placeholder="Your password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      <SubmitButton pending={pending}>{pending ? "Signing in…" : "Continue"}</SubmitButton>
    </form>
  );
}

// `onBrowserSignIn(method, email?)` hands off to the system browser; `onPasswordSignIn` signs in here.
export function DesktopSignIn({ error, preview, onBrowserSignIn, onPasswordSignIn }) {
  const [ssoMode, setSsoMode] = useState(false);
  const [email, setEmail] = useState("");

  return (
    <DesktopShell>
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-medium tracking-tight text-foreground">Welcome to Geiger</h1>
          <p className="text-sm text-muted-foreground">
            {ssoMode ? "Sign in with your organization's SSO" : "Sign in to open Geiger Events"}
          </p>
        </div>

        {error ? <ErrorNote>{error}</ErrorNote> : null}

        {ssoMode ? (
          <SsoForm
            email={email}
            onEmailChange={setEmail}
            onSubmit={(value) => onBrowserSignIn("sso", value)}
            onBack={() => setSsoMode(false)}
          />
        ) : (
          <>
            <div className="space-y-3">
              {PROVIDER_BUTTONS.map(({ provider, label, icon }) => (
                <MethodButton key={provider} icon={icon} onClick={() => onBrowserSignIn(provider)}>
                  {label}
                </MethodButton>
              ))}
              <MethodButton icon={KeyRound} onClick={() => setSsoMode(true)}>
                Continue with SSO
              </MethodButton>
              <MethodButton icon={Fingerprint} onClick={() => onBrowserSignIn("passkey")}>
                Sign in with a passkey
              </MethodButton>
            </div>

            <div className="flex items-center gap-3 text-xs text-text-tertiary">
              <Separator className="flex-1" />
              or
              <Separator className="flex-1" />
            </div>

            <PasswordForm email={email} onEmailChange={setEmail} onSubmit={onPasswordSignIn} />
          </>
        )}

        {preview ? (
          <p className="text-center text-xs text-text-tertiary">
            Browser preview — sign-in via browser needs the desktop app
          </p>
        ) : null}
      </div>
    </DesktopShell>
  );
}

export function DesktopWaiting({ onReopen, onCancel }) {
  return (
    <DesktopShell>
      <StatePanel
        icon={Globe}
        title="Finish signing in in your browser"
        description="We opened geiger.studio in your browser. Sign in there and you'll come straight back here."
      >
        <Button type="button" variant="outline" onClick={onReopen}>
          <RotateCw className="size-4" />
          Open the browser again
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </StatePanel>
    </DesktopShell>
  );
}
