"use client";

import { useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import {
  Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle,
} from "@geiger/ui";
import { cn } from "@/lib/utils";
import { FilterButton, toApiFilter } from "../object/filter_builder";
import { liveFieldsOf } from "../state/use_workspace";
import { OptionChip } from "../ws_ui";

const NONE = "__none__";
const MATCHABLE = new Set(["single_select", "multi_select", "link_record", "short_text", "lookup", "email", "url"]);
const NUMERIC = (field) => ["number", "rating", "percent", "currency"].includes(field.type) || (field.type === "formula" && field.config.result === "number");

function Group({ title, hint, children }) {
  return (
    <section className="space-y-3 rounded-xl border border-border bg-surface-subtle p-4">
      <div className="grid gap-0.5">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {hint ? <p className="text-xs text-text-secondary">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Pick({ label, value, options, onChange, placeholder = "Choose", optional = false }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs font-medium text-text-secondary">{label}</Label>
      <Select value={value ?? (optional ? NONE : "")} onValueChange={(next) => onChange(next === NONE ? null : next)}>
        <SelectTrigger className="h-9"><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>
          {optional ? <SelectItem value={NONE}>None</SelectItem> : null}
          {options.map((option) => <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function StatusChips({ object, value, onChange }) {
  const chosen = new Set(value ?? []);
  return (
    <div className="flex flex-wrap gap-1.5">
      {(object?.statuses ?? []).map((status) => (
        <button key={status.key} type="button" aria-pressed={chosen.has(status.key)}
          onClick={() => { const next = new Set(chosen); if (next.has(status.key)) next.delete(status.key); else next.add(status.key); onChange([...next]); }}
          className={cn("rounded-full border p-0.5", chosen.has(status.key) ? "border-foreground" : "border-transparent opacity-60 hover:opacity-100")}>
          <OptionChip option={status} />
        </button>
      ))}
    </div>
  );
}

// A review setup: submissions, reviews, the reviewer pool, how many reviewers, matching, conflicts and the scoring rubric.
export function ReviewSetupSheet({ open, onOpenChange, ...props }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl">
        {open ? <SetupBody key={props.setup?.id ?? "new"} onOpenChange={onOpenChange} {...props} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function SetupBody({ eventId, ws, process, setup, onOpenChange, onSaved }) {
  const data = ws.data;
  const objects = ws.objects;
  const [name, setName] = useState(setup?.name ?? "Peer review");
  const [config, setConfig] = useState(() => setup?.config ?? { perSubmission: 3, maxPerReviewer: 8, topics: {}, conflicts: { sameValue: [] }, rubric: [], doneStatuses: [], decisions: [] });
  const [busy, setBusy] = useState(false);
  const set = (patch) => setConfig((current) => ({ ...current, ...patch }));
  const submissions = objects.find((object) => object.id === config.submissionsObjectId);
  const reviews = objects.find((object) => object.id === config.reviewsObjectId);
  const reviewFields = reviews ? liveFieldsOf(data, reviews.id) : [];
  const reviewerLink = reviewFields.find((field) => field.id === config.reviewerFieldId);
  const reviewersId = reviewerLink?.config.targetObjectId ?? null;
  const reviewers = objects.find((object) => object.id === reviewersId);
  const submissionFields = submissions ? liveFieldsOf(data, submissions.id) : [];
  const reviewerFields = reviewersId ? liveFieldsOf(data, reviewersId) : [];
  const sameValue = config.conflicts?.sameValue ?? [];

  const save = async () => {
    setBusy(true);
    const result = await process.run("review.save", {
      ...(setup ? { id: setup.id } : {}),
      setup: { name, config: { ...config, submissionFilter: toApiFilter(config.submissionFilter) ?? null, reviewerFilter: toApiFilter(config.reviewerFilter) ?? null } },
    }, { success: "Review setup saved" });
    setBusy(false);
    if (!result.error) { onSaved?.(result.data.setup); onOpenChange(false); }
  };

  return (
    <>
      <SheetHeader className="border-b border-border px-5 py-4">
        <SheetTitle className="text-base">{setup ? setup.name : "New review setup"}</SheetTitle>
        <SheetDescription>Reviews are records in their own list, linked to a submission and a reviewer. Blind review is set on the portal role (hide the authors field from reviewers).</SheetDescription>
      </SheetHeader>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
        <div className="grid gap-1.5">
          <Label htmlFor="ws-review-name">Name</Label>
          <Input id="ws-review-name" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
        </div>
        <Group title="Lists">
          <div className="grid gap-3 sm:grid-cols-2">
            <Pick label="Submissions" value={config.submissionsObjectId} options={objects.map((object) => ({ id: object.id, name: object.plural }))}
              onChange={(id) => setConfig({ ...config, submissionsObjectId: id, submissionFieldId: null, decisions: [], submissionFilter: null, topics: {}, conflicts: { sameValue: [] } })} />
            <Pick label="Reviews are kept in" value={config.reviewsObjectId} options={objects.filter((object) => object.id !== config.submissionsObjectId).map((object) => ({ id: object.id, name: object.plural }))}
              onChange={(id) => setConfig({ ...config, reviewsObjectId: id, submissionFieldId: null, reviewerFieldId: null, rubric: [], doneStatuses: [], newStatus: null })} />
            {reviews && submissions ? (
              <>
                <Pick label={`${reviews.name} → ${submissions.name.toLowerCase()}`} value={config.submissionFieldId}
                  options={reviewFields.filter((field) => field.type === "link_record" && field.config.targetObjectId === submissions.id)} onChange={(id) => set({ submissionFieldId: id })} />
                <Pick label={`${reviews.name} → reviewer`} value={config.reviewerFieldId}
                  options={reviewFields.filter((field) => field.type === "link_record" && field.id !== config.submissionFieldId)}
                  onChange={(id) => set({ reviewerFieldId: id, reviewerFilter: null, topics: { ...config.topics, reviewerFieldId: null }, conflicts: { ...config.conflicts, reviewerConflictsFieldId: null, authorsFieldId: null, sameValue: [] } })} />
              </>
            ) : null}
          </div>
        </Group>

        {submissions && reviewers ? (
          <>
            <Group title="Who reviews what" hint="Each submission gets this many reviewers, picked from the pool with matching topics first and the lightest load.">
              <div className="flex flex-wrap items-center gap-3">
                <FilterButton filter={config.submissionFilter} onChange={(submissionFilter) => set({ submissionFilter })} fields={submissionFields} statuses={submissions.statuses ?? []} eventId={eventId}
                  label="Which submissions" intro="Assign to submissions that match" emptyText="Every submission gets reviewers." align="start" />
                <FilterButton filter={config.reviewerFilter} onChange={(reviewerFilter) => set({ reviewerFilter })} fields={reviewerFields} statuses={reviewers.statuses ?? []} eventId={eventId}
                  label="Reviewer pool" intro={`Pick from ${reviewers.plural.toLowerCase()} that match`} emptyText={`Anyone in ${reviewers.plural}.`} align="start" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium text-text-secondary">Reviewers per submission</Label>
                  <Input type="number" min={1} max={10} value={config.perSubmission ?? 3} onChange={(e) => set({ perSubmission: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })} />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium text-text-secondary">Most reviews per reviewer</Label>
                  <Input type="number" min={1} max={500} value={config.maxPerReviewer ?? ""} placeholder="No limit"
                    onChange={(e) => set({ maxPerReviewer: e.target.value === "" ? null : Math.max(1, Number(e.target.value) || 1) })} />
                </div>
                <Pick label="Submission topics" optional value={config.topics?.submissionFieldId} options={submissionFields.filter((field) => MATCHABLE.has(field.type))}
                  onChange={(id) => set({ topics: { ...config.topics, submissionFieldId: id } })} />
                <Pick label="Reviewer topics" optional value={config.topics?.reviewerFieldId} options={reviewerFields.filter((field) => MATCHABLE.has(field.type))}
                  onChange={(id) => set({ topics: { ...config.topics, reviewerFieldId: id } })} />
              </div>
            </Group>

            <Group title="Conflicts of interest" hint="A reviewer is never assigned a submission they conflict with.">
              <div className="grid gap-3 sm:grid-cols-2">
                <Pick label={`Authors (on ${submissions.plural.toLowerCase()})`} optional value={config.conflicts?.authorsFieldId}
                  options={submissionFields.filter((field) => field.type === "link_record" && field.config.targetObjectId === reviewersId)}
                  onChange={(id) => set({ conflicts: { ...config.conflicts, authorsFieldId: id } })} />
                <Pick label={`Declared conflicts (on ${reviewers.plural.toLowerCase()})`} optional value={config.conflicts?.reviewerConflictsFieldId}
                  options={reviewerFields.filter((field) => field.type === "link_record" && field.config.targetObjectId === submissions.id)}
                  onChange={(id) => set({ conflicts: { ...config.conflicts, reviewerConflictsFieldId: id } })} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-text-secondary">Same value means a conflict (for example the same affiliation)</Label>
                {sameValue.map((pair, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Select value={pair.submissionFieldId} onValueChange={(id) => set({ conflicts: { ...config.conflicts, sameValue: sameValue.map((item, i) => (i === index ? { ...item, submissionFieldId: id } : item)) } })}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>{submissionFields.filter((field) => MATCHABLE.has(field.type)).map((field) => <SelectItem key={field.id} value={field.id}>{field.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <span className="text-xs text-text-secondary">=</span>
                    <Select value={pair.reviewerFieldId} onValueChange={(id) => set({ conflicts: { ...config.conflicts, sameValue: sameValue.map((item, i) => (i === index ? { ...item, reviewerFieldId: id } : item)) } })}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>{reviewerFields.filter((field) => MATCHABLE.has(field.type)).map((field) => <SelectItem key={field.id} value={field.id}>{field.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button type="button" size="icon" variant="ghost" className="h-9 w-9 shrink-0" aria-label="Remove" onClick={() => set({ conflicts: { ...config.conflicts, sameValue: sameValue.filter((_, i) => i !== index) } })}><X className="h-4 w-4" /></Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" disabled={!submissionFields.some((field) => MATCHABLE.has(field.type)) || !reviewerFields.some((field) => MATCHABLE.has(field.type))}
                  onClick={() => set({ conflicts: { ...config.conflicts, sameValue: [...sameValue, { submissionFieldId: submissionFields.find((field) => MATCHABLE.has(field.type))?.id, reviewerFieldId: reviewerFields.find((field) => MATCHABLE.has(field.type))?.id }] } })}>
                  <Plus className="h-4 w-4" />Add a rule
                </Button>
              </div>
            </Group>

            <Group title="Scoring" hint="A review's score is the weighted average of these fields. Only finished reviews count.">
              <div className="space-y-2">
                {reviewFields.filter(NUMERIC).map((field) => {
                  const item = (config.rubric ?? []).find((entry) => entry.fieldId === field.id);
                  return (
                    <div key={field.id} className="flex items-center gap-3">
                      <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                        <input type="checkbox" className="h-4 w-4" checked={Boolean(item)}
                          onChange={(e) => set({ rubric: e.target.checked ? [...(config.rubric ?? []), { fieldId: field.id, weight: 1 }] : config.rubric.filter((entry) => entry.fieldId !== field.id) })} />
                        <span className="truncate">{field.name}</span>
                      </label>
                      {item ? (
                        <span className="flex items-center gap-1.5 text-xs text-text-secondary">weight
                          <Input type="number" min={0.1} step={0.5} className="h-8 w-20" value={item.weight}
                            onChange={(e) => set({ rubric: config.rubric.map((entry) => (entry.fieldId === field.id ? { ...entry, weight: Number(e.target.value) || 1 } : entry)) })} />
                        </span>
                      ) : null}
                    </div>
                  );
                })}
                {!reviewFields.some(NUMERIC) ? <p className="text-sm text-text-secondary">Add number or rating fields to {reviews.plural} to score them.</p> : null}
              </div>
              {reviews.statuses?.length ? (
                <div className="grid gap-3">
                  <div className="space-y-1.5"><Label className="text-xs font-medium text-text-secondary">A review is finished when its status is</Label><StatusChips object={reviews} value={config.doneStatuses} onChange={(doneStatuses) => set({ doneStatuses })} /></div>
                  <Pick label="New reviews start as" optional value={config.newStatus} options={reviews.statuses.map((status) => ({ id: status.key, name: status.label }))} onChange={(newStatus) => set({ newStatus })} />
                </div>
              ) : null}
              <div className="grid gap-1.5 sm:w-64">
                <Label className="text-xs font-medium text-text-secondary">Flag when scores differ by at least</Label>
                <Input type="number" min={0} step={0.5} value={config.disagreement ?? ""} placeholder="Don't flag" onChange={(e) => set({ disagreement: e.target.value === "" ? null : Number(e.target.value) })} />
              </div>
            </Group>

            {submissions.statuses?.length ? (
              <Group title="Decisions" hint="Buttons on the results table that move a submission to one of these statuses (stage rules apply).">
                <StatusChips object={submissions} value={config.decisions} onChange={(decisions) => set({ decisions })} />
              </Group>
            ) : null}
          </>
        ) : null}
      </div>
      <SheetFooter className="flex-row items-center justify-end gap-2 border-t border-border px-5 py-3">
        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button onClick={save} disabled={busy || !config.submissionFieldId || !config.reviewerFieldId}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Save setup</Button>
      </SheetFooter>
    </>
  );
}
