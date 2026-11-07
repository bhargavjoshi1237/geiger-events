"use client";

import React from "react";
import { toast } from "sonner";
import { Check, Copy, MailCheck, MailX } from "lucide-react";

import { Button } from "@geiger/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";

const ERROR_COPY = {
  not_configured: "Email isn't configured for this workspace",
  request_failed: "The email service didn't answer",
};

// Shown after a send: who was emailed, and each fresh link — the only time a raw link is ever visible.
export function LinksDialog({ result, onOpenChange }) {
  const rows = result?.results || [];
  const skipped = result?.skipped || [];
  const copy = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied.");
    } catch {
      toast.error("Couldn't copy — select the link and copy it manually.");
    }
  };
  const emailed = rows.filter((r) => r.emailed).length;

  return (
    <Dialog open={Boolean(result)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{result?.mode === "reminder" ? "Reminders sent" : "Invitations sent"}</DialogTitle>
          <DialogDescription>
            {emailed} of {rows.length} emailed. Each venue has a private link — copy one to share it another way. Sending
            again issues a new link and retires the old one.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[50vh] space-y-2 overflow-y-auto">
          {rows.map((r) => (
            <div key={r.recipientId} className="rounded-lg border border-border bg-surface-subtle p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{r.name || r.email}</p>
                  <p
                    className={
                      r.emailed
                        ? "flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400"
                        : "flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400"
                    }
                  >
                    {r.emailed ? <MailCheck className="h-3.5 w-3.5" /> : <MailX className="h-3.5 w-3.5" />}
                    {r.emailed
                      ? `Emailed to ${r.email}`
                      : r.emailStatus?.status === "off"
                        ? "Not emailed — RFP emails are switched off in Notifications"
                        : `Not emailed — ${ERROR_COPY[r.emailStatus?.error] || r.error || r.emailStatus?.error || "send failed"}`}
                  </p>
                </div>
                {r.url ? (
                  <Button size="sm" variant="outline" onClick={() => copy(r.url)}>
                    <Copy className="h-3.5 w-3.5" /> Copy link
                  </Button>
                ) : null}
              </div>
              {r.url ? <p className="mt-2 truncate font-mono text-[11px] text-text-tertiary">{r.url}</p> : null}
            </div>
          ))}
          {skipped.length ? (
            <p className="text-xs text-text-secondary">
              Skipped {skipped.map((s) => s.name).join(", ")} — no valid email address.
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => onOpenChange(false)}>
            <Check className="h-4 w-4" /> Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default LinksDialog;
