"use client";

import { useState } from "react";
import { Copy, MoreHorizontal, Pencil, Plus, Trash2, Workflow } from "lucide-react";
import {
  Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, LogoLoading, LucideIcon,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch,
} from "@geiger/ui";
import { toast } from "sonner";
import { EditorSectionHeader, EmptyState, SearchInput, SegmentedTabs, Toolbar } from "@/components/internal/shared/screen_kit";
import { RecordSheet } from "../record/record_sheet";
import { timeAgo } from "../state/format";
import { AutomationSheet } from "./automation_sheet";
import { RunBadge, RunsView } from "./runs_view";
import { useDocuments } from "./use_documents";
import { useProcess } from "./use_process";

const TABS = [{ label: "Automations", value: "automations" }, { label: "Runs", value: "runs" }];

// Automations for this event: when something happens, check a condition, do the steps. Plus the run log.
export function AutomationsScreen({ eventId, ws }) {
  const process = useProcess(eventId);
  const documents = useDocuments(eventId);
  const [tab, setTab] = useState("automations");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState(null);
  const [record, setRecord] = useState(null);
  const canConfigure = Boolean(ws.can?.configure);

  if (!process.data && process.status !== "error") return <div className="flex justify-center py-20"><LogoLoading size={56} aria-label="Loading automations" /></div>;
  if (!process.data) {
    return <EmptyState title="Couldn't load automations" description={process.error?.message} action={<Button variant="outline" onClick={process.reload}>Try again</Button>} />;
  }

  const catalog = process.data.catalog ?? { triggers: {}, steps: {} };
  const term = search.trim().toLowerCase();
  const shown = process.automations.filter((automation) => !term || automation.name.toLowerCase().includes(term) || automation.summary.toLowerCase().includes(term));

  const toggle = (automation, enabled) => process.run("automation.toggle", { id: automation.id, enabled }, { success: enabled ? "Turned on" : "Turned off" });
  const remove = (automation) => process.run("automation.delete", { id: automation.id }, { success: `“${automation.name}” deleted` });
  const duplicate = async (automation) => {
    const result = await process.run("automation.save", { automation: { ...automation, name: `${automation.name} (copy)`, enabled: false } }, { handle: ["invalid_automation"] });
    if (result.error) toast.error(result.error.message); else toast.success("Duplicated — it starts off");
  };

  return (
    <div className="space-y-5">
      <EditorSectionHeader title="Automations"
        description="When something happens — a record is added, a status changes, a date comes up — check a condition and do the steps: update records, send emails, ask for approval, assign reviewers."
        action={canConfigure ? <Button onClick={() => setEditing({})}><Plus className="h-4 w-4" />New automation</Button> : null} />
      <Toolbar>
        <SegmentedTabs value={tab} onChange={setTab} tabs={TABS} />
        {tab === "automations" ? <SearchInput value={search} onChange={setSearch} placeholder="Search automations" /> : (
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All runs</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="waiting">Waiting</SelectItem>
              <SelectItem value="succeeded">Done</SelectItem>
              <SelectItem value="skipped">Skipped</SelectItem>
            </SelectContent>
          </Select>
        )}
      </Toolbar>

      {tab === "runs" ? (
        <RunsView process={process} status={status === "all" ? null : status} canRetry={canConfigure} timeZone={ws.data.event?.timeZone}
          onOpenRecord={(ref) => setRecord(ref)} />
      ) : shown.length ? (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-subtle">
          {shown.map((automation) => (
            <div key={automation.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-text-secondary">
                <LucideIcon name={catalog.triggers[automation.trigger.kind]?.icon ?? "workflow"} className="h-4 w-4" />
              </div>
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => canConfigure && setEditing(automation)} disabled={!canConfigure}>
                <p className="truncate text-sm font-medium text-foreground">{automation.name}</p>
                <p className="truncate text-xs text-text-secondary">{automation.summary} → {automation.steps.length} step{automation.steps.length === 1 ? "" : "s"}</p>
              </button>
              {automation.lastRun ? (
                <span className="hidden items-center gap-2 text-xs text-text-tertiary sm:flex"><RunBadge status={automation.lastRun.status} />{timeAgo(automation.lastRun.at)}</span>
              ) : <span className="hidden text-xs text-text-tertiary sm:inline">Not run yet</span>}
              <Switch checked={automation.enabled} disabled={!canConfigure} onCheckedChange={(on) => toggle(automation, on)} aria-label={automation.enabled ? "Turn off" : "Turn on"} />
              {canConfigure ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-8 w-8" aria-label="More"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setEditing(automation)}><Pencil className="h-4 w-4" />Edit</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => duplicate(automation)}><Copy className="h-4 w-4" />Duplicate</DropdownMenuItem>
                    <DropdownMenuItem className="text-red-600" onSelect={() => remove(automation)}><Trash2 className="h-4 w-4" />Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState icon={Workflow} title={term ? "No automations match" : "No automations yet"}
            description={term ? "Try another search." : "Start with something small: email authors when their paper is accepted, or remind reviewers two days before reviews are due."}
            action={canConfigure && !term ? <Button onClick={() => setEditing({})}><Plus className="h-4 w-4" />New automation</Button> : null} />
        </div>
      )}

      <AutomationSheet open={Boolean(editing)} onOpenChange={(open) => { if (!open) setEditing(null); }}
        eventId={eventId} ws={ws} process={process} documents={documents.items} automation={editing?.id ? editing : null} />
      <RecordSheet open={Boolean(record)} onOpenChange={(open) => { if (!open) setRecord(null); }}
        eventId={eventId} data={ws.data} objectId={record?.objectId} recordId={record?.id} timeZone={ws.data.event?.timeZone}
        can={ws.can} run={ws.run} onOpenRecord={(id, objectId) => setRecord((current) => ({ id, objectId: objectId ?? current?.objectId }))} />
    </div>
  );
}
