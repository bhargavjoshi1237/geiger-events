"use client";

import React, { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { BellPlus, Check, Loader2 } from "lucide-react";

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

// `subtle` renders the outline treatment the event page's host row wants, where
// a brand-filled button would compete with the ticket CTA beside it.
export function FollowButton({ projectId, organiserName, subtle = false, className }) {
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
        size={subtle ? "sm" : undefined}
        className={cn(
          "border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground",
          className,
        )}
        disabled
      >
        <Check className="h-4 w-4" /> Following
      </Button>
    );
  }

  return (
    <>
      <Button
        variant={subtle ? "outline" : undefined}
        size={subtle ? "sm" : undefined}
        className={cn(
          subtle
            ? "border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            : "bg-primary text-primary-foreground hover:bg-primary/90",
          className,
        )}
        onClick={() => setOpen(true)}
      >
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

export default FollowButton;
