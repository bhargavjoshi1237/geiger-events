"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { Button, Input, InputOTP, InputOTPGroup, InputOTPSlot, Label } from "@geiger/ui";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Email → 6-digit code sign-in, used by the sign-in screen and by public forms before they submit.
export function CodeSignIn({ signIn, onDone, email: initialEmail = "", submitLabel = "Send me a code", autoFocus = true }) {
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return undefined;
    const timer = setTimeout(() => setWait((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  const send = async (event) => {
    event?.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!EMAIL.test(clean)) { setError("Enter a valid email address."); return; }
    setBusy(true);
    setError(null);
    const { error: failed } = await signIn.request(clean);
    setBusy(false);
    if (failed) { setError(failed.message); return; }
    setEmail(clean);
    setCode("");
    setStep("code");
    setWait(30);
  };

  const verify = async (value = code) => {
    if (value.length !== 6) return;
    setBusy(true);
    setError(null);
    const { error: failed } = await signIn.verify(email, value);
    setBusy(false);
    if (failed) { setError(failed.message); setCode(""); return; }
    onDone?.(email);
  };

  if (step === "email") {
    return (
      <form onSubmit={send} className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="wp-sign-in-email">Email</Label>
          <Input id="wp-sign-in-email" type="email" autoComplete="email" autoFocus={autoFocus} placeholder="you@example.com"
            value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>
        {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
        <Button type="submit" disabled={busy || !email.trim()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}{submitLabel}
        </Button>
      </form>
    );
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm text-text-secondary">
        We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>. It expires in 10 minutes.
      </p>
      <div className="grid gap-1.5">
        <Label htmlFor="wp-sign-in-code">Code</Label>
        <InputOTP id="wp-sign-in-code" maxLength={6} inputMode="numeric" autoComplete="one-time-code" autoFocus value={code} disabled={busy}
          onChange={(value) => { const digits = value.replace(/\D/g, ""); setCode(digits); if (digits.length === 6) verify(digits); }}>
          <InputOTPGroup>
            {Array.from({ length: 6 }, (_, index) => <InputOTPSlot key={index} index={index} className="h-11 w-11 text-base" />)}
          </InputOTPGroup>
        </InputOTP>
      </div>
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      <Button onClick={() => verify()} disabled={busy || code.length !== 6}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Continue
      </Button>
      <div className="flex items-center justify-between gap-3 text-sm">
        <button type="button" className="inline-flex items-center gap-1 text-text-secondary hover:text-foreground" onClick={() => { setStep("email"); setError(null); }}>
          <ArrowLeft className="h-3.5 w-3.5" />Use another email
        </button>
        <button type="button" disabled={wait > 0 || busy} className="text-text-secondary hover:text-foreground disabled:opacity-50" onClick={() => send()}>
          {wait > 0 ? `Resend in ${wait}s` : "Resend code"}
        </button>
      </div>
    </div>
  );
}
