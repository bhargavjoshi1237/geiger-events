"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Pencil, Plus, Users } from "lucide-react";
import {
  Badge, Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, LogoLoading,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@geiger/ui";
import { toast } from "sonner";
import { DataTable, EditorSectionHeader, EmptyState, Toolbar } from "@/components/internal/shared/screen_kit";
import { OptionChip } from "../ws_ui";
import { ReviewSetupSheet } from "./review_setup_sheet";
import { useProcess } from "./use_process";

function AssignDialog({ process, setupId, onClose, onDone }) {
  const [state, setState] = useState({ plan: null, error: null });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    process.api.reviewAction({ action: "plan", setupId }).then(({ data, error }) => setState({ plan: data?.plan ?? null, error }));
  }, [process.api, setupId]);
  const apply = async () => {
    setBusy(true);
    const { data, error } = await process.api.reviewAction({ action: "apply", setupId });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Created ${data.created} review${data.created === 1 ? "" : "s"}`);
    onDone();
  };
  const plan = state.plan;
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Assign reviewers</DialogTitle>
          <DialogDescription>A preview of the new reviews. Existing reviews are kept and count towards each reviewer&apos;s load.</DialogDescription>
        </DialogHeader>
        {!plan && !state.error ? <div className="flex justify-center py-10"><LogoLoading size={40} aria-label="Planning" /></div> : null}
        {state.error ? <p className="text-sm text-red-600">{state.error.message}</p> : null}
        {plan ? (
          <div className="max-h-[50vh] space-y-3 overflow-y-auto">
            <p className="text-sm text-text-secondary">{plan.pairs.length} new review{plan.pairs.length === 1 ? "" : "s"} from {plan.reviewers} reviewers · {plan.conflicts} conflicts avoided</p>
            {plan.unfilled.length ? (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
                {plan.unfilled.map((item) => <p key={item.submissionId}>{item.submission}: {item.missing} short — {item.reason.toLowerCase()}</p>)}
              </div>
            ) : null}
            <ul className="divide-y divide-border rounded-lg border border-border text-sm">
              {plan.pairs.map((pair) => (
                <li key={`${pair.submissionId}-${pair.reviewerId}`} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="truncate">{pair.submission}</span>
                  <span className="shrink-0 text-text-secondary">{pair.reviewer}{pair.topics ? ` · ${pair.topics} topic${pair.topics === 1 ? "" : "s"}` : ""}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={apply} disabled={busy || !plan?.pairs.length}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Create reviews</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Peer review: results per submission (score, spread, flags), reviewer assignment and decisions.
export function ReviewScreen({ eventId, ws }) {
  const process = useProcess(eventId);
  const [chosen, setChosen] = useState(null);
  const [editing, setEditing] = useState(null);
  const [assigning, setAssigning] = useState(false);
  const [version, setVersion] = useState(0);
  const [state, setState] = useState({ key: null, data: null, error: null });
  const setupId = chosen ?? process.setups[0]?.id ?? null;
  const key = setupId ? `${setupId}:${version}` : null;

  useEffect(() => {
    if (!key) return undefined;
    const controller = new AbortController();
    process.api.review(key.split(":")[0], controller.signal).then(({ data, error }) => {
      if (!controller.signal.aborted) setState({ key, data, error });
    }).catch(() => {});
    return () => controller.abort();
  }, [process.api, key]);

  if (!process.data && process.status !== "error") return <div className="flex justify-center py-20"><LogoLoading size={56} aria-label="Loading review" /></div>;
  const canConfigure = Boolean(ws.can?.configure);
  const sheet = (
    <ReviewSetupSheet open={Boolean(editing)} onOpenChange={(open) => { if (!open) setEditing(null); }} eventId={eventId} ws={ws} process={process}
      setup={editing?.id ? editing : null} onSaved={(setup) => { setChosen(setup.id); setVersion((n) => n + 1); }} />
  );
  if (!process.setups.length) {
    return (
      <div className="space-y-5">
        <EditorSectionHeader title="Review" description="Assign reviewers to submissions, score them with a rubric and decide." />
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState icon={Users} title="No review set up yet" description="Connect your submissions, reviews and reviewers lists to assign and score reviews."
            action={canConfigure ? <Button onClick={() => setEditing({})}><Plus className="h-4 w-4" />Set up review</Button> : null} />
        </div>
        {sheet}
      </div>
    );
  }

  const setup = process.setups.find((item) => item.id === setupId);
  const submissions = ws.objects.find((object) => object.id === setup?.config?.submissionsObjectId);
  const decisions = (setup?.config?.decisions ?? []).map((key) => submissions?.statuses?.find((status) => status.key === key)).filter(Boolean);
  const decide = async (row, status) => {
    const { error } = await process.api.reviewAction({ action: "decide", recordId: row.id, status });
    if (error) toast.error(error.message); else { toast.success("Decision saved"); setVersion((n) => n + 1); }
  };
  const results = state.key === key ? state.data?.results ?? [] : state.data?.results ?? [];
  const columns = [
    { key: "title", header: submissions?.name ?? "Submission", render: (row) => <span className="font-medium text-foreground">{row.title || `#${row.number}`}</span> },
    { key: "status", header: "Status", render: (row) => { const status = submissions?.statuses?.find((item) => item.key === row.status); return status ? <OptionChip option={status} /> : null; } },
    { key: "done", header: "Reviews", render: (row) => <span className="text-text-secondary">{row.done} of {row.assigned}</span> },
    { key: "average", header: "Score", align: "right", render: (row) => (row.average === null ? <span className="text-text-tertiary">—</span> : <span className="tabular-nums">{row.average}</span>) },
    { key: "spread", header: "Spread", align: "right", render: (row) => (row.flagged ? <Badge variant="warning"><AlertTriangle className="h-3 w-3" />{row.spread}</Badge> : <span className="tabular-nums text-text-secondary">{row.done > 1 ? row.spread : "—"}</span>) },
    {
      key: "decide", header: "", align: "right", render: (row) => (
        <div className="flex justify-end gap-1">
          {decisions.filter((status) => status.key !== row.status).map((status) => (
            <Button key={status.key} size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => decide(row, status.key)}>{status.label}</Button>
          ))}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <EditorSectionHeader title="Review" description="Scores are the weighted rubric average of finished reviews. A wide spread means reviewers disagree."
        action={canConfigure ? (
          <>
            <Button variant="outline" onClick={() => setEditing(setup)}><Pencil className="h-4 w-4" />Edit setup</Button>
            <Button onClick={() => setAssigning(true)}><Users className="h-4 w-4" />Assign reviewers</Button>
          </>
        ) : null} />
      <Toolbar>
        <Select value={setupId} onValueChange={setChosen}>
          <SelectTrigger className="h-9 w-56"><SelectValue /></SelectTrigger>
          <SelectContent>{process.setups.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
        </Select>
        {canConfigure ? <Button variant="ghost" size="sm" onClick={() => setEditing({})}><Plus className="h-4 w-4" />New setup</Button> : null}
      </Toolbar>
      {state.key !== key && !state.data ? <div className="flex justify-center py-16"><LogoLoading size={48} aria-label="Loading results" /></div>
        : state.error ? <EmptyState title="Couldn't load the results" description={state.error.message} action={<Button variant="outline" onClick={() => setVersion((n) => n + 1)}>Try again</Button>} />
          : <DataTable columns={columns} data={results} getRowKey={(row) => row.id} empty={<div className="rounded-xl border border-border bg-surface-subtle"><EmptyState icon={Users} title="No submissions match" /></div>} />}
      {assigning ? <AssignDialog process={process} setupId={setupId} onClose={() => setAssigning(false)} onDone={() => { setAssigning(false); setVersion((n) => n + 1); }} /> : null}
      {sheet}
    </div>
  );
}
