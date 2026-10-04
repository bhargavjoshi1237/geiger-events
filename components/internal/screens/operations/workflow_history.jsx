"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@geiger/ui";
import { Empty, WorkflowCard } from "./workflow_forms";
import { createWorkflowClient, dateLabel } from "./workflow_client";

const client = createWorkflowClient();

export function WorkflowHistory({ workflow, eventId, kind }) {
  const [history, setHistory] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const request = useRef(null);
  useEffect(() => () => request.current?.abort(), []);
  const attendance = kind === "attendance";
  const collection = attendance ? "attendanceRevisions" : "evaluationRevisions";
  const parentKey = attendance ? "attendanceId" : "evaluationId";
  const current = new Map((workflow.data[attendance ? "attendance" : "evaluations"] || []).map((item) => [item.id, item]));
  const people = new Map((workflow.data.people || []).map((item) => [item.id, item.name]));
  const activities = new Map((workflow.data.activities || []).map((item) => [item.id, item.title]));
  const cycles = new Map((workflow.data.cycles || []).map((item) => [item.id, item]));
  const load = async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true); setError(null);
    try {
      const response = await client.history(eventId, controller.signal);
      if (controller.signal.aborted) return;
      if (response.error) { setHistory(null); setError(response.error.message); }
      else if (!Array.isArray(response.data?.[collection])) { setHistory(null); setError("The history could not be read. Try loading again."); }
      else setHistory(response.data);
    } catch (failure) { if (failure.name !== "AbortError") { setHistory(null); setError("Could not load history. Try again."); } }
    finally { if (!controller.signal.aborted) setLoading(false); }
  };
  return <WorkflowCard title={attendance ? "Attendance correction history" : "Submitted evaluation history"} description={attendance ? "Read prior attendance revisions, including corrections and the account that recorded each revision. History access requires your archive permission." : "Read preserved submitted scores and private notes. Reopening an evaluation keeps these revisions; history access requires your archive permission."}>
    <Button type="button" variant="outline" disabled={loading || workflow.busy} onClick={load}>{loading ? "Loading history…" : "Load history"}</Button>
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    {history?.truncated ? <p role="alert" className="text-sm text-amber-700">History exceeds the 500-entry limit. This view is incomplete; request a complete report before relying on it.</p> : null}
    {history ? history[collection].length ? <ul className="divide-y divide-border text-sm">{history[collection].map((entry) => {
      const record = current.get(entry[parentKey]);
      const rubric = new Map((cycles.get(record?.cycleId)?.rubric || []).map((criterion) => [criterion.id, criterion.label]));
      return <li key={entry.id} className="space-y-2 py-4">
        <p className="font-medium">{people.get(record?.personId) || "Person outside current snapshot"} · {activities.get(record?.activityId) || "Activity outside current snapshot"}</p>
        <p className="text-xs text-muted-foreground">Revision {entry.revision} · {dateLabel(attendance ? entry.recordedAt : entry.submittedAt)}{attendance && record?.purpose ? ` · ${record.purpose}` : ""}</p>
        {attendance ? <><p>{entry.status}</p>{entry.actorId ? <p className="break-all text-xs text-muted-foreground">Recorded by {entry.actorId}</p> : null}</> : <ul className="space-y-1">{Object.entries(entry.scores || {}).map(([criterion, score]) => <li key={criterion}>{rubric.get(criterion) || criterion}: {score}</li>)}</ul>}
        {entry.notes ? <p className="whitespace-pre-wrap">{entry.notes}</p> : null}
        {!record ? <p className="break-all text-xs text-muted-foreground">Original record: {entry[parentKey]}</p> : null}
      </li>;
    })}</ul> : <Empty>{attendance ? "No preserved attendance revisions." : "No submitted evaluation revisions."}</Empty> : !error ? <p className="text-sm text-muted-foreground">Load history to inspect earlier revisions.</p> : null}
  </WorkflowCard>;
}
