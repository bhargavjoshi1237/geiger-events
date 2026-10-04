"use client";

import { useState } from "react";
import { Button } from "@geiger/ui";
import { createWorkflowClient } from "@/components/internal/screens/operations/workflow_client";
import { fieldClass, WorkflowCard } from "@/components/internal/screens/operations/workflow_forms";

const client = createWorkflowClient();

export function OperationsAuth({ eventId, invitationToken, setupToken, onSignedIn }) {
  const [mode, setMode] = useState(setupToken ? "setup" : "login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true); setError(null); setNotice(null);
    try {
      const response = mode === "register" ? await client.auth("operations/invitations/register", { eventId, token: invitationToken, email, name, password })
        : mode === "setup" ? await client.auth("set-password", { token: setupToken, password })
        : await client.auth("login", { email, password });
      if (response.error) { setError(response.error); return; }
      // Verify the session cookie before exposing participant controls.
      const verification = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/portal/me`, { credentials: "same-origin", cache: "no-store" });
      const payload = await verification.json().catch(() => null);
      if (!verification.ok || !payload?.member) { setError({ message: "Sign-in could not be verified. Reload this page and sign in again." }); return; }
      setPassword("");
      onSignedIn(payload.member);
    } catch { setError({ message: "Could not connect. Try again." }); }
    finally { setBusy(false); }
  };
  const requestSetup = async () => {
    if (!email) { setError({ message: "Enter your account email first." }); return; }
    setBusy(true); setError(null); setNotice(null);
    try {
      const response = await client.auth("request-setup", { email, origin: window.location.origin, basePath: process.env.NEXT_PUBLIC_BASE_PATH || "" });
      if (response.error) setError(response.error);
      else setNotice("If your account exists, a password setup link has been requested. After setting your password, return to this invitation URL to continue.");
    } catch { setError({ message: "Could not request account setup." }); }
    finally { setBusy(false); }
  };
  return <div className="mx-auto w-full max-w-xl"><WorkflowCard title={mode === "register" ? "Create your invited account" : mode === "setup" ? "Set your account password" : "Sign in to event operations"}
    description="Use the email address on your invitation. You can access assigned work after signing in and accepting the invitation.">
    {mode !== "setup" ? <div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant={mode === "login" ? "secondary" : "outline"} disabled={busy} onClick={() => { setMode("login"); setError(null); }}>Existing account</Button>
      {invitationToken ? <Button type="button" size="sm" variant={mode === "register" ? "secondary" : "outline"} disabled={busy} onClick={() => { setMode("register"); setError(null); }}>Create invited account</Button> : null}</div> : null}
    <form onSubmit={submit} className="space-y-4"><fieldset disabled={busy} className="space-y-4">
      {mode === "register" ? <label className="block space-y-1.5 text-sm"><span className="font-medium">Your name</span><input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} maxLength={200} required autoComplete="name" /></label> : null}
      {mode !== "setup" ? <label className="block space-y-1.5 text-sm"><span className="font-medium">Email</span><input className={fieldClass} type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label> : null}
      <label className="block space-y-1.5 text-sm"><span className="font-medium">Password</span><input className={fieldClass} type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={mode === "register" ? 12 : mode === "setup" ? 8 : 1} maxLength={256} autoComplete={mode === "login" ? "current-password" : "new-password"} />
        {mode === "register" ? <span className="block text-xs text-muted-foreground">At least 12 characters.</span> : null}</label>
    </fieldset>
      {error ? <p role="alert" className="text-sm text-destructive">{error.message}{error.code === "existing_account" ? " Use Existing account to sign in." : ""}</p> : null}
      {notice ? <p role="status" className="text-sm text-muted-foreground">{notice}</p> : null}
      <Button type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "register" ? "Create account" : mode === "setup" ? "Set password" : "Sign in"}</Button>
      {mode === "login" ? <Button type="button" variant="ghost" disabled={busy} onClick={requestSetup}>Set up or reset password</Button> : null}
    </form>
  </WorkflowCard></div>;
}
