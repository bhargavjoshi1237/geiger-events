"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, LogoLoading } from "@geiger/ui";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { useWorkflow } from "@/components/internal/screens/operations/workflow_use";
import { Empty, WorkflowCard, WorkflowStatus } from "@/components/internal/screens/operations/workflow_forms";
import { WorkflowEvaluations } from "@/components/internal/screens/operations/workflow_evaluations";
import { AttendancePanel, ReleaseItems, Schedule, TaskList } from "@/components/internal/screens/operations/workflow_panel";
import { OperationsAuth } from "./operations_auth";

export function OperationsPortal({ eventId, member: initialMember, invitationToken, setupToken }) {
  const [member, setMember] = useState(initialMember);
  return <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-8 sm:py-10">
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-5">
        <div><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">Geiger Events</p><h1 className="text-2xl font-semibold tracking-tight">Your event work</h1><p className="mt-2 text-sm text-muted-foreground">Placements, evaluations and responsibilities assigned to you.</p></div>
        {member ? <div className="text-sm"><p className="font-medium">{member.name || member.email}</p><Link href="/members" className="text-primary underline underline-offset-4">Member account</Link></div> : null}
      </header>
      {member ? <ParticipantWorkflow key={`${eventId}:${member.id}`} eventId={eventId} invitationToken={invitationToken} member={member} onSessionExpired={() => setMember(null)} />
        : <OperationsAuth eventId={eventId} invitationToken={invitationToken} setupToken={setupToken} onSignedIn={setMember} />}
    </div>
  </main>;
}

function ParticipantWorkflow({ eventId, invitationToken, member, onSessionExpired }) {
  const workflow = useWorkflow(eventId, true);
  const [token, setToken] = useState(invitationToken);
  const data = workflow.data;
  const personId = data?.personId || data?.person?.id;
  const people = data?.people || [];
  const activities = data?.activities || [];
  const assignments = data?.assignments || [];
  const own = assignments.filter((item) => item.personId === personId && item.status === "active");
  const names = new Map(people.map((item) => [item.id, item.name]));
  const titles = new Map(activities.map((item) => [item.id, item.title]));
  const attendanceActivityIds = new Set(own.filter((item) => item.role === "staff").map((item) => item.activityId));
  const latestRelease = [...(data?.releases || [])].sort((a, b) => b.version - a.version)[0];
  const accept = async () => {
    await workflow.accept(token, () => {
      setToken(null);
      const url = new URL(window.location.href);
      url.searchParams.delete("invite"); url.searchParams.delete("token");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    });
  };
  return <div className="space-y-5">
    <WorkflowStatus workflow={workflow} />
    {token ? <WorkflowCard title="Accept your invitation" description={`Signed in as ${member.email}. Accept to link this account to the person named in your invitation.`}>
      <Button disabled={workflow.busy || workflow.uncertain} onClick={accept}><ShieldCheck className="mr-2 size-4" />Accept invitation</Button>
    </WorkflowCard> : null}
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{data ? `Revision ${data.revision}` : "Access requires a verified invitation and current assignment."}</p><Button variant="outline" size="sm" disabled={workflow.loading || workflow.busy} onClick={workflow.load}><RefreshCw className="mr-2 size-4" />Load latest</Button></div>
    {workflow.error?.status === 401 ? <WorkflowCard title="Your session has expired"><Button variant="outline" onClick={onSessionExpired}>Sign in again</Button></WorkflowCard> : null}
    {workflow.loading && !data ? <div className="flex items-center gap-3 py-8 text-sm text-muted-foreground"><LogoLoading size={30} />Checking your assigned work…</div>
      : !data ? <Empty>{token ? "Accept the invitation above to load your assigned work." : "No event access is available. Ask the organiser for an invitation or a current assignment."}</Empty>
      : !data.enabled ? <Empty>Operations are currently disabled for this event. Contact the organiser.</Empty>
      : <>
        {data.truncated ? <p role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">This view is incomplete because the event exceeds the snapshot limit. Ask the organiser for a complete programme before acknowledging a placement.</p> : null}
        <WorkflowCard title="Your released placements" description="Acknowledgements apply to the current published version. Review a new release before acknowledging again.">
          {latestRelease ? <><p className="text-sm font-medium">Programme version {latestRelease.version}</p><ReleaseItems release={latestRelease} />
            <div className="space-y-2">{(latestRelease.items || []).map((item) => {
              const activityId = item.activityId || item.id || item.activity?.id;
              const canAcknowledge = own.some((assignment) => assignment.activityId === activityId && ["presenter", "participant"].includes(assignment.role));
              const acknowledged = (data.acknowledgements || []).some((entry) => entry.releaseId === latestRelease.id && entry.activityId === activityId && entry.personId === personId);
              return canAcknowledge ? <div key={activityId} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3 text-sm"><span>{item.title || item.activity?.title || titles.get(activityId)}</span>
                {acknowledged ? <span className="text-emerald-700 dark:text-emerald-400">Acknowledged</span> : <Button size="sm" variant="outline" disabled={workflow.busy || workflow.uncertain || Boolean(data.truncated)} onClick={() => workflow.submit("acknowledgePlacement", { releaseId: latestRelease.id, activityId })}>Acknowledge placement</Button>}</div> : null;
            })}</div></> : <Empty>The organiser has not released your placements yet.</Empty>}
        </WorkflowCard>
        <WorkflowCard title="Current assigned activities"><Schedule activities={activities} resources={data.resources || []} assignments={own} names={names} /></WorkflowCard>
        {own.some((item) => item.role === "evaluator") ? <WorkflowEvaluations workflow={workflow} portal /> : null}
        <WorkflowCard title="Released results">{data.results?.length ? <ul className="divide-y divide-border text-sm">{data.results.map((result) => <li key={`${result.cycleId}:${result.activityId}`} className="py-3"><p className="font-medium">{result.title || titles.get(result.activityId)}</p>
          <p className="mt-1">{result.score == null ? "No submitted scores" : `${Number(result.score).toFixed(1)} / 100`} · {result.evaluatorCount || 0} submitted evaluations</p>{Array.isArray(result.feedback) && result.feedback.length ? <div className="mt-3 space-y-2"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Approved feedback</p>{result.feedback.map((feedback, index) => <p key={index} className="whitespace-pre-wrap text-muted-foreground">{feedback}</p>)}</div> : null}</li>)}</ul> : <Empty>No released results for your work.</Empty>}</WorkflowCard>
        {attendanceActivityIds.size ? <AttendancePanel workflow={workflow} people={people} activities={activities.filter((item) => attendanceActivityIds.has(item.id))} /> : null}
        <TaskList workflow={workflow} names={names} titles={titles} portal />
        <WorkflowCard title="Event notices">{data.outbox?.length ? <ul className="divide-y divide-border text-sm">{data.outbox.map((notice) => <li key={notice.id} className="py-3"><p className="font-medium">{notice.kind?.replaceAll("_", " ")}</p><p className="mt-1 text-muted-foreground">{notice.payload?.message || notice.payload?.title || "Review your current programme and assigned work above."}</p></li>)}</ul> : <Empty>No notices.</Empty>}</WorkflowCard>
      </>}
  </div>;
}
