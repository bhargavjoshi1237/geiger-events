"use client";

import { useState } from "react";
import { Copy, LayoutTemplate, Loader2, Plus } from "lucide-react";
import { EditorSectionHeader } from "@/components/internal/shared/screen_kit";
import { cn } from "@/lib/utils";
import { CopyWizard } from "./copy_wizard";
import { TemplateGallery } from "./template_gallery";

function Choice({ icon: Icon, title, description, onClick, busy, disabled }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={cn("flex w-full items-start gap-3 rounded-xl border border-border bg-surface-subtle px-4 py-4 text-left transition-colors hover:bg-surface-card",
        disabled && "cursor-not-allowed opacity-60")}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-text-secondary">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{title}</span>
        <span className="mt-0.5 block text-sm text-text-secondary">{description}</span>
      </span>
    </button>
  );
}

// Shown until an event has a workspace: start empty, from a template, or by copying an earlier event.
export function SetupScreen({ eventId, ws, onCreated }) {
  const [busy, setBusy] = useState(false);
  const [wizard, setWizard] = useState(null);
  const [gallery, setGallery] = useState(false);
  const canBuild = Boolean(ws.can.configure);

  const startEmpty = async () => {
    setBusy(true);
    const result = await ws.run("workspace.create", { createdFrom: { kind: "empty" } }, { success: "Workspace ready" });
    setBusy(false);
    if (!result.error) onCreated?.();
  };

  return (
    <div className="space-y-6">
      <EditorSectionHeader title="Workspace"
        description="Build the back office this event needs: your own lists, fields and views for anything you track — papers, reviewers, exhibitors, volunteers, shifts." />
      {canBuild ? (
        <div className="grid gap-3 md:grid-cols-3">
          <Choice icon={Plus} title="Start empty" description="Create your first list and add fields as you go." onClick={startEmpty} busy={busy} disabled={busy} />
          <Choice icon={LayoutTemplate} title="From a template" description="A complete setup for a research conference, hackathon, exhibitors, volunteers or awards — or one your team saved." onClick={() => setGallery(true)} disabled={busy} />
          <Choice icon={Copy} title="Copy from another event" description="Reuse lists, and optionally records, from an earlier event." onClick={() => setWizard("event")} disabled={busy} />
        </div>
      ) : (
        <p className="rounded-xl border border-border bg-surface-subtle px-4 py-4 text-sm text-text-secondary">
          This event doesn&apos;t have a workspace yet. Ask someone who can build workspaces to set it up.
        </p>
      )}
      <TemplateGallery open={gallery} onOpenChange={setGallery} eventId={eventId} onSaved={() => setWizard("template")}
        onInstalled={() => ws.reload()} />
      <CopyWizard open={Boolean(wizard)} onOpenChange={(open) => { if (!open) setWizard(null); }} eventId={eventId} ws={ws} startWith={wizard ?? "event"} />
    </div>
  );
}
