"use client";

import { Button } from "@geiger/ui";
import { Empty, Field, WorkflowCard, choices, fieldClass } from "./workflow_forms";
import { dateLabel, formPayload, formValue } from "./workflow_client";

const defaultRubric = [{ id: "criterion-1", label: "Overall quality", min: 0, max: 10, weight: 1 }];

export function WorkflowCycles({ workflow }) {
  const cycles = workflow.data.cycles || [];
  const draft = workflow.drafts.cycle || {};
  const rubric = draft.rubric || defaultRubric;
  const locked = draft.id && (workflow.data.evaluations || []).some((item) => item.cycleId === draft.id && item.status === "submitted");
  const disabled = workflow.busy || workflow.uncertain;
  const update = (key, value) => workflow.setDraft("cycle", { ...draft, [key]: value });
  const criterion = (index, key, value) => update("rubric", rubric.map((item, position) => position === index ? { ...item, [key]: value } : item));
  const submit = async (event) => {
    event.preventDefault();
    const controls = new FormData(event.currentTarget);
    const dueAt = formPayload([{ key: "cycleDue", type: "date", optional: true, nullable: true }], { cycleDue: draft.dueAt }, controls).cycleDue;
    workflow.setDraft("cycle", { ...draft, dueAt: controls.get("cycleDue") || "" });
    const response = await workflow.submit("saveCycle", { ...(draft.id ? { id: draft.id } : {}), title: draft.title || "",
      state: draft.state || "draft", dueAt,
      rubric: rubric.map((item) => ({ ...item, min: Number(item.min), max: Number(item.max), weight: Number(item.weight) })) }, "cycle");
    if (!response.error) workflow.setDraft("cycle", {});
  };
  return <WorkflowCard title="Evaluation cycles and rubrics" description="Create a separate cycle for each round. Rubric IDs remain stable; after the first submission, create a new cycle to change scoring criteria.">
    <label className="block space-y-1.5 text-sm"><span className="font-medium">Create or edit cycle</span><select className={fieldClass} disabled={disabled} value={draft.id || ""} onChange={(event) => {
      const cycle = cycles.find((item) => item.id === event.target.value);
      workflow.setDraft("cycle", cycle ? { id: cycle.id, title: cycle.title, state: cycle.state, rubric: cycle.rubric, dueAt: formValue(cycle.dueAt, "date") } : {});
    }}><option value="">Create new</option>{cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.title} · {cycle.state}</option>)}</select></label>
    <form onSubmit={submit} className="space-y-4"><fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-2">
      <Field field={{ key: "cycleTitle", label: "Cycle title" }} value={draft.title || ""} onChange={(value) => update("title", value)} />
      <Field field={{ key: "cycleState", label: "State", options: choices(draft.state === "released" ? ["released"] : ["draft", "open", "closed"]) }} value={draft.state || "draft"} onChange={(value) => update("state", value)} />
      <Field field={{ key: "cycleDue", label: "Due at (UTC)", type: "date", optional: true }} value={draft.dueAt || ""} onChange={(value) => update("dueAt", value)} />
    </fieldset>
      {locked ? <p className="text-sm text-muted-foreground">This rubric is locked because evaluations have been submitted.</p> : null}
      <fieldset disabled={disabled || locked} className="space-y-3"><legend className="mb-2 text-sm font-semibold">Scoring criteria</legend>
        {rubric.map((item, index) => <div key={item.id} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-4">
          <Field field={{ key: `criterion-label-${item.id}`, label: "Criterion" }} value={item.label} onChange={(value) => criterion(index, "label", value)} />
          <Field field={{ key: `criterion-min-${item.id}`, label: "Minimum", type: "number", step: "any" }} value={item.min} onChange={(value) => criterion(index, "min", value)} />
          <Field field={{ key: `criterion-max-${item.id}`, label: "Maximum", type: "number", step: "any" }} value={item.max} onChange={(value) => criterion(index, "max", value)} />
          <Field field={{ key: `criterion-weight-${item.id}`, label: "Weight", type: "number", min: "0.000001", step: "any" }} value={item.weight} onChange={(value) => criterion(index, "weight", value)} />
          {rubric.length > 1 ? <Button type="button" size="sm" variant="ghost" onClick={() => update("rubric", rubric.filter((_, position) => position !== index))}>Remove criterion</Button> : null}
        </div>)}
        <Button type="button" variant="outline" disabled={disabled || locked || rubric.length >= 20} onClick={() => update("rubric", [...rubric, { id: `criterion-${crypto.randomUUID()}`, label: "", min: 0, max: 10, weight: 1 }])}>Add criterion</Button>
      </fieldset>
      <Button type="submit" disabled={disabled || draft.state === "released"}>Save cycle</Button>
    </form>
    {cycles.length ? <ul className="divide-y divide-border text-sm">{cycles.map((cycle) => <li key={cycle.id} className="py-3"><p className="font-medium">{cycle.title} · {cycle.state}</p><p className="text-muted-foreground">{cycle.rubric?.length || 0} criteria{cycle.dueAt ? ` · due ${dateLabel(cycle.dueAt)}` : ""}</p></li>)}</ul> : <Empty>No evaluation cycles yet.</Empty>}
  </WorkflowCard>;
}

export function WorkflowEvaluations({ workflow, portal = false }) {
  const data = workflow.data;
  const assignments = (data.assignments || []).filter((item) => item.role === "evaluator" && item.status === "active" && (!portal || item.personId === data.personId || item.personId === data.person?.id));
  const people = new Map((data.people || []).map((item) => [item.id, item.name]));
  const activities = new Map((data.activities || []).map((item) => [item.id, item.title]));
  const cycles = new Map((data.cycles || []).map((item) => [item.id, item]));
  return <WorkflowCard title={portal ? "Your evaluations" : "Assigned evaluations"} description="Save a partial draft, then submit when every criterion is complete. Submitted scores remain locked until a manager reopens them.">
    {assignments.length ? assignments.map((assignment) => <EvaluationForm key={assignment.id} workflow={workflow} assignment={assignment}
      evaluation={(data.evaluations || []).find((item) => item.assignmentId === assignment.id)} cycle={cycles.get(assignment.cycleId)}
      title={`${activities.get(assignment.activityId) || "Activity"}${portal ? "" : ` · ${people.get(assignment.personId) || "Evaluator"}`}`} />) : <Empty>No evaluator assignments.</Empty>}
  </WorkflowCard>;
}

export function WorkflowFeedback({ workflow }) {
  const formKey = "approve-feedback";
  const draft = workflow.drafts[formKey] || {};
  const disabled = workflow.busy || workflow.uncertain;
  const evaluations = (workflow.data.evaluations || []).filter((item) => item.status === "submitted");
  const people = new Map((workflow.data.people || []).map((item) => [item.id, item.name]));
  const activities = new Map((workflow.data.activities || []).map((item) => [item.id, item.title]));
  const selected = evaluations.find((item) => item.id === draft.evaluationId);
  const fields = [{ key: "evaluationId", label: "Submitted evaluation", options: evaluations.map((item) => ({ value: item.id, label: `${activities.get(item.activityId) || "Activity"} · ${people.get(item.personId) || "Evaluator"}` })) },
    { key: "feedback", label: "Shared feedback", type: "textarea", maxLength: 10000, optional: true }];
  const submit = async (event) => {
    event.preventDefault();
    const payload = formPayload(fields, draft, new FormData(event.currentTarget));
    workflow.setDraft(formKey, { ...draft, feedback: payload.feedback || "" });
    const response = await workflow.submit("approveFeedback", { ...payload, feedback: payload.feedback || "" }, formKey);
    if (!response.error) workflow.setDraft(formKey, {});
  };
  return <WorkflowCard title="Approve feedback for presenters" description="Write the feedback you want presenters to see. Private evaluator notes are never copied automatically. Approved feedback appears only after this cycle’s results are released; save an empty message to clear approval.">
    <form onSubmit={submit} className="space-y-4">
      <fieldset disabled={disabled} className="space-y-4">
        <Field field={fields[0]} value={draft.evaluationId || ""} onChange={(evaluationId) => {
          const evaluation = evaluations.find((item) => item.id === evaluationId);
          workflow.setDraft(formKey, { evaluationId, feedback: evaluation?.approvedFeedback || "" });
        }} />
        {selected?.feedbackApprovedAt ? <p className="text-sm text-muted-foreground">Approved {dateLabel(selected.feedbackApprovedAt)}. Review the current shared text below before saving a change.</p> : null}
        <Field field={fields[1]} value={draft.feedback || ""} onChange={(feedback) => workflow.setDraft(formKey, { ...draft, feedback })} />
      </fieldset>
      <Button type="submit" disabled={disabled}>Approve shared feedback</Button>
    </form>
  </WorkflowCard>;
}

function EvaluationForm({ workflow, assignment, evaluation, cycle, title }) {
  const formKey = `evaluation:${assignment.id}`;
  const draft = workflow.drafts[formKey] || { scores: evaluation?.scores || {}, notes: evaluation?.notes || "" };
  const disabled = workflow.busy || workflow.uncertain || evaluation?.status === "submitted" || cycle?.state !== "open";
  const update = (key, value) => workflow.setDraft(formKey, { ...draft, [key]: value });
  const save = async (submit) => {
    const scores = Object.fromEntries(Object.entries(draft.scores || {}).filter(([, value]) => value !== "" && value != null).map(([key, value]) => [key, Number(value)]));
    const response = await workflow.submit("saveEvaluation", { assignmentId: assignment.id, scores, notes: draft.notes || "", submit }, formKey);
    if (!response.error) workflow.setDraft(formKey, null);
  };
  if (!cycle) return <p className="text-sm text-destructive">{title}: assigned cycle is unavailable.</p>;
  return <div className="space-y-4 rounded-lg border border-border p-4">
    <div><h4 className="font-semibold">{title}</h4><p className="text-sm text-muted-foreground">{cycle.title} · {evaluation?.status || "Not started"} · cycle {cycle.state}{assignment.dueAt ? ` · due ${dateLabel(assignment.dueAt)}` : ""}</p></div>
    <form onSubmit={(event) => { event.preventDefault(); save(true); }} className="space-y-4">
      <fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-2">{(cycle.rubric || []).map((criterion) => <Field key={criterion.id}
        field={{ key: `${assignment.id}-${criterion.id}`, label: `${criterion.label} (${criterion.min}–${criterion.max})`, type: "number", min: criterion.min, max: criterion.max, step: "any", help: `Weight ${criterion.weight}` }}
        value={draft.scores?.[criterion.id] ?? ""} onChange={(value) => update("scores", { ...draft.scores, [criterion.id]: value })} />)}
        <div className="sm:col-span-2"><Field field={{ key: `notes-${assignment.id}`, label: "Private evaluator notes", type: "textarea", optional: true }} value={draft.notes || ""} onChange={(value) => update("notes", value)} /></div>
      </fieldset>
      <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={disabled} onClick={() => save(false)}>Save draft</Button><Button type="submit" disabled={disabled}>Submit evaluation</Button></div>
    </form>
  </div>;
}
