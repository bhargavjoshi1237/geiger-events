"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, LogoLoading, LucideIcon,
} from "@geiger/ui";
import { toast } from "sonner";
import { workspaceApi } from "@/lib/workspace/client";
import { cn } from "@/lib/utils";

const count = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function Contents({ template }) {
  const rows = [
    ["Lists", template.lists.join(", ")],
    ["Process", [template.stageRules ? count(template.stageRules, "list") + " with stage rules" : null, template.reviewSetups.length ? template.reviewSetups.join(", ") : null].filter(Boolean).join(" · ")],
    ["Automations", template.automations.join(" · ")],
    ["Documents", template.documents.join(" · ")],
    ["Portal", [template.roles.length ? `Roles: ${template.roles.join(", ")}` : null, template.portalPages.length ? `Pages: ${template.portalPages.join(", ")}` : null].filter(Boolean).join(" · ")],
  ].filter(([, value]) => value);
  return (
    <dl className="grid gap-1.5 text-xs">
      {rows.map(([label, value]) => (
        <div key={label} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2">
          <dt className="text-text-tertiary">{label}</dt><dd className="text-text-secondary">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

// The built-in templates: pick one to see what it sets up, then install it (again later to fill in anything missing).
export function TemplateGallery({ open, onOpenChange, eventId, onInstalled, onSaved }) {
  const [state, setState] = useState({ loaded: false, builtins: [], saved: [] });
  const [chosen, setChosen] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    workspaceApi.templates(eventId).then(({ data }) => {
      if (alive) setState({ loaded: true, builtins: data?.builtins ?? [], saved: data?.templates ?? [] });
    });
    return () => { alive = false; };
  }, [open, eventId]);

  const template = state.builtins.find((item) => item.key === chosen) ?? state.builtins[0] ?? null;
  const install = async () => {
    if (!template) return;
    setBusy(true);
    const { data, error } = await workspaceApi.installTemplate(eventId, template.key);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${data.template} is set up. Automations start turned off.`);
    if (data.notes?.length) setNotes(data.notes); else onOpenChange(false);
    onInstalled?.(data);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) setNotes(null); onOpenChange(next); }}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{notes ? "Set up, with a few things to check" : "Start from a template"}</DialogTitle>
          <DialogDescription>
            {notes ? "Everything else is in place. These parts need a look:" : "Each template is a complete, working setup: lists, stages, automations, documents and portal pages. You can change all of it afterwards."}
          </DialogDescription>
        </DialogHeader>
        {notes ? (
          <ul className="max-h-80 list-disc space-y-1 overflow-y-auto pl-5 text-sm text-text-secondary">{notes.map((note) => <li key={note}>{note}</li>)}</ul>
        ) : !state.loaded ? (
          <div className="flex justify-center py-12"><LogoLoading size={40} aria-label="Loading templates" /></div>
        ) : (
          <div className="grid gap-4 md:grid-cols-[14rem_minmax(0,1fr)]">
            <div className="grid content-start gap-1.5">
              {state.builtins.map((item) => (
                <button key={item.key} type="button" onClick={() => setChosen(item.key)}
                  className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm", template?.key === item.key ? "border-foreground/30 bg-surface-active" : "border-border hover:bg-surface-subtle")}>
                  <LucideIcon name={item.icon} className="h-4 w-4 shrink-0 text-text-secondary" /><span className="truncate font-medium text-foreground">{item.name}</span>
                </button>
              ))}
              {state.saved.length && onSaved ? (
                <button type="button" onClick={() => { onOpenChange(false); onSaved(); }} className="mt-2 rounded-lg px-3 py-2 text-left text-sm text-text-secondary hover:bg-surface-subtle">
                  Your saved templates ({state.saved.length})…
                </button>
              ) : null}
            </div>
            {template ? (
              <div className="space-y-3 rounded-lg border border-border p-4">
                <div className="flex items-center gap-2"><LucideIcon name={template.icon} className="h-5 w-5 text-text-secondary" /><p className="text-base font-semibold text-foreground">{template.name}</p></div>
                <p className="text-sm text-text-secondary">{template.description}</p>
                <Contents template={template} />
                <p className="text-xs text-text-tertiary">Installing again later adds anything that&apos;s missing; it doesn&apos;t duplicate lists or overwrite records.</p>
              </div>
            ) : null}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => { setNotes(null); onOpenChange(false); }}>{notes ? "Done" : "Cancel"}</Button>
          {!notes ? <Button onClick={install} disabled={busy || !template}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Use {template?.name ?? "template"}</Button> : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
