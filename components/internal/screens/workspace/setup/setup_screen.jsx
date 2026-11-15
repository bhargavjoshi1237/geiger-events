"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Copy, Layers3, LayoutTemplate, Loader2, Plus } from "lucide-react";
import { Button, Card, SectionCard, SettingRow, SettingsList } from "@geiger/ui";
import { cn } from "@/lib/utils";
import { workspaceApi } from "@/lib/workspace/client";
import { formatDate } from "../state/format";
import { PageBar, PageBody, WorkspacePage } from "../shell/page";
import { CopyWizard } from "./copy_wizard";
import { TemplateGallery } from "./template_gallery";


// One way to start, as a clickable suite card.
function Choice({ icon: Icon, title, description, onClick, busy, disabled }) {
  return (
    <Card role="button" tabIndex={disabled ? -1 : 0} aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onClick} onKeyDown={(event) => { if (!disabled && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onClick(); } }}
      className={cn("cursor-pointer gap-3.5 bg-surface-subtle p-4 shadow-none transition-colors hover:border-border-strong hover:bg-surface-card", disabled && "cursor-not-allowed opacity-60")}>
      <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface-card text-muted-foreground">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      </span>
      <span>
        <span className="block text-sm font-medium text-foreground">{title}</span>
        <span className="mt-0.5 block text-sm text-text-secondary">{description}</span>
      </span>
    </Card>
  );
}

// Shown until an event has a workspace: start empty, from a template, or by copying an earlier event.
export function SetupScreen({ eventId, ws }) {
  const [busy, setBusy] = useState(false);
  const [wizard, setWizard] = useState(null);
  const [gallery, setGallery] = useState(false);
  const [sources, setSources] = useState({ templates: [], events: [] });
  const canBuild = Boolean(ws.can.configure);

  useEffect(() => {
    if (!canBuild) return undefined;
    let alive = true;
    Promise.all([workspaceApi.templates(eventId), workspaceApi.copySources(eventId)]).then(([templates, events]) => {
      if (alive) setSources({ templates: templates.data?.templates ?? [], events: (events.data?.events ?? []).filter((item) => item.id !== eventId) });
    });
    return () => { alive = false; };
  }, [eventId, canBuild]);

  const startEmpty = async () => {
    setBusy(true);
    await ws.run("workspace.create", { createdFrom: { kind: "empty" } }, { success: "Workspace ready" });
    setBusy(false);
  };

  return (
    <WorkspacePage>
      <PageBar icon={Layers3} title="Workspace" crumb={null} />
      <PageBody>
        <div className="mx-auto grid max-w-[820px] gap-9 px-4 pb-12 pt-10 sm:px-8 sm:pt-14">
          <div className="grid gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Set up this event&apos;s workspace</h1>
            <p className="max-w-[620px] text-sm leading-relaxed text-muted-foreground">
              Build the back office this event needs: your own lists, fields and views for anything you track — papers, reviewers, exhibitors, volunteers, shifts.
            </p>
          </div>
          {canBuild ? (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                <Choice icon={Plus} title="Start empty" description="Create your first list and add fields as you go." onClick={startEmpty} busy={busy} disabled={busy} />
                <Choice icon={LayoutTemplate} title="Use a template" description="A complete setup for a conference, hackathon, exhibitors, volunteers or awards — or one your team saved." onClick={() => setGallery(true)} disabled={busy} />
                <Choice icon={Copy} title="Copy from another event" description="Reuse lists, and optionally records, from an earlier event." onClick={() => setWizard({ startWith: "event", chosen: "" })} disabled={busy} />
              </div>
              {sources.templates.length ? (
                <SectionCard title="Templates in this project" description="Lists, fields and shared views your team saved.">
                  <SettingsList>
                    {sources.templates.map((template) => (
                      <SettingRow key={template.id} icon={LayoutTemplate} title={template.name}
                        description={`${template.lists.join(", ")} · saved ${formatDate(template.updatedAt)}`}
                        control={<Button variant="outline" size="sm" onClick={() => setWizard({ startWith: "template", chosen: template.id })}>Use template</Button>} />
                    ))}
                  </SettingsList>
                </SectionCard>
              ) : null}
              {sources.events.length ? (
                <SectionCard title="Earlier events with a workspace" description="Copy their lists, and optionally their records.">
                  <SettingsList>
                    {sources.events.map((item) => (
                      <SettingRow key={item.id} icon={CalendarDays} title={item.name} description={item.date ? formatDate(item.date) : "No date"}
                        control={<Button variant="outline" size="sm" onClick={() => setWizard({ startWith: "event", chosen: item.id })}><Copy className="h-3.5 w-3.5" />Copy</Button>} />
                    ))}
                  </SettingsList>
                </SectionCard>
              ) : null}
            </>
          ) : (
            <p className="rounded-xl border border-border bg-surface-subtle px-4 py-4 text-sm text-text-secondary">
              This event doesn&apos;t have a workspace yet. Ask someone who can build workspaces to set it up.
            </p>
          )}
        </div>
      </PageBody>
      <TemplateGallery open={gallery} onOpenChange={setGallery} eventId={eventId} onSaved={() => setWizard({ startWith: "template", chosen: "" })}
        onInstalled={() => ws.reload()} />
      <CopyWizard open={Boolean(wizard)} onOpenChange={(open) => { if (!open) setWizard(null); }} eventId={eventId} ws={ws}
        startWith={wizard?.startWith ?? "event"} chosen={wizard?.chosen ?? ""} />
    </WorkspacePage>
  );
}
