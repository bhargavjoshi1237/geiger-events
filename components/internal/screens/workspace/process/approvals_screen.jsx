"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, BadgeCheck, Check, Loader2, X } from "lucide-react";
import { Avatar, AvatarFallback, Badge, Button, Label, LoadingArea, SectionCard, SegmentedTabs, Textarea } from "@geiger/ui";
import { toast } from "sonner";
import { EmptyState } from "@/components/internal/shared/screen_kit";
import { cn } from "@/lib/utils";
import { workspaceApi } from "@/lib/workspace/client";
import { getType } from "@/lib/workspace/schema/types/index.js";
import { RecordSheet } from "../record/record_sheet";
import { liveFieldsOf } from "../state/use_workspace";
import { timeAgo } from "../state/format";
import { FieldValue, ObjectIcon } from "../ws_ui";
import { PageBar, WorkspacePage } from "../shell/page";
import { setApprovalCount, useProcess } from "./use_process";

const STATUS = { pending: ["Pending", "warning"], approved: ["Approved", "success"], rejected: ["Rejected", "danger"], cancelled: ["Cancelled", "neutral"] };
const SUMMARY_SKIP = new Set(["long_text", "rich_text", "attachments", "link_record", "link_event"]);
const initials = (name) => String(name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
const ruleText = (approval) => {
  const done = approval.decisions.filter((item) => item.decision === "approve").length;
  return approval.rule === "all" ? `Everyone must approve · ${done} of ${approval.approverNames.length}` : "Any one can decide";
};

// The record an approval is about: a few of its fields, so the decision doesn't need another click.
function RecordSummary({ eventId, ws, reference, onOpen }) {
  const [state, setState] = useState({ id: null, record: null });
  useEffect(() => {
    if (!reference?.id) return undefined;
    let alive = true;
    workspaceApi.record(eventId, reference.id).then(({ data }) => { if (alive) setState({ id: reference.id, record: data?.record ?? null }); });
    return () => { alive = false; };
  }, [eventId, reference?.id]);
  const fields = useMemo(() => liveFieldsOf(ws.data, reference?.objectId).filter((field) => !SUMMARY_SKIP.has(field.type) && getType(field.type)).slice(0, 4), [ws.data, reference?.objectId]);
  if (!reference) return null;
  const record = state.id === reference.id ? state.record : null;
  return (
    <SectionCard title={reference.label} bodyPadding={false} action={<Button variant="ghost" size="xs" className="text-muted-foreground" onClick={onOpen}>Open record</Button>}>
      {record && fields.length ? (
        <div className="grid grid-cols-2 sm:grid-cols-4">
          {fields.map((field, index) => (
            <div key={field.id} className={cn("grid content-start gap-1.5 px-4 py-3", index % 2 && "border-l border-border/70", index > 1 && "border-t border-border/70 sm:border-t-0", index && "sm:border-l")}>
              <span className="truncate text-xs text-text-secondary">{field.name}</span>
              <span className="min-w-0 text-[13px] text-foreground"><FieldValue field={field} record={record} eventId={eventId} timeZone={ws.data.event?.timeZone} /></span>
            </div>
          ))}
        </div>
      ) : record === null && state.id !== reference.id ? <LoadingArea size={32} label="Loading record" className="py-6" /> : null}
    </SectionCard>
  );
}

function Detail({ eventId, ws, process, approval, automationName, onDone, onOpenRecord }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(null);
  const [label, variant] = STATUS[approval.status] ?? [approval.status, "neutral"];
  const object = ws.objects.find((item) => item.id === approval.record?.objectId);

  const decide = async (decision) => {
    setBusy(decision);
    const { data, error } = await process.api.approval({ action: "decide", id: approval.id, decision, note });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    if (data.approval?.appliedError) toast.error(`Decision saved, but the record wasn't updated: ${data.approval.appliedError}`);
    else toast.success(decision === "approve" ? "Approved" : "Rejected");
    setNote("");
    onDone();
  };
  const cancel = async () => {
    setBusy("cancel");
    const { error } = await process.api.approval({ action: "cancel", id: approval.id });
    setBusy(null);
    if (error) toast.error(error.message); else { toast.success("Approval cancelled"); onDone(); }
  };

  return (
    <div className="grid max-w-[680px] gap-6">
      <div className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={variant}>{label}</Badge>
          <span className="text-xs text-text-secondary">Asked {timeAgo(approval.createdAt)}{automationName ? <> by <span className="text-muted-foreground">{automationName}</span></> : null}</span>
        </div>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">{approval.title}</h2>
        {approval.record ? (
          <button type="button" onClick={() => onOpenRecord(approval.record)} className="inline-flex items-center gap-1.5 justify-self-start text-[13px] text-muted-foreground hover:text-foreground hover:underline">
            <ObjectIcon icon={object?.icon} className="h-3.5 w-3.5" />{approval.record.label}{object ? ` · ${object.numberPrefix}-${approval.record.number}` : ""}<ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        ) : <span className="text-[13px] text-text-secondary">The record was deleted.</span>}
        {approval.message ? <p className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-muted-foreground">{approval.message}</p> : null}
        {approval.appliedError ? <p className="text-xs text-red-600 dark:text-red-400">The record wasn&apos;t updated: {approval.appliedError}</p> : null}
      </div>

      <SectionCard title="Approvers" description={ruleText(approval)} bodyPadding={false}>
        {approval.approverNames.map((person) => {
          const decision = approval.decisions.find((item) => item.userId === person.userId);
          return (
            <div key={person.userId} className="flex items-center gap-2.5 border-b border-border/70 px-4 py-2.5 last:border-b-0">
              <Avatar size="sm"><AvatarFallback className="text-[11px] font-semibold text-foreground">{initials(person.name)}</AvatarFallback></Avatar>
              <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">{person.name}</span>
              {decision?.decision === "approve" ? <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400"><Check className="h-3.5 w-3.5" />Approved {decision.at ? timeAgo(decision.at) : ""}</span>
                : decision?.decision === "reject" ? <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400"><X className="h-3.5 w-3.5" />Rejected {decision.at ? timeAgo(decision.at) : ""}</span>
                  : <span className="text-xs text-text-secondary">{approval.status === "pending" ? "Waiting" : "Didn't decide"}</span>}
            </div>
          );
        })}
      </SectionCard>

      {approval.record ? <RecordSummary eventId={eventId} ws={ws} reference={approval.record} onOpen={() => onOpenRecord(approval.record)} /> : null}

      {approval.canDecide || (approval.status === "pending" && ws.can?.configure) ? (
        <div className="grid gap-2">
          {approval.canDecide ? (
            <>
              <Label htmlFor="ws-approval-note" className="text-[13px] font-medium text-muted-foreground">Note <span className="font-normal text-text-tertiary">(optional)</span></Label>
              <Textarea id="ws-approval-note" rows={3} value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} placeholder="Visible to the team on the record's activity." />
            </>
          ) : null}
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {approval.canDecide ? (
              <>
                <Button size="sm" disabled={Boolean(busy)} onClick={() => decide("approve")}>{busy === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Approve</Button>
                <Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => decide("reject")}>{busy === "reject" ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}Reject</Button>
              </>
            ) : null}
            <span className="flex-1" />
            {ws.can?.configure && approval.status === "pending" ? <Button size="sm" variant="ghost" className="text-muted-foreground" disabled={Boolean(busy)} onClick={cancel}>Cancel request</Button> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Decisions automations are waiting on: the queue on the left, the chosen approval on the right.
export function ApprovalsScreen({ eventId, ws }) {
  const process = useProcess(eventId);
  const [tab, setTab] = useState("mine");
  const [state, setState] = useState({ key: null, approvals: [], error: null });
  const [version, setVersion] = useState(0);
  const [chosen, setChosen] = useState(null);
  const [record, setRecord] = useState(null);
  const key = `${tab === "decided" ? "decided" : "pending"}:${version}`;

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
  const pending = state.approvals.filter((approval) => approval.status === "pending");
  const mine = state.approvals.filter((approval) => approval.canDecide);
  const rows = tab === "mine" ? mine : tab === "pending" ? pending : state.approvals.filter((approval) => approval.status !== "pending");
  const selected = rows.find((approval) => approval.id === chosen) ?? rows[0] ?? null;
  const automationName = (id) => process.automations.find((automation) => automation.id === id)?.name ?? null;
  const loading = state.key !== key && !state.approvals.length;
  const tabs = [
    { label: <span className="inline-flex items-center gap-1.5">Waiting for me{state.key?.startsWith("pending") ? <span className="text-xs text-text-secondary">{mine.length}</span> : null}</span>, value: "mine" },
    { label: <span className="inline-flex items-center gap-1.5">All pending{state.key?.startsWith("pending") ? <span className="text-xs text-text-secondary">{pending.length}</span> : null}</span>, value: "pending" },
    { label: "Decided", value: "decided" },
  ];

  return (
    <WorkspacePage>
      <PageBar icon={BadgeCheck} title="Approvals" note="Decisions automations are waiting on" />
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex max-h-[45%] min-h-0 shrink-0 flex-col border-b border-border/70 lg:max-h-none lg:w-[400px] lg:border-b-0 lg:border-r">
          <div className="shrink-0 border-b border-border/70 px-4 py-3">
            <SegmentedTabs fullWidth value={tab} onChange={(next) => { setTab(next); setChosen(null); }} tabs={tabs} buttonClassName="h-7" />
          </div>
          <div className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto">
            {loading ? <LoadingArea size={40} label="Loading approvals" />
              : state.error ? <EmptyState title="Couldn't load approvals" description={state.error.message} action={<Button variant="outline" onClick={refresh}>Try again</Button>} />
                : rows.length ? rows.map((approval) => {
                  const [label, variant] = STATUS[approval.status] ?? [approval.status, "neutral"];
                  return (
                    <button key={approval.id} type="button" onClick={() => setChosen(approval.id)}
                      className={cn("grid w-full gap-1 border-b border-border/70 px-4 py-3.5 text-left", selected?.id === approval.id ? "bg-surface-card" : "hover:bg-surface-subtle")}>
                      <span className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">{approval.title}</span>
                        <span className="shrink-0 text-xs text-text-tertiary">{timeAgo(approval.createdAt)}</span>
                      </span>
                      <span className="truncate text-xs text-muted-foreground">{approval.record?.label ?? "Deleted record"}</span>
                      <span className="mt-0.5 flex items-center gap-2">
                        <Badge variant={variant}>{label}</Badge>
                        <span className="truncate text-xs text-text-secondary">{ruleText(approval)}</span>
                      </span>
                    </button>
                  );
                }) : (
                  <EmptyState icon={BadgeCheck} title={tab === "mine" ? "Nothing waiting for you" : tab === "pending" ? "No pending approvals" : "No decisions yet"}
                    description="Approvals come from automations with an “Ask for approval” step." />
                )}
          </div>
        </div>
        <div className="scrollbar-subtle min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-6 sm:px-10 sm:py-7">
          {selected ? (
            <Detail key={selected.id} eventId={eventId} ws={ws} process={process} approval={selected} automationName={automationName(selected.automationId)}
              onDone={refresh} onOpenRecord={setRecord} />
          ) : !loading ? <p className="py-12 text-center text-sm text-text-secondary">Choose an approval to see the details.</p> : null}
        </div>
      </div>
      <RecordSheet open={Boolean(record)} onOpenChange={(open) => { if (!open) setRecord(null); }}
        eventId={eventId} data={ws.data} objectId={record?.objectId} recordId={record?.id} timeZone={ws.data.event?.timeZone}
        can={ws.can} run={ws.run} onOpenRecord={(id, objectId) => setRecord((current) => ({ id, objectId: objectId ?? current?.objectId }))} />
    </WorkspacePage>
  );
}
