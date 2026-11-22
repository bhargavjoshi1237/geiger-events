"use client";

import { Activity, CirclePause, RefreshCw, Workflow } from "lucide-react";

import { DataTable, EmptyState, SectionCard, StatusPill } from "@/components/internal/shared/screen_kit";
import { Badge } from "@geiger/ui/badge";
import { Button } from "@geiger/ui/button";
import { cn } from "@/lib/utils";
import {
  JOB_ACTIVE_MAP,
  JOB_LABELS,
  JOB_RUN_STATUS_MAP,
  RUN_KIND_LABELS,
  formatDateTime,
  formatDuration,
  formatRelativeTime,
  scheduleLabel,
} from "./constants";
import { Banner, PauseSwitch } from "./shared";

const COUNT_COLUMNS = [
  { key: "claimed", header: "Claimed" },
  { key: "sent", header: "Sent", tone: "text-emerald-600 dark:text-emerald-400" },
  { key: "failed", header: "Failed", tone: "text-red-600 dark:text-red-400" },
  { key: "skipped", header: "Skipped" },
  { key: "planned", header: "Planned" },
];

function When({ value, fallback = "Never" }) {
  if (!value) return <span className="text-sm text-text-tertiary">{fallback}</span>;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-sm text-text-secondary">{formatRelativeTime(value)}</span>
      <span className="text-[11px] text-text-tertiary">{formatDateTime(value)}</span>
    </div>
  );
}

function EmptyTable({ icon, title, description }) {
  return (
    <div className="rounded-xl border border-border bg-surface-subtle">
      <EmptyState icon={icon} title={title} description={description} />
    </div>
  );
}

const JOB_COLUMNS = [
  {
    key: "job",
    header: "Job",
    render: (job) => {
      const meta = JOB_LABELS[job.name];
      return (
        <div className="flex min-w-0 max-w-[20rem] flex-col gap-0.5">
          <span className="font-medium text-foreground">{meta?.label || job.name}</span>
          {meta ? <span className="text-xs text-text-secondary">{meta.description}</span> : null}
          <span className="font-mono text-[11px] text-text-tertiary">{job.name}</span>
        </div>
      );
    },
  },
  {
    key: "schedule",
    header: "Schedule",
    render: (job) => (
      <span className="text-sm text-text-secondary" title={job.schedule}>
        {scheduleLabel(job.schedule)}
      </span>
    ),
  },
  {
    key: "active",
    header: "Status",
    render: (job) => <StatusPill status={job.active ? "active" : "inactive"} map={JOB_ACTIVE_MAP} />,
  },
  { key: "lastRunAt", header: "Last run", render: (job) => <When value={job.lastRunAt} /> },
  {
    key: "result",
    header: "Last result",
    render: (job) =>
      job.lastStatus ? (
        <div className="flex max-w-[18rem] flex-col items-start gap-1">
          <StatusPill status={job.lastStatus} map={JOB_RUN_STATUS_MAP} />
          {job.lastMessage ? (
            <span className="line-clamp-2 text-[11px] text-text-tertiary" title={job.lastMessage}>
              {job.lastMessage}
            </span>
          ) : null}
        </div>
      ) : (
        <span className="text-sm text-text-tertiary">—</span>
      ),
  },
];

const RUN_COLUMNS = [
  {
    key: "kind",
    header: "Run",
    render: (run) => <Badge variant="outline">{RUN_KIND_LABELS[run.kind] || run.kind}</Badge>,
  },
  { key: "startedAt", header: "Started", render: (run) => <When value={run.startedAt} fallback="—" /> },
  {
    key: "ms",
    header: "Took",
    align: "right",
    render: (run) => <span className="text-sm tabular-nums text-text-secondary">{formatDuration(run.ms)}</span>,
  },
  ...COUNT_COLUMNS.map((col) => ({
    key: col.key,
    header: col.header,
    align: "right",
    render: (run) => {
      const value = Number(run[col.key]) || 0;
      return (
        <span className={cn("text-sm tabular-nums", value ? col.tone || "text-foreground" : "text-text-tertiary")}>
          {value.toLocaleString()}
        </span>
      );
    },
  })),
  {
    key: "error",
    header: "Error",
    render: (run) =>
      run.error ? (
        <span className="line-clamp-2 max-w-[16rem] text-xs text-red-600 dark:text-red-400" title={run.error}>
          {run.error}
        </span>
      ) : (
        <span className="text-sm text-text-tertiary">—</span>
      ),
  },
];

export default function SchedulerTab({ data, paused, pauseDisabled, onPause, onRefresh }) {
  return (
    <div className="space-y-6">
      {!data.configured ? (
        <Banner tone="warning" title="Push scheduling isn't connected yet — ask an admin to finish setup">
          Pushes still queue up, but nothing sends them or plans reminders until the background jobs are connected.
        </Banner>
      ) : null}
      {data.globalPaused ? (
        <Banner tone="danger" icon={CirclePause} title="Push is paused for every project">
          An admin has paused push for all projects. Nothing is sent until they switch it back on.
        </Banner>
      ) : null}

      <PauseSwitch paused={paused} disabled={pauseDisabled} onChange={onPause} />

      <SectionCard
        bare
        title="Background jobs"
        description="The dispatcher sends pushes as they come due; the planner lines up reminders."
        action={
          <Button variant="ghost" size="sm" onClick={onRefresh} aria-label="Refresh scheduler status">
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
        }
      >
        <DataTable
          columns={JOB_COLUMNS}
          data={data.jobs}
          getRowKey={(job) => job.name}
          empty={
            <EmptyTable
              icon={Workflow}
              title="No background jobs yet"
              description="The dispatcher and planner show up here once push scheduling is connected."
            />
          }
        />
      </SectionCard>

      <SectionCard bare title="Recent runs" description="The latest dispatcher and planner runs, newest first.">
        <DataTable
          columns={RUN_COLUMNS}
          data={data.runs}
          getRowKey={(run, i) => `${run.kind}-${run.startedAt}-${i}`}
          empty={
            <EmptyTable
              icon={Activity}
              title="No runs yet"
              description="A run is logged each time the dispatcher or planner has work to do."
            />
          }
        />
      </SectionCard>
    </div>
  );
}
