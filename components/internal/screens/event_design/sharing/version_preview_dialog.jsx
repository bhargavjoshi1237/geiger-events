"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { History, Loader2 } from "lucide-react";

import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  LogoLoading,
} from "@geiger/ui";
import { getVersionPlan, updateVersionNote } from "@/lib/supabase/floor_plan_sharing";
import { formatAgo, formatDimensions, planSummary, setupStyleLabel } from "@/lib/event_design";
import { PlanRenderer } from "../plan_renderer";
import { useNow } from "./client_utils";

// Read-only look at one saved version, with a Restore button (restoring saves it as the newest version).
export function VersionPreviewDialog({ version, planName, isCurrent, restoreBlockedReason, onOpenChange, onRestore }) {
  const now = useNow();
  const [loaded, setLoaded] = useState({ id: null, plan: null });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!version?.id) return undefined;
    let alive = true;
    getVersionPlan(version.id).then((plan) => alive && setLoaded({ id: version.id, plan: plan || false }));
    return () => {
      alive = false;
    };
  }, [version?.id]);

  const plan = loaded.id === version?.id ? loaded.plan : null;
  const summary = useMemo(() => (plan ? planSummary(plan) : null), [plan]);

  return (
    <Dialog open={Boolean(version)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {planName ? `${planName} · ` : ""}Version {version?.version}
            {isCurrent ? <Badge variant="success">Current</Badge> : null}
            {version?.restoredFrom ? <Badge variant="info">Restored from v{version.restoredFrom}</Badge> : null}
          </DialogTitle>
          <DialogDescription suppressHydrationWarning>
            Saved {formatAgo(version?.createdAt, now || undefined)}
            {version?.authorName ? ` by ${version.authorName}` : ""}
            {version?.note ? ` — ${version.note}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="h-[55vh] min-h-[280px] overflow-hidden rounded-xl border border-border">
          {plan === null ? (
            <div className="flex h-full items-center justify-center">
              <LogoLoading size={48} aria-label="Loading version" />
            </div>
          ) : plan === false ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-text-secondary">
              This version couldn&apos;t be loaded.
            </div>
          ) : (
            <PlanRenderer plan={plan} interactive showGrid={false} />
          )}
        </div>

        {plan ? (
          <p className="text-xs tabular-nums text-text-secondary">
            {formatDimensions(plan.widthM, plan.lengthM, plan.unit)} · {setupStyleLabel(plan.setupStyle)} · {summary.seats}{" "}
            seat{summary.seats === 1 ? "" : "s"} · {summary.objectCount} object{summary.objectCount === 1 ? "" : "s"}
          </p>
        ) : null}

        <DialogFooter className="items-center">
          {restoreBlockedReason && !isCurrent ? (
            <p className="mr-auto text-xs text-amber-700 dark:text-amber-400">{restoreBlockedReason}</p>
          ) : null}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {!isCurrent && onRestore ? (
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={!plan || busy || Boolean(restoreBlockedReason)}
              onClick={async () => {
                setBusy(true);
                await onRestore(version, plan);
                setBusy(false);
              }}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <History className="h-4 w-4" />}
              Restore this version
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Adds or edits the note shown against a version in the history.
export function VersionNoteDialog({ version, onOpenChange, onSaved }) {
  const [note, setNote] = useState(version?.note || "");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={Boolean(version)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Note on version {version?.version}</DialogTitle>
          <DialogDescription>What changed, or why this version matters — shown in the history.</DialogDescription>
        </DialogHeader>
        <Input autoFocus value={note} maxLength={500} placeholder="e.g. Sent to the venue for sign-off" onChange={(e) => setNote(e.target.value)} />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const saved = await updateVersionNote(version.id, note);
              setBusy(false);
              if (!saved) {
                toast.error("Couldn't save the note.");
                return;
              }
              onSaved(saved);
              onOpenChange(false);
            }}
          >
            Save note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default VersionPreviewDialog;
