"use client";

import React, { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { BellPlus, Check, Globe, Loader2, MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/internal/shared/screen_kit";
import { cn } from "@/lib/utils";
import { followOrganiser } from "@/lib/supabase/discovery";

// Public "Follow" control on the /w/<slug> wall. Anonymous buyers subscribe with
// an email; a localStorage flag remembers the follow so the button reflects it
// across visits (the follow itself is deduped server-side by the RPC). The flag
// is read through useSyncExternalStore so the localStorage access stays out of
// render and survives cross-tab changes.
const FOLLOW_CHANGED = "geiger:following-changed";

function followKey(projectId) {
  return `geiger:following:${projectId}`;
}

function subscribeFollowing(cb) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", cb);
  window.addEventListener(FOLLOW_CHANGED, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(FOLLOW_CHANGED, cb);
  };
}

function readFollowing(projectId) {
  if (typeof window === "undefined" || !projectId) return false;
  try {
    return window.localStorage.getItem(followKey(projectId)) === "1";
  } catch {
    return false;
  }
}

export function FollowButton({ projectId, organiserName }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const following = useSyncExternalStore(
    subscribeFollowing,
    () => readFollowing(projectId),
    () => false,
  );

  const submit = async () => {
    const value = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
      toast.error("Enter a valid email address.");
      return;
    }
    setSaving(true);
    const ok = await followOrganiser(projectId, value, name.trim());
    setSaving(false);
    if (!ok) {
      toast.error("Couldn't follow right now. Please try again.");
      return;
    }
    try {
      window.localStorage.setItem(followKey(projectId), "1");
      window.dispatchEvent(new Event(FOLLOW_CHANGED));
    } catch {
      // Non-fatal.
    }
    setOpen(false);
    setEmail("");
    setName("");
    toast.success("You're following — we'll email you about new events.");
  };

  if (following) {
    return (
      <Button
        variant="outline"
        className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
        disabled
      >
        <Check className="h-4 w-4" /> Following
      </Button>
    );
  }

  return (
    <>
      <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setOpen(true)}>
        <BellPlus className="h-4 w-4" /> Follow
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Follow {organiserName || "this organiser"}
            </DialogTitle>
            <DialogDescription>
              Get an email when new events go live. Unsubscribe anytime.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <Field label="Email" htmlFor="follow-email">
              <Input
                id="follow-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
            </Field>
            <Field label="Name" hint="Optional" htmlFor="follow-name">
              <Input
                id="follow-name"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={submit}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellPlus className="h-4 w-4" />}
              Follow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Organiser identity bar shown on the public wall above the event list. Sources
// its fields from the profile, falling back to the wall's own branding. Rendered
// only when a profile row exists.
export function OrganiserProfileHeader({ profile, wall, centered }) {
  if (!profile) return null;
  const name = profile.displayName || wall?.name || "Our Events";
  const bio = profile.bio || "";
  const links = Array.isArray(profile.links) ? profile.links.filter((l) => l?.url) : [];

  return (
    <div
      className={cn(
        "mb-10 flex flex-col gap-4 rounded-2xl border border-border bg-surface-subtle p-5 sm:p-6",
        centered ? "items-center text-center" : "items-start",
      )}
    >
      <div className={cn("flex w-full flex-col gap-4 sm:flex-row sm:items-center", centered && "sm:justify-center")}>
        {profile.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatarUrl}
            alt=""
            className="h-16 w-16 shrink-0 rounded-full border border-border object-cover"
          />
        ) : null}
        <div className={cn("min-w-0 flex-1", centered && "text-center")}>
          <h2 className="text-xl font-semibold text-foreground">{name}</h2>
          {profile.location ? (
            <p className={cn("mt-1 flex items-center gap-1.5 text-sm text-text-secondary", centered && "justify-center")}>
              <MapPin className="h-3.5 w-3.5" /> {profile.location}
            </p>
          ) : null}
        </div>
        <div className="shrink-0">
          <FollowButton projectId={profile.projectId || wall?.projectId} organiserName={name} />
        </div>
      </div>

      {bio ? (
        <p className={cn("max-w-2xl text-sm text-text-secondary", centered && "mx-auto")}>{bio}</p>
      ) : null}

      {links.length || profile.website ? (
        <div className={cn("flex flex-wrap gap-x-4 gap-y-1.5", centered && "justify-center")}>
          {profile.website ? (
            <a
              href={profile.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-foreground"
            >
              <Globe className="h-3.5 w-3.5" /> Website
            </a>
          ) : null}
          {links.map((link, i) => (
            <a
              key={`${link.url}-${i}`}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-text-secondary transition-colors hover:text-foreground"
            >
              {link.label || link.url}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default OrganiserProfileHeader;
