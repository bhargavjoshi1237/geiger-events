"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { Loader2, LogOut, ShieldCheck, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, ScreenHeader } from "@/components/internal/shared/screen_kit";
import { SecondaryScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { initials } from "./portal_kit";

// Simple flat section: a divider, heading + hint, then the controls — no card.
function Section({ title, description, children }) {
  return (
    <section className="border-t border-border pt-6">
      <div className="mb-4 max-w-md">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description ? (
          <p className="mt-1 text-xs text-text-secondary">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export function PortalAccount({ member, onMemberChange }) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

  const [name, setName] = useState(member?.name || "");
  const [phone, setPhone] = useState(member?.metadata?.phone || "");
  const [savingProfile, setSavingProfile] = useState(false);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  const [busyOut, setBusyOut] = useState(false);

  const dirty = name !== (member?.name || "") || phone !== (member?.metadata?.phone || "");

  const saveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    const { ok, data } = await postJson("/api/portal/profile", { name, phone });
    setSavingProfile(false);
    if (!ok) return toast.error(data.error || "Couldn't save your profile.");
    toast.success("Profile updated.");
    onMemberChange?.({
      ...member,
      name: data.name,
      metadata: { ...(member?.metadata || {}), phone: data.phone },
    });
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (next.length < 8) return toast.error("New password must be at least 8 characters.");
    if (next !== confirm) return toast.error("New passwords don't match.");
    setSavingPw(true);
    const { ok, data } = await postJson("/api/portal/change-password", {
      currentPassword: current,
      newPassword: next,
    });
    setSavingPw(false);
    if (!ok) return toast.error(data.error || "Couldn't update your password.");
    setCurrent("");
    setNext("");
    setConfirm("");
    toast.success("Password updated.");
  };

  const signOut = async (all) => {
    setBusyOut(true);
    await postJson(all ? "/api/portal/logout-all" : "/api/portal/logout");
    toast.success(all ? "Signed out on all devices." : "Signed out.");
    window.location.href = `${basePath}/login`;
  };

  return (
    <SecondaryScreenWrapper>
      <ScreenHeader
        title="Account"
        description="Manage your profile, password, and sessions."
      />
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-strong text-lg font-semibold text-foreground">
          {initials(member?.name, member?.email)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-foreground">
            {member?.name || "Your account"}
          </p>
          <p className="truncate text-sm text-text-secondary">{member?.email}</p>
        </div>
      </div>

      <Section title="Profile" description="How your name appears on tickets and receipts.">
        <form onSubmit={saveProfile} className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </Field>
          <Field label="Phone" hint="Optional — used for event updates.">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 000 0000" />
          </Field>
          <Field label="Email">
            <Input value={member?.email || ""} disabled className="opacity-70" />
          </Field>
          <div className="flex items-end sm:col-span-2">
            <Button
              type="submit"
              disabled={!dirty || savingProfile}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <User className="h-4 w-4" />}
              Save changes
            </Button>
          </div>
        </form>
      </Section>

      <Section title="Password" description="Change the password you use to sign in.">
        <form onSubmit={changePassword} className="grid gap-4 sm:grid-cols-2">
          <Field label="Current password" className="sm:col-span-2 sm:max-w-xs">
            <Input
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </Field>
          <Field label="New password" hint="At least 8 characters.">
            <Input
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </Field>
          <Field label="Confirm new password">
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </Field>
          <div className="sm:col-span-2">
            <Button
              type="submit"
              disabled={savingPw}
              variant="outline"
              className="border-border bg-surface-card text-foreground hover:bg-surface-hover"
            >
              {savingPw ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Update password
            </Button>
          </div>
        </form>
      </Section>

      <Section title="Sessions" description="Sign out of this device, or everywhere at once.">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busyOut}
            onClick={() => signOut(false)}
            className="border-border bg-surface-card text-foreground hover:bg-surface-hover"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busyOut}
            onClick={() => signOut(true)}
            className="border-border bg-transparent text-red-400 hover:bg-red-500/10 hover:text-red-400"
          >
            Sign out of all devices
          </Button>
        </div>
      </Section>
    </SecondaryScreenWrapper>
  );
}

export default PortalAccount;
