"use client";

import { useEffect, useRef, useState } from "react";
import { Button, LogoLoading } from "@geiger/ui";
import { CalendarDays, CheckCircle2, RefreshCw, Users } from "lucide-react";
import { useWorkflow } from "./workflow_use";
import { ActionForm, Empty, WorkflowCard, WorkflowStatus, choices, optionalDate, optionsFor } from "./workflow_forms";
import { WorkflowEvaluations, WorkflowCycles, WorkflowFeedback } from "./workflow_evaluations";
import { WorkflowAcceptedImport, WorkflowImport } from "./workflow_import";
import { WorkflowHistory } from "./workflow_history";
import { dateLabel, effectiveResourceId } from "./workflow_client";

const TABS = ["People", "Resources", "Activities", "Schedule", "Assignments", "Programme", "Evaluations", "Attendance", "Tasks", "Notices", "Import & export"];
const roleOptions = choices(["presenter", "evaluator", "staff", "volunteer", "participant"]);
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function WorkflowPanel({ eventId, onWorkspaceChange, workspaceDirty = false }) {
  return <StaffWorkflow key={eventId} eventId={eventId} onWorkspaceChange={onWorkspaceChange} workspaceDirty={workspaceDirty} />;
}

function StaffWorkflow({ eventId, onWorkspaceChange, workspaceDirty }) {
  const workflow = useWorkflow(eventId);
  const lastWorkspaceRevision = useRef(null);
  useEffect(() => {
    if (workflow.outcome?.action === "enableWorkflow" && lastWorkspaceRevision.current !== workflow.outcome.revision) {
      lastWorkspaceRevision.current = workflow.outcome.revision;
      onWorkspaceChange?.();
    }
  }, [workflow.outcome, onWorkspaceChange]);
  const [tab, setTab] = useState("People");
  const data = workflow.data;
  const disabled = workflow.busy || workflow.uncertain || !data;
  const people = data?.people || [];
  const resources = data?.resources || [];
  const activities = data?.activities || [];
  const assignments = data?.assignments || [];
  const cycles = data?.cycles || [];
  const names = new Map(people.map((row) => [row.id, row.name]));
  const titles = new Map(activities.map((row) => [row.id, row.title]));
  const personField = { key: "personId", label: "Person", options: optionsFor(people) };
  const activityField = { key: "activityId", label: "Activity", options: optionsFor(activities, "title") };
  const safeProgramme = !data?.truncated;

  if (workflow.loading && !data) return <div className="flex items-center gap-3 py-10 text-sm text-muted-foreground"><LogoLoading size={32} />Loading workflow…</div>;

  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-surface-card p-4">
      <div><h2 className="flex items-center gap-2 font-semibold"><CalendarDays className="size-5 text-primary" />Operational workflow</h2>
        <p className="mt-1 text-sm text-muted-foreground">People, programme and delivery responsibilities{data ? ` · revision ${data.revision}` : ""}</p></div>
      <Button variant="outline" size="sm" disabled={workflow.loading || workflow.busy} onClick={workflow.load}><RefreshCw className="mr-2 size-4" />{workflow.loading ? "Loading…" : "Load latest"}</Button>
    </div>
    <WorkflowStatus workflow={workflow} />
    {!data ? <Empty>The workflow could not be loaded. Use Load latest to retry.</Empty> : !data.enabled ? <WorkflowCard title="Enable operational workflow" description="Add native people, resources and activities to this event’s published workspace. Save and publish any existing configuration edits first.">
      {workspaceDirty ? <p role="status" className="text-sm text-amber-700">Save and publish or restore your workspace draft before enabling workflow.</p> : null}
      <Button disabled={disabled || workspaceDirty} onClick={() => workflow.submit("enableWorkflow", {})}>Enable workflow</Button>
    </WorkflowCard> : <>
      {data.truncated ? <div role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">This snapshot exceeds the 500-entry limit. Programme publication and reports are unavailable from an incomplete view. Contact your administrator for a complete report.</div> : null}
      <nav aria-label="Workflow sections" className="flex flex-wrap gap-1 border-b border-border pb-3">{TABS.map((name) => <Button key={name} size="sm" variant={tab === name ? "secondary" : "ghost"} aria-pressed={tab === name} onClick={() => setTab(name)}>{name}</Button>)}</nav>
      <div className="space-y-5">
        {tab === "People" ? <>
          <ActionForm workflow={workflow} formKey="person" action="savePerson" title="People" description="Create a person or update their event roles. Account links are granted separately." rows={people}
            fields={[{ key: "name", label: "Name" }, { key: "email", label: "Email", type: "email", optional: true }, { key: "contactId", label: "Existing contact ID", optional: true, nullable: true, help: "Optional UUID of a contact in this project." }, { key: "roles", label: "Roles", type: "roles", default: [] }]}
            transform={(payload) => ({ ...payload, email: payload.email || "" })} />
          <div className="grid gap-5 lg:grid-cols-2"><ActionForm workflow={workflow} formKey="invitation" action="invite" title="Invite a participant" description="An invitation links a verified portal account to this person. The invitation URL is returned once; copy it immediately."
            fields={[personField, { key: "expiresInDays", label: "Expires in days", type: "number", min: 1, max: 14, default: 7 }]} submitLabel="Create invitation" />
            <ActionForm workflow={workflow} formKey="staff-link" action="linkStaff" title="Link a staff account" description="Use the user ID of an existing project member. Membership is checked on the server."
              fields={[personField, { key: "userId", label: "Project member user ID", placeholder: "Verified user UUID" }]} submitLabel="Link account" /></div>
          <InvitationResult workflow={workflow} eventId={eventId} />
          <WorkflowCard title="Invitations">{data.invitations?.length ? <ul className="divide-y divide-border">{data.invitations.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
            <div><p className="font-medium">{names.get(item.personId)} · {item.email}</p><p className="text-xs text-muted-foreground">{item.revokedAt ? "Revoked" : item.acceptedAt ? "Accepted" : `Expires ${dateLabel(item.expiresAt)}`}</p></div>
            {!item.revokedAt ? <Button variant="outline" size="sm" disabled={disabled} onClick={() => workflow.submit("revokeInvitation", { invitationId: item.id })}>Revoke</Button> : null}
          </li>)}</ul> : <Empty>No invitations created.</Empty>}</WorkflowCard>
          <WorkflowCard title="Verified account links">{data.identityLinks?.length ? <ul className="space-y-2 text-sm">{data.identityLinks.map((item) => <li key={item.id}>{names.get(item.personId)} · {item.kind} · <span className="break-all font-mono text-xs">{item.principalId}</span></li>)}</ul> : <Empty>No accounts linked.</Empty>}</WorkflowCard>
        </> : null}
        {tab === "Resources" ? <>
          <ActionForm workflow={workflow} formKey="resource" action="saveResource" rows={resources} title="Rooms and equipment" description="Availability is optional; enter both endpoints when restricting a resource."
            fields={[{ key: "name", label: "Name" }, { key: "kind", label: "Kind", options: choices(["room", "equipment"]), default: "room" }, { key: "capacity", label: "Capacity", type: "number", min: 1, default: 1 }, { key: "location", label: "Location", optional: true }, optionalDate("availableFrom", "Available from"), optionalDate("availableUntil", "Available until")]} />
          <WorkflowCard title="Resource inventory">{resources.length ? <ul className="divide-y divide-border text-sm">{resources.map((item) => <li key={item.id} className="py-3"><p className="font-medium">{item.name} · {item.kind} · capacity {item.capacity}</p><p className="text-muted-foreground">{item.location || "No location"}{item.availableFrom ? ` · ${dateLabel(item.availableFrom)} – ${dateLabel(item.availableUntil)}` : ""}</p></li>)}</ul> : <Empty>No resources configured.</Empty>}</WorkflowCard>
        </> : null}
        {tab === "Activities" ? <ActionForm workflow={workflow} formKey="activity" action="saveActivity" rows={activities} rowLabel="title" title="Activities" description="Leave both times blank for an unscheduled activity. Times are entered in UTC and displayed in the activity’s IANA timezone."
          fields={[{ key: "title", label: "Title" }, { key: "kind", label: "Type", default: "session", placeholder: "Session, workshop, round…" }, { key: "resourceId", label: "Room or equipment", options: optionsFor(resources), optional: true, nullable: true }, { key: "parentId", label: "Parent activity", options: optionsFor(activities, "title"), optional: true, nullable: true }, optionalDate("startsAt", "Starts at"), optionalDate("endsAt", "Ends at"), { key: "timezone", label: "Display timezone", default: "UTC", placeholder: "Asia/Kolkata", help: "IANA timezone, for example Asia/Kolkata or Europe/London." }, { key: "capacity", label: "Capacity", type: "number", min: 1, optional: true, nullable: true }]} /> : null}
        {tab === "Schedule" ? <WorkflowCard title="Working schedule" description="Edit an activity to reschedule. Room and person conflicts are checked whenever allocation changes.">
          <Schedule activities={activities} resources={resources} assignments={assignments} names={names} />
          <Button variant="outline" onClick={() => setTab("Activities")}>Edit an activity</Button>
        </WorkflowCard> : null}
        {tab === "Assignments" ? <>
          <ActionForm workflow={workflow} formKey="assignment" action="saveAssignment" rows={assignments.map((item) => ({ ...item, name: `${names.get(item.personId) || "Person"} · ${titles.get(item.activityId) || "Activity"} · ${item.role}` }))} title="Responsibilities" description="Evaluation assignments need a draft or open cycle. Revoke an assignment to remove access immediately."
            fields={[activityField, personField, { key: "role", label: "Role", options: roleOptions }, { key: "cycleId", label: "Evaluation cycle", options: optionsFor(cycles, "title"), optional: true, nullable: true }, optionalDate("dueAt", "Due at"), { key: "status", label: "Status", options: choices(["active", "revoked"]), default: "active" }]} />
          <WorkflowCard title="Current assignments">{assignments.length ? <ul className="divide-y divide-border text-sm">{assignments.map((item) => <li className="py-3" key={item.id}><p className="font-medium">{names.get(item.personId)} · {item.role} · {item.status}</p><p className="text-muted-foreground">{titles.get(item.activityId)}{item.dueAt ? ` · due ${dateLabel(item.dueAt)}` : ""}</p></li>)}</ul> : <Empty>No responsibilities assigned.</Empty>}</WorkflowCard>
        </> : null}
        {tab === "Programme" ? <>
          <WorkflowCard title="Publish programme" description="A release freezes the current scheduled placements and assignments. It queues placement notices and supersedes older pending notices.">
            <Button disabled={disabled || !safeProgramme} onClick={() => workflow.submit("publishProgramme", {})}>Publish new release</Button>
          </WorkflowCard>
          <WorkflowCard title="Released programmes">{data.releases?.length ? <div className="space-y-5">{data.releases.map((release) => <div key={release.id} className="rounded-lg border border-border p-3">
            <p className="font-semibold">Version {release.version} · {dateLabel(release.createdAt)}</p>
            <ReleaseItems release={release} />
            <p className="mt-3 text-xs text-muted-foreground">{(data.acknowledgements || []).filter((item) => item.releaseId === release.id).length} placement acknowledgements</p>
            {(data.acknowledgements || []).filter((item) => item.releaseId === release.id).map((item) => <p key={item.id} className="mt-1 text-xs">{names.get(item.personId)} · {titles.get(item.activityId)} · acknowledged</p>)}
          </div>)}</div> : <Empty>No programme released.</Empty>}</WorkflowCard>
        </> : null}
        {tab === "Evaluations" ? <>
          <WorkflowCycles workflow={workflow} />
          <WorkflowEvaluations workflow={workflow} />
          <WorkflowCard title="Score aggregates" description="Scores are normalized from each rubric to 0–100, then averaged across submitted evaluations. No submissions is distinct from a zero score.">
            {data.results?.length ? <ul className="divide-y divide-border text-sm">{data.results.map((result) => <li key={`${result.cycleId}:${result.activityId}`} className="py-3"><p className="font-medium">{titles.get(result.activityId)} · {result.title}</p><p className="mt-1">{result.score == null ? "No submitted scores" : `${Number(result.score).toFixed(1)} / 100`} · {result.evaluatorCount} submitted evaluations</p></li>)}</ul> : <Empty>No scores available.</Empty>}
          </WorkflowCard>
          <WorkflowCard title="Release cycle results" description="Presenters receive released aggregates. Evaluator notes remain private.">
            <ActionForm workflow={workflow} formKey="release-results" action="releaseResults" title="Choose a cycle" fields={[{ key: "cycleId", label: "Cycle", options: optionsFor(cycles, "title") }]} submitLabel="Release results" />
          </WorkflowCard>
          <WorkflowFeedback workflow={workflow} />
          <ActionForm workflow={workflow} formKey="reopen-evaluation" action="reopenEvaluation" title="Reopen a submitted evaluation" description="Preserves submitted history and requires a reason."
            fields={[{ key: "evaluationId", label: "Submitted evaluation", options: (data.evaluations || []).filter((item) => item.status === "submitted").map((item) => ({ value: item.id, label: `${titles.get(item.activityId)} · ${names.get(item.personId)}` })) }, { key: "reason", label: "Reason", type: "textarea" }]} submitLabel="Reopen evaluation" />
          <WorkflowHistory key={`${eventId}:evaluations`} workflow={workflow} eventId={eventId} kind="evaluations" />
        </> : null}
        {tab === "Attendance" ? <><AttendancePanel workflow={workflow} people={people} activities={activities} /><WorkflowHistory key={`${eventId}:attendance`} workflow={workflow} eventId={eventId} kind="attendance" /></> : null}
        {tab === "Tasks" ? <>
          <ActionForm workflow={workflow} formKey="task" action="saveTask" title="Follow-up tasks" rows={data.tasks || []} rowLabel="title" fields={[{ key: "title", label: "Title" }, { ...personField, optional: true, nullable: true }, { ...activityField, optional: true, nullable: true }, optionalDate("dueAt", "Due at"), { key: "status", label: "Status", options: choices(["open", "complete"]), default: "open" }]} />
          <TaskList workflow={workflow} names={names} titles={titles} />
        </> : null}
        {tab === "Notices" ? <WorkflowNotices workflow={workflow} names={names} /> : null}
        {tab === "Import & export" ? <>
          <WorkflowAcceptedImport key={eventId} workflow={workflow} eventId={eventId} />
          <WorkflowImport workflow={workflow} />
          <WorkflowCard title="Export reports" description="Download authorized CSV reports. Staff permissions are checked for each report.">
            <div className="flex flex-wrap gap-3">{["programme", "attendance", "evaluations", "people"].map((kind) => safeProgramme ? <a key={kind} className="rounded-md border border-border px-4 py-2 text-sm capitalize hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={`${basePath}/api/events/${encodeURIComponent(eventId)}/operations/export?kind=${kind}`}>{kind} CSV</a> : <span key={kind} className="text-sm text-muted-foreground">{kind}: incomplete snapshot</span>)}</div>
          </WorkflowCard>
        </> : null}
      </div>
    </>}
  </div>;
}

function InvitationResult({ workflow, eventId }) {
  const token = workflow.outcome?.action === "invite" ? workflow.outcome.result?.token : null;
  if (workflow.outcome?.action === "invite" && !token) return <WorkflowCard title="Invitation created" description="This command was already saved. Its secret cannot be retrieved again. If the original link was lost, revoke this invitation and create a new one." />;
  if (!token) return null;
  const relative = `${basePath}/operations/${encodeURIComponent(eventId)}?invite=${encodeURIComponent(token)}`;
  return <WorkflowCard title="Copy this invitation now" description="This token is shown once. Share this link with the invited person.">
    <input className="w-full rounded-md border border-border bg-background p-3 text-sm" aria-label="Invitation URL" readOnly value={typeof window === "undefined" ? relative : `${window.location.origin}${relative}`} onFocus={(event) => event.target.select()} />
  </WorkflowCard>;
}

export function Schedule({ activities, resources = [], assignments = [], names = new Map() }) {
  const rooms = new Map(resources.map((item) => [item.id, item.name]));
  const scheduled = [...activities].sort((a, b) => (a.startsAt || "9999").localeCompare(b.startsAt || "9999"));
  return scheduled.length ? <ol className="divide-y divide-border">{scheduled.map((activity) => <li key={activity.id} className="grid gap-2 py-4 sm:grid-cols-[13rem_minmax(0,1fr)]">
    <div className="text-sm"><p className="font-medium">{dateLabel(activity.startsAt, activity.timezone)}</p>{activity.endsAt ? <p className="text-xs text-muted-foreground">until {dateLabel(activity.endsAt, activity.timezone)} · {activity.timezone}</p> : null}</div>
    <div><p className="font-semibold">{activity.title}</p><p className="text-sm text-muted-foreground">{rooms.get(effectiveResourceId(activity, activities)) || "No resource"}{activity.capacity ? ` · capacity ${activity.capacity}` : ""}</p>
      <p className="mt-1 text-xs text-muted-foreground">{assignments.filter((item) => item.activityId === activity.id && item.status === "active").map((item) => `${names.get(item.personId) || "Assigned person"} (${item.role})`).join(" · ")}</p></div>
  </li>)}</ol> : <Empty>No activities yet.</Empty>;
}

export function ReleaseItems({ release }) {
  return release.items?.length ? <ul className="mt-3 space-y-2 text-sm">{release.items.map((item, index) => <li key={item.activityId || item.id || index}>
    <span className="font-medium">{item.title || item.activity?.title || "Placement"}</span> · {dateLabel(item.startsAt || item.activity?.startsAt, item.timezone || item.activity?.timezone)}{item.resourceName ? ` · ${item.resourceName}` : ""}
  </li>)}</ul> : <Empty>No placements in this release.</Empty>;
}

export function AttendancePanel({ workflow, people, activities }) {
  const names = new Map(people.map((item) => [item.id, item.name]));
  const titles = new Map(activities.map((item) => [item.id, item.title]));
  return <>
    <ActionForm workflow={workflow} formKey="attendance" action="markAttendance" title="Record attendance" description="Delivery records presenter attendance; participation records attendee presence. Corrections preserve previous entries."
      fields={[{ key: "activityId", label: "Activity", options: optionsFor(activities, "title") }, { key: "personId", label: "Person", options: optionsFor(people) }, { key: "purpose", label: "Purpose", options: choices(["delivery", "participation"]), default: "participation" }, { key: "status", label: "Attendance", options: choices(["present", "absent", "excused"]), default: "present" }, { key: "notes", label: "Notes", type: "textarea", optional: true }]} />
    <WorkflowCard title="Current attendance">{workflow.data.attendance?.length ? <ul className="divide-y divide-border text-sm">{workflow.data.attendance.map((item) => <li key={item.id} className="py-3"><p className="font-medium">{names.get(item.personId)} · {item.status} · {item.purpose}</p><p className="text-muted-foreground">{titles.get(item.activityId)} · {dateLabel(item.recordedAt)}</p>{item.notes ? <p className="mt-1">{item.notes}</p> : null}</li>)}</ul> : <Empty>No attendance recorded.</Empty>}</WorkflowCard>
  </>;
}

export function TaskList({ workflow, names = new Map(), titles = new Map(), portal = false }) {
  const tasks = workflow.data.tasks || [];
  return <WorkflowCard title="Tasks">{tasks.length ? <ul className="divide-y divide-border">{tasks.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div>
    <p className="font-medium">{item.title} · {item.status}</p><p className="text-muted-foreground">{names.get(item.personId)}{titles.get(item.activityId) ? ` · ${titles.get(item.activityId)}` : ""}{item.dueAt ? ` · due ${dateLabel(item.dueAt)}` : ""}</p></div>
    {portal && item.status === "open" ? <Button variant="outline" size="sm" disabled={workflow.busy || workflow.uncertain} onClick={() => workflow.submit("completeTask", { taskId: item.id })}><CheckCircle2 className="mr-2 size-4" />Mark complete</Button> : null}
  </li>)}</ul> : <Empty>No follow-up tasks.</Empty>}</WorkflowCard>;
}

function WorkflowNotices({ workflow, names }) {
  return <WorkflowCard title="Notification queue" description="Accepted means the email provider accepted the request. Failed or uncertain notices can be retried; provider delivery is reported separately.">
    <Button variant="outline" disabled={workflow.busy || workflow.uncertain} onClick={() => workflow.submit("queueReminders", {})}><Users className="mr-2 size-4" />Queue overdue evaluation reminders</Button>
    {workflow.data.outbox?.length ? <ul className="divide-y divide-border">{workflow.data.outbox.map((item) => <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm"><div className="min-w-0"><p className="font-medium">{item.kind} · {names.get(item.personId)} · {item.status}</p>
      <p className="text-xs text-muted-foreground">{item.attempts || 0} attempts{item.nextAttemptAt ? ` · next attempt ${dateLabel(item.nextAttemptAt)}` : ""}</p>{item.lastError ? <p className="mt-1 break-words text-destructive">{item.lastError}</p> : null}
      {item.providerId ? <p className="mt-1 break-all text-xs text-muted-foreground">Provider receipt: {item.providerId}</p> : null}</div>
      {["failed", "uncertain"].includes(item.status) ? <Button variant="outline" size="sm" disabled={workflow.busy || workflow.uncertain} onClick={() => workflow.submit("retryNotice", { noticeId: item.id })}>Retry notice</Button> : null}
    </li>)}</ul> : <Empty>No queued notices.</Empty>}
  </WorkflowCard>;
}
