"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Pencil, Plus, Users } from "lucide-react";
import {
  Badge, Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DataTable, LoadingArea, Progress,
  SegmentedTabs, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, StatsBar,
} from "@geiger/ui";
import { toast } from "sonner";
import { EmptyState } from "@/components/internal/shared/screen_kit";
import { OptionChip } from "../ws_ui";
import { PageBar, PageBody, PageToolbar, TOOLBAR_TABS, WorkspacePage } from "../shell/page";
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
        {!plan && !state.error ? <LoadingArea size={40} label="Planning" className="py-10" /> : null}
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

const round = (n) => Math.round(n * 10) / 10;

// Peer review: results per submission (score, spread, flags), reviewer assignment and decisions.
export function ReviewScreen({ eventId, ws }) {
  const process = useProcess(eventId);
  const [chosen, setChosen] = useState(null);
  const [editing, setEditing] = useState(null);
  const [assigning, setAssigning] = useState(false);
  const [version, setVersion] = useState(0);
  const [show, setShow] = useState("all");
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

  const canConfigure = Boolean(ws.can?.configure);
  const setup = process.setups.find((item) => item.id === setupId);
  const sheet = (
    <ReviewSetupSheet open={Boolean(editing)} onOpenChange={(open) => { if (!open) setEditing(null); }} eventId={eventId} ws={ws} process={process}
      setup={editing?.id ? editing : null} onSaved={(saved) => { setChosen(saved.id); setVersion((n) => n + 1); }} />
  );
  const bar = (
    <PageBar icon={Users} title="Review" actions={canConfigure && setup ? (
      <>
        <Button variant="outline" size="sm" onClick={() => setEditing(setup)}><Pencil className="h-3.5 w-3.5" />Edit setup</Button>
        <Button size="sm" onClick={() => setAssigning(true)}><Users className="h-4 w-4" />Assign reviewers</Button>
      </>
    ) : null} />
  );

  if (!process.data && process.status !== "error") {
    return <WorkspacePage>{bar}<LoadingArea size={56} label="Loading review" /></WorkspacePage>;
  }
  if (!process.setups.length) {
    return (
      <WorkspacePage>
        {bar}
        <PageBody className="flex items-center justify-center">
          <EmptyState icon={Users} title="No review set up yet" description="Connect your submissions, reviews and reviewers lists to assign reviewers, score with a rubric and decide."
            action={canConfigure ? <Button onClick={() => setEditing({})}><Plus className="h-4 w-4" />Set up review</Button> : null} />
        </PageBody>
        {sheet}
      </WorkspacePage>
    );
  }

  const submissions = ws.objects.find((object) => object.id === setup?.config?.submissionsObjectId);
  const decisionKeys = setup?.config?.decisions ?? [];
  const decisions = decisionKeys.map((item) => submissions?.statuses?.find((status) => status.key === item)).filter(Boolean);
  const decide = async (row, status) => {
    const { error } = await process.api.reviewAction({ action: "decide", recordId: row.id, status });
    if (error) toast.error(error.message); else { toast.success("Decision saved"); setVersion((n) => n + 1); }
  };
  const results = state.data?.results ?? [];
  const undecided = results.filter((row) => !decisionKeys.includes(row.status));
  const flagged = results.filter((row) => row.flagged);
  const rows = show === "decide" ? undecided : show === "spread" ? flagged : results;
  const done = results.reduce((n, row) => n + row.done, 0);
  const assigned = results.reduce((n, row) => n + row.assigned, 0);
  const scored = results.filter((row) => row.average !== null);
  const average = scored.length ? round(scored.reduce((n, row) => n + row.average, 0) / scored.length) : null;
  const loading = state.key !== key && !state.data;
  const columns = [
    { key: "title", header: submissions?.name ?? "Submission", render: (row) => <span className="font-medium text-foreground">{row.title || `${submissions?.numberPrefix ?? "#"}-${row.number}`}</span> },
    { key: "status", header: "Status", headClassName: "hidden md:table-cell", className: "hidden md:table-cell", render: (row) => {
      const status = submissions?.statuses?.find((item) => item.key === row.status);
      return status ? <OptionChip option={status} /> : null;
    } },
    { key: "done", header: "Reviews", headClassName: "hidden md:table-cell", className: "hidden md:table-cell", render: (row) => (
      <span className="flex items-center gap-2 whitespace-nowrap text-xs text-muted-foreground">
        <Progress value={row.assigned ? (row.done / row.assigned) * 100 : 0} className="h-1 w-14" />{row.done} of {row.assigned}
      </span>
    ) },
    { key: "average", header: "Score", align: "right", render: (row) => (row.average === null ? <span className="text-text-tertiary">—</span> : <span className="tabular-nums">{row.average}</span>) },
    { key: "spread", header: "Spread", align: "right", headClassName: "hidden sm:table-cell", className: "hidden sm:table-cell", render: (row) => (row.flagged
      ? <Badge variant="warning"><AlertTriangle className="h-3 w-3" />{row.spread}</Badge>
      : <span className="tabular-nums text-text-secondary">{row.done > 1 ? row.spread : "—"}</span>) },
    { key: "decide", header: "Decide", align: "right", render: (row) => (
      <span className="flex flex-wrap justify-end gap-1">
        {decisions.filter((item) => item.key !== row.status).map((item) => (
          <Button key={item.key} size="xs" variant="outline" onClick={() => decide(row, item.key)}>{item.label}</Button>
        ))}
      </span>
    ) },
  ];

  return (
    <WorkspacePage>
      {bar}
      <PageToolbar>
        <div className="flex items-center gap-2">
          <Select value={setupId} onValueChange={setChosen}>
            <SelectTrigger className="h-8 w-60 shrink-0"><SelectValue /></SelectTrigger>
            <SelectContent>{process.setups.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
          </Select>
          {canConfigure ? <Button variant="ghost" size="sm" className="shrink-0 text-muted-foreground" onClick={() => setEditing({})}><Plus className="h-4 w-4" />New setup</Button> : null}
        </div>
        <SegmentedTabs {...TOOLBAR_TABS} value={show} onChange={setShow} tabs={[
          { label: <span className="inline-flex items-center gap-1.5">All<span className="text-xs text-text-secondary">{results.length}</span></span>, value: "all" },
          { label: <span className="inline-flex items-center gap-1.5">Needs a decision<span className="text-xs text-text-secondary">{undecided.length}</span></span>, value: "decide" },
          { label: <span className="inline-flex items-center gap-1.5">Wide spread<span className="text-xs text-text-secondary">{flagged.length}</span></span>, value: "spread" },
        ]} />
      </PageToolbar>
      <PageBody padded>
        {loading ? <LoadingArea size={48} label="Loading results" />
          : state.error ? <EmptyState title="Couldn't load the results" description={state.error.message} action={<Button variant="outline" onClick={() => setVersion((n) => n + 1)}>Try again</Button>} />
            : (
              <div className="grid gap-4">
                <StatsBar stats={[
                  { label: submissions?.plural ?? "Submissions", value: String(results.length) },
                  { label: "Reviews done", value: String(done), footer: `of ${assigned} assigned` },
                  { label: "Average score", value: average === null ? "—" : String(average) },
                  { label: "Wide spread", value: String(flagged.length) },
                ]} />
                <p className="text-xs text-text-secondary">Scores are the weighted rubric average of finished reviews. A wide spread means reviewers disagree.</p>
                <DataTable columns={columns} data={rows} getRowKey={(row) => row.id}
                  empty={<div className="rounded-xl border border-border bg-surface-subtle"><EmptyState icon={Users} title={show === "all" ? `No ${submissions?.plural?.toLowerCase() ?? "submissions"} yet` : "Nothing here"} /></div>} />
              </div>
            )}
      </PageBody>
      {assigning ? <AssignDialog process={process} setupId={setupId} onClose={() => setAssigning(false)} onDone={() => { setAssigning(false); setVersion((n) => n + 1); }} /> : null}
      {sheet}
    </WorkspacePage>
  );
}
