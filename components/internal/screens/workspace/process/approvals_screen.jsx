"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, Check, Loader2, X } from "lucide-react";
import {
  Badge, Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Label, LogoLoading, Textarea,
} from "@geiger/ui";
import { toast } from "sonner";
import { EditorSectionHeader, EmptyState, SegmentedTabs, Toolbar } from "@/components/internal/shared/screen_kit";
import { RecordSheet } from "../record/record_sheet";
import { timeAgo } from "../state/format";
import { setApprovalCount, useProcess } from "./use_process";

const TABS = [{ label: "Waiting for me", value: "mine" }, { label: "All pending", value: "pending" }, { label: "Decided", value: "decided" }];
const STATUS = { pending: ["Pending", "warning"], approved: ["Approved", "success"], rejected: ["Rejected", "danger"], cancelled: ["Cancelled", "neutral"] };

function DecideDialog({ approval, decision, onClose, onDone, process }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    const { data, error } = await process.api.approval({ action: "decide", id: approval.id, decision, note });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    if (data.approval?.appliedError) toast.error(`Decision saved, but the record wasn't updated: ${data.approval.appliedError}`);
    else toast.success(decision === "approve" ? "Approved" : "Rejected");
    onDone();
  };
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{decision === "approve" ? "Approve" : "Reject"} “{approval.title}”</DialogTitle>
          <DialogDescription>{approval.record?.label ?? "The record"} will be updated as the automation set out.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="ws-approval-note">Note (optional)</Label>
          <Textarea id="ws-approval-note" rows={3} value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant={decision === "approve" ? "default" : "destructive"} onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{decision === "approve" ? "Approve" : "Reject"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Approvals automations asked for: decide the ones waiting on you, see who decided the rest.
export function ApprovalsScreen({ eventId, ws }) {
  const process = useProcess(eventId);
  const [tab, setTab] = useState("mine");
  const [state, setState] = useState({ key: null, approvals: [], error: null });
  const [version, setVersion] = useState(0);
  const [deciding, setDeciding] = useState(null);
  const [record, setRecord] = useState(null);
  const key = `${tab}:${version}`;

  useEffect(() => {
    const controller = new AbortController();
    const status = key.startsWith("decided") ? null : "pending";
    process.api.approvals(status ? { status } : {}, controller.signal).then(({ data, error }) => {
      if (controller.signal.aborted) return;
      setState({ key, approvals: data?.approvals ?? [], error });
      if (data) setApprovalCount(eventId, data.mine ?? 0);
    }).catch(() => {});
    return () => controller.abort();
  }, [process.api, key, eventId]);

  const refresh = () => setVersion((n) => n + 1);
  const cancel = async (approval) => {
    const { error } = await process.api.approval({ action: "cancel", id: approval.id });
    if (error) toast.error(error.message); else { toast.success("Approval cancelled"); refresh(); }
  };

  const rows = state.approvals.filter((approval) => (tab === "mine" ? approval.canDecide : tab === "pending" ? approval.status === "pending" : approval.status !== "pending"));

  return (
    <div className="space-y-5">
      <EditorSectionHeader title="Approvals" description="Decisions automations are waiting on. Approving or rejecting updates the record the way the automation set out." />
      <Toolbar><SegmentedTabs value={tab} onChange={setTab} tabs={TABS} /></Toolbar>
      {state.key !== key && !state.approvals.length ? <div className="flex justify-center py-16"><LogoLoading size={48} aria-label="Loading approvals" /></div>
        : state.error ? <EmptyState title="Couldn't load approvals" description={state.error.message} action={<Button variant="outline" onClick={refresh}>Try again</Button>} />
          : rows.length ? (
            <div className="space-y-3">
              {rows.map((approval) => {
                const [label, variant] = STATUS[approval.status] ?? [approval.status, "neutral"];
                return (
                  <div key={approval.id} className="space-y-3 rounded-xl border border-border bg-surface-subtle p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-semibold text-foreground">{approval.title}</p>
                        <p className="text-xs text-text-secondary">
                          {approval.record ? <button type="button" className="underline-offset-2 hover:underline" onClick={() => setRecord(approval.record)}>{approval.record.label}</button> : "Deleted record"}
                          {" · "}asked {timeAgo(approval.createdAt)} · {approval.rule === "all" ? "everyone must approve" : "any one can decide"}
                        </p>
                      </div>
                      <Badge variant={variant}>{label}</Badge>
                    </div>
                    {approval.message ? <p className="whitespace-pre-line text-sm text-text-secondary">{approval.message}</p> : null}
                    <div className="flex flex-wrap gap-2">
                      {approval.approverNames.map((person) => {
                        const decision = approval.decisions.find((item) => item.userId === person.userId);
                        return (
                          <span key={person.userId} title={decision?.note || undefined}
                            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-card px-2.5 py-1 text-xs">
                            {decision?.decision === "approve" ? <Check className="h-3 w-3 text-emerald-600" /> : decision?.decision === "reject" ? <X className="h-3 w-3 text-red-600" /> : null}
                            {person.name}
                          </span>
                        );
                      })}
                    </div>
                    {approval.appliedError ? <p className="text-xs text-red-600 dark:text-red-400">The record wasn&apos;t updated: {approval.appliedError}</p> : null}
                    {approval.canDecide || (approval.status === "pending" && ws.can?.configure) ? (
                      <div className="flex flex-wrap gap-2">
                        {approval.canDecide ? (
                          <>
                            <Button size="sm" onClick={() => setDeciding({ approval, decision: "approve" })}><Check className="h-4 w-4" />Approve</Button>
                            <Button size="sm" variant="outline" onClick={() => setDeciding({ approval, decision: "reject" })}><X className="h-4 w-4" />Reject</Button>
                          </>
                        ) : null}
                        {ws.can?.configure && approval.status === "pending" ? <Button size="sm" variant="ghost" onClick={() => cancel(approval)}>Cancel request</Button> : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-surface-subtle">
              <EmptyState icon={BadgeCheck} title={tab === "mine" ? "Nothing waiting for you" : tab === "pending" ? "No pending approvals" : "No decisions yet"}
                description="Approvals come from automations with an “Ask for approval” step." />
            </div>
          )}
      {deciding ? <DecideDialog {...deciding} process={process} onClose={() => setDeciding(null)} onDone={() => { setDeciding(null); refresh(); }} /> : null}
      <RecordSheet open={Boolean(record)} onOpenChange={(open) => { if (!open) setRecord(null); }}
        eventId={eventId} data={ws.data} objectId={record?.objectId} recordId={record?.id} timeZone={ws.data.event?.timeZone}
        can={ws.can} run={ws.run} onOpenRecord={(id, objectId) => setRecord((current) => ({ id, objectId: objectId ?? current?.objectId }))} />
    </div>
  );
}
