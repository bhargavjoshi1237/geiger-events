"use client";

import { useState } from "react";
import { AlertTriangle, CircleAlert, Info, Loader2, RotateCcw, Upload } from "lucide-react";
import {
  Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label,
} from "@geiger/ui";
import { SectionCard } from "@geiger/ui";
import { cn } from "@/lib/utils";
import { formatDateTime, timeAgo } from "../state/format";

const LEVEL = {
  error: { icon: CircleAlert, className: "text-red-600 dark:text-red-400" },
  warning: { icon: AlertTriangle, className: "text-amber-600 dark:text-amber-400" },
  info: { icon: Info, className: "text-text-secondary" },
};

export function Warnings({ warnings }) {
  if (!warnings?.length) return null;
  return (
    <ul className="grid gap-2">
      {warnings.map((warning, index) => {
        const meta = LEVEL[warning.level] ?? LEVEL.info;
        const Icon = meta.icon;
        return (
          <li key={index} className="flex items-start gap-2 text-sm">
            <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", meta.className)} /><span className="text-foreground">{warning.text}</span>
          </li>
        );
      })}
    </ul>
  );
}

// Publishing freezes the draft as a numbered version; the live portal only ever serves the published version.
export function usePublish(portal) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const errors = (portal.data?.warnings ?? []).filter((warning) => warning.level === "error");

  const publish = async () => {
    setBusy(true);
    const result = await portal.run("portal.publish", { note, confirm: true }, { success: "Published" });
    setBusy(false);
    if (!result.error) { setOpen(false); setNote(""); }
  };

  const dialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Publish the portal</DialogTitle>
          <DialogDescription>Everyone opening the portal gets these pages and access rules straight away.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          {portal.data?.changes?.length ? (
            <ul className="grid max-h-48 gap-1 overflow-y-auto rounded-lg border border-border p-3 text-sm">
              {portal.data.changes.map((change, index) => <li key={index} className="text-foreground">{change.label}</li>)}
            </ul>
          ) : <p className="text-sm text-text-secondary">Nothing has changed since the last version.</p>}
          {errors.length ? (
            <div className="grid gap-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
              <p className="text-sm font-medium text-foreground">Some pages have problems that will show to people:</p>
              <Warnings warnings={errors} />
            </div>
          ) : null}
          <div className="grid gap-1.5">
            <Label htmlFor="wp-publish-note">Note (optional)</Label>
            <Input id="wp-publish-note" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opened submissions" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={publish} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}{errors.length ? "Publish anyway" : "Publish"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
  return { open: () => setOpen(true), dialog };
}

export function PublishTab({ portal }) {
  const data = portal.data ?? {};
  const { open, dialog } = usePublish(portal);
  const [restoring, setRestoring] = useState(null);
  const [busy, setBusy] = useState(false);

  const restore = async () => {
    setBusy(true);
    const result = await portal.run("portal.restore_version", { versionId: restoring.id }, { success: `Draft set back to version ${restoring.number}` });
    setBusy(false);
    if (!result.error) setRestoring(null);
  };

  return (
    <div className="space-y-5">
      <SectionCard title="Draft" description={data.published ? `Version ${data.published.number} is live, published ${timeAgo(data.published.publishedAt)}.` : "Nothing is published yet."}
        action={<Button onClick={open}><Upload className="h-4 w-4" />Publish</Button>}>
        <div className="grid gap-5">
          <div className="grid gap-2">
            <p className="text-sm font-medium text-foreground">Changes since {data.published ? `version ${data.published.number}` : "the start"}</p>
            {data.changes?.length ? (
              <ul className="grid gap-1 text-sm">{data.changes.map((change, index) => <li key={index} className="text-text-secondary">{change.label}</li>)}</ul>
            ) : <p className="text-sm text-text-secondary">No changes. The live portal matches the draft.</p>}
          </div>
          {data.warnings?.length ? (
            <div className="grid gap-2 border-t border-border pt-4">
              <p className="text-sm font-medium text-foreground">Checks</p>
              <Warnings warnings={data.warnings} />
            </div>
          ) : null}
        </div>
      </SectionCard>
      <SectionCard title="Versions" description="Each publish is kept. Restoring copies a version back into the draft; publish again to make it live.">
        {data.versions?.length ? (
          <ol className="divide-y divide-border">
            {data.versions.map((version) => (
              <li key={version.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="font-medium text-foreground">Version {version.number}</span>
                  {data.published?.id === version.id ? <span className="ml-2 text-xs text-emerald-700 dark:text-emerald-400">Live</span> : null}
                  <span className="block truncate text-xs text-text-tertiary">{version.publishedBy} · {formatDateTime(version.publishedAt)}{version.note ? ` · ${version.note}` : ""}</span>
                </span>
                <Button size="sm" variant="ghost" onClick={() => setRestoring(version)}><RotateCcw className="h-4 w-4" />Restore</Button>
              </li>
            ))}
          </ol>
        ) : <p className="text-sm text-text-secondary">No versions yet.</p>}
      </SectionCard>
      {dialog}
      <Dialog open={Boolean(restoring)} onOpenChange={(next) => { if (!next) setRestoring(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Restore version {restoring?.number}?</DialogTitle>
            <DialogDescription>Your draft&apos;s pages, roles and settings are replaced with this version. The live portal doesn&apos;t change until you publish.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoring(null)}>Cancel</Button>
            <Button onClick={restore} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Restore to draft</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
