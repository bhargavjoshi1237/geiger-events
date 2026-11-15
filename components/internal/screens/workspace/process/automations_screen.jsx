"use client";

import { useState } from "react";
import { Copy, Pencil, Plus, Trash2, Workflow } from "lucide-react";
import {
  ActionMenu, Button, DataTable, LoadingArea, LucideIcon, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch,
} from "@geiger/ui";
import { toast } from "sonner";
import { EmptyState, SearchInput, SegmentedTabs } from "@/components/internal/shared/screen_kit";
import { RecordSheet } from "../record/record_sheet";
import { timeAgo } from "../state/format";
import { PageBar, PageBody, PageToolbar, WorkspacePage } from "../shell/page";
import { AutomationSheet } from "./automation_sheet";
import { RunBadge, RunsView } from "./runs_view";
import { useDocuments } from "./use_documents";
import { useProcess } from "./use_process";

const DAY = 86_400_000;
const failedToday = (automation) => automation.lastRun?.status === "failed" && Date.now() - new Date(automation.lastRun.at).getTime() < DAY;

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
  const bar = (
    <PageBar icon={Workflow} title="Automations" note="When something happens, check a condition and do the steps"
      actions={canConfigure ? <Button size="sm" onClick={() => setEditing({})}><Plus className="h-4 w-4" />New automation</Button> : null} />
  );

  if (!process.data) {
    return (
      <WorkspacePage>
        {bar}
        {process.status === "error" ? (
          <EmptyState title="Couldn't load automations" description={process.error?.message} action={<Button variant="outline" onClick={process.reload}>Try again</Button>} />
        ) : <LoadingArea size={56} label="Loading automations" />}
      </WorkspacePage>
    );
  }

  const catalog = process.data.catalog ?? { triggers: {}, steps: {} };
  const term = search.trim().toLowerCase();
  const all = process.automations;
  const shown = all.filter((automation) => !term || automation.name.toLowerCase().includes(term) || automation.summary.toLowerCase().includes(term));
  const on = all.filter((automation) => automation.enabled).length;
  const failed = all.filter(failedToday).length;
  const listOf = (automation) => ws.objects.find((object) => object.id === automation.trigger?.objectId)?.plural ?? null;

  const toggle = (automation, enabled) => process.run("automation.toggle", { id: automation.id, enabled }, { success: enabled ? "Turned on" : "Turned off" });
  const remove = (automation) => process.run("automation.delete", { id: automation.id }, { success: `“${automation.name}” deleted` });
  const duplicate = async (automation) => {
    const result = await process.run("automation.save", { automation: { ...automation, name: `${automation.name} (copy)`, enabled: false } }, { handle: ["invalid_automation"] });
    if (result.error) toast.error(result.error.message); else toast.success("Duplicated — it starts off");
  };

  const columns = [
    {
      key: "name", header: "Automation", render: (automation) => (
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-muted-foreground">
            <LucideIcon name={catalog.triggers[automation.trigger.kind]?.icon ?? "workflow"} className="h-4 w-4" />
          </span>
          <span className="grid min-w-0 gap-0.5">
            <span className="truncate font-medium text-foreground">{automation.name}</span>
            <span className="truncate text-xs text-text-secondary">{automation.description || automation.summary}</span>
          </span>
        </span>
      ),
    },
    {
      key: "when", header: "When", headClassName: "hidden lg:table-cell", className: "hidden max-w-[16rem] lg:table-cell", render: (automation) => {
        const list = listOf(automation);
        return (
          <span className="grid min-w-0 gap-0.5">
            <span className="truncate text-foreground">{automation.summary}</span>
            {list || automation.condition ? <span className="truncate text-xs text-text-secondary">{[list, automation.condition ? "with a condition" : null].filter(Boolean).join(" · ")}</span> : null}
          </span>
        );
      },
    },
    {
      key: "steps", header: "Steps", headClassName: "hidden xl:table-cell", className: "hidden xl:table-cell", render: (automation) => (
        <span className="flex items-center gap-1">
          {automation.steps.slice(0, 4).map((step, index) => (
            <span key={`${step.id ?? step.kind}-${index}`} title={catalog.steps[step.kind]?.label ?? step.kind}
              className="flex h-[26px] w-[26px] items-center justify-center rounded-md border border-border bg-surface-card text-muted-foreground">
              <LucideIcon name={catalog.steps[step.kind]?.icon ?? "circle"} className="h-3.5 w-3.5" />
            </span>
          ))}
          <span className="ml-1.5 whitespace-nowrap text-xs text-text-secondary">{automation.steps.length} step{automation.steps.length === 1 ? "" : "s"}</span>
        </span>
      ),
    },
    {
      key: "run", header: "Last run", headClassName: "hidden md:table-cell", className: "hidden md:table-cell", render: (automation) => (automation.lastRun ? (
        <span className="flex items-center gap-2 whitespace-nowrap"><RunBadge status={automation.lastRun.status} /><span className="text-xs text-text-tertiary">{timeAgo(automation.lastRun.at)}</span></span>
      ) : <span className="text-xs text-text-tertiary">Not run yet</span>),
    },
    {
      key: "on", header: "On", render: (automation) => (
        <span onClick={(event) => event.stopPropagation()}>
          <Switch checked={automation.enabled} disabled={!canConfigure} onCheckedChange={(next) => toggle(automation, next)} aria-label={automation.enabled ? "Turn off" : "Turn on"} />
        </span>
      ),
    },
    {
      key: "actions", header: "", align: "right", render: (automation) => (canConfigure ? (
        <ActionMenu label={`Actions for ${automation.name}`} items={[
          { icon: Pencil, label: "Edit", onSelect: () => setEditing(automation) },
          { icon: Copy, label: "Duplicate", onSelect: () => duplicate(automation) },
          { separator: true },
          { icon: Trash2, label: "Delete", destructive: true, onSelect: () => remove(automation) },
        ]} />
      ) : null),
    },
  ];

  return (
    <WorkspacePage>
      {bar}
      <PageToolbar>
        <div className="flex items-center gap-3">
          <SegmentedTabs value={tab} onChange={setTab} className="w-auto shrink-0"
            tabs={[
              { label: <span className="inline-flex items-center gap-1.5">Automations<span className="text-xs text-text-secondary">{all.length}</span></span>, value: "automations" },
              { label: "Runs", value: "runs" },
            ]} />
          {all.length ? (
            <span className="hidden shrink-0 text-xs text-text-secondary md:inline">
              {on} on{failed ? <> · <span className="text-red-600 dark:text-red-400">{failed} failed</span> in the last 24 h</> : null}
            </span>
          ) : null}
        </div>
        {tab === "automations" ? <SearchInput value={search} onChange={setSearch} placeholder="Search automations" /> : (
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-40 shrink-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All runs</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="waiting">Waiting</SelectItem>
              <SelectItem value="succeeded">Done</SelectItem>
              <SelectItem value="skipped">Skipped</SelectItem>
            </SelectContent>
          </Select>
        )}
      </PageToolbar>

      <PageBody padded>
        {tab === "runs" ? (
          <RunsView process={process} status={status === "all" ? null : status} canRetry={canConfigure} timeZone={ws.data.event?.timeZone}
            onOpenRecord={(ref) => setRecord(ref)} />
        ) : (
          <DataTable columns={columns} data={shown} getRowKey={(automation) => automation.id} onRowClick={canConfigure ? setEditing : undefined}
            empty={(
              <div className="rounded-xl border border-border bg-surface-subtle">
                <EmptyState icon={Workflow} title={term ? "No automations match" : "No automations yet"}
                  description={term ? "Try another search." : "Start with something small: email authors when their paper is accepted, or remind reviewers two days before reviews are due."}
                  action={canConfigure && !term ? <Button onClick={() => setEditing({})}><Plus className="h-4 w-4" />New automation</Button> : null} />
              </div>
            )} />
        )}
      </PageBody>

      <AutomationSheet open={Boolean(editing)} onOpenChange={(open) => { if (!open) setEditing(null); }}
        eventId={eventId} ws={ws} process={process} documents={documents.items} automation={editing?.id ? editing : null} />
      <RecordSheet open={Boolean(record)} onOpenChange={(open) => { if (!open) setRecord(null); }}
        eventId={eventId} data={ws.data} objectId={record?.objectId} recordId={record?.id} timeZone={ws.data.event?.timeZone}
        can={ws.can} run={ws.run} onOpenRecord={(id, objectId) => setRecord((current) => ({ id, objectId: objectId ?? current?.objectId }))} />
    </WorkspacePage>
  );
}
