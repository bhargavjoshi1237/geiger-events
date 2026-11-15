"use client";

import { useEffect, useState } from "react";
import { History, Loader2, RotateCw } from "lucide-react";
import {
  Badge, Button, LoadingArea, LucideIcon, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@geiger/ui";
import { DataTable, EmptyState } from "@/components/internal/shared/screen_kit";
import { formatDateTime, timeAgo } from "../state/format";

export const RUN_STATUS = {
  running: { label: "Running", variant: "info" },
  succeeded: { label: "Done", variant: "success" },
  failed: { label: "Failed", variant: "danger" },
  skipped: { label: "Skipped", variant: "neutral" },
  waiting: { label: "Waiting", variant: "warning" },
};

export function RunBadge({ status }) {
  const meta = RUN_STATUS[status] ?? { label: status, variant: "neutral" };
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

const duration = (run) => {
  if (!run.finishedAt) return "";
  const ms = new Date(run.finishedAt) - new Date(run.startedAt);
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
};

function RunSheet({ run, catalog, onOpenChange, onRetry, canRetry, timeZone }) {
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open={Boolean(run)} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        {run ? (
          <>
            <SheetHeader className="border-b border-border px-5 py-4">
              <SheetTitle className="flex items-center gap-2 text-base">{run.automation}<RunBadge status={run.status} /></SheetTitle>
              <SheetDescription>{formatDateTime(run.startedAt, timeZone)}{run.record ? ` · ${run.record.label}` : ""}{duration(run) ? ` · ${duration(run)}` : ""}</SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-5">
              {run.error ? <p className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">{run.error}</p> : null}
              {(run.steps ?? []).length ? (
                <ol className="space-y-2">
                  {run.steps.map((step, index) => (
                    <li key={`${step.id}-${index}`} className="rounded-lg border border-border p-3">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <LucideIcon name={catalog?.[step.kind]?.icon ?? "circle"} className="h-4 w-4 text-text-secondary" />
                        {catalog?.[step.kind]?.label ?? step.kind}
                        <span className="ml-auto"><RunBadge status={step.status === "done" ? "succeeded" : step.status} /></span>
                      </div>
                      {step.detail ? <p className="mt-1 text-sm text-text-secondary">{step.detail}</p> : null}
                      {step.error ? <p className="mt-1 text-sm text-red-600 dark:text-red-400">{step.error}</p> : null}
                      {step.output ? <pre className="mt-2 overflow-x-auto rounded bg-surface-subtle p-2 text-xs">{JSON.stringify(step.output, null, 2)}</pre> : null}
                    </li>
                  ))}
                </ol>
              ) : <p className="text-sm text-text-secondary">No steps ran.</p>}
              {canRetry && ["failed", "skipped"].includes(run.status) ? (
                <Button variant="outline" disabled={busy} onClick={async () => { setBusy(true); await onRetry(run); setBusy(false); }}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}Run again
                </Button>
              ) : null}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

// The run log: what ran, on which record, and how it went.
export function RunsView({ process, status, automationId, canRetry, timeZone, onOpenRecord }) {
  const [state, setState] = useState({ key: null, runs: [], error: null });
  const [open, setOpen] = useState(null);
  const [version, setVersion] = useState(0);
  const key = JSON.stringify({ status, automationId, version });

  useEffect(() => {
    const controller = new AbortController();
    const params = JSON.parse(key);
    process.api.runs({ status: params.status, automation: params.automationId }, controller.signal)
      .then(({ data, error }) => { if (!controller.signal.aborted) setState({ key, runs: data?.runs ?? [], error }); }).catch(() => {});
    return () => controller.abort();
  }, [process.api, key]);

  const retry = async (run) => {
    const { error } = await process.api.retry(run.id);
    if (!error) { setOpen(null); setVersion((n) => n + 1); }
  };

  if (state.key !== key && !state.runs.length) return <LoadingArea size={48} label="Loading runs" />;
  if (state.error) return <EmptyState title="Couldn't load the runs" description={state.error.message} action={<Button variant="outline" onClick={() => setVersion((n) => n + 1)}>Try again</Button>} />;

  const columns = [
    { key: "status", header: "Status", render: (run) => <RunBadge status={run.status} /> },
    { key: "automation", header: "Automation", render: (run) => <span className="font-medium text-foreground">{run.automation}</span> },
    {
      key: "record", header: "Record", render: (run) => (run.record ? (
        <button type="button" className="text-left text-foreground underline-offset-2 hover:underline" onClick={(event) => { event.stopPropagation(); onOpenRecord?.(run.record); }}>{run.record.label}</button>
      ) : <span className="text-text-tertiary">—</span>),
    },
    { key: "detail", header: "Result", render: (run) => <span className="line-clamp-1 text-text-secondary">{run.error ?? run.steps?.at(-1)?.detail ?? ""}</span> },
    { key: "at", header: "When", align: "right", render: (run) => <span className="whitespace-nowrap text-text-secondary">{timeAgo(run.startedAt)}</span> },
  ];

  return (
    <>
      <DataTable columns={columns} data={state.runs} getRowKey={(run) => run.id} onRowClick={setOpen}
        empty={<div className="rounded-xl border border-border bg-surface-subtle"><EmptyState icon={History} title="No runs yet" description="Runs appear here as soon as an automation starts." /></div>} />
      <RunSheet run={open} catalog={process.data?.catalog?.steps} onOpenChange={(value) => { if (!value) setOpen(null); }} onRetry={retry} canRetry={canRetry} timeZone={timeZone} />
    </>
  );
}
