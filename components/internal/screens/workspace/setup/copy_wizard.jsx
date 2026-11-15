"use client";

import { useEffect, useState } from "react";
import { Loader2, SlidersHorizontal } from "lucide-react";
import {
  Button, Checkbox, Label, LogoLoading, Popover, PopoverContent, PopoverTrigger, Progress, Select, SelectContent, SelectItem, SelectTrigger,
  SelectValue, Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, Switch,
} from "@geiger/ui";
import { toast } from "sonner";
import { SegmentedTabs } from "@/components/internal/shared/screen_kit";
import { cn } from "@/lib/utils";
import { workspaceApi } from "@/lib/workspace/client";
import { formatDate } from "../state/format";
import { ObjectIcon } from "../ws_ui";

const MODES = [{ label: "Skip", value: "skip" }, { label: "Structure", value: "structure" }, { label: "With records", value: "records" }];
const ALL = "__all__";

// Copy lists (and optionally records) from an earlier event or a saved template, with a plain-language review first.
export function CopyWizard({ open, onOpenChange, eventId, ws, startWith = "event" }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        {open ? <CopyWizardBody onOpenChange={onOpenChange} eventId={eventId} ws={ws} startWith={startWith} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function CopyWizardBody({ onOpenChange, eventId, ws, startWith }) {
  const [source, setSource] = useState(startWith);
  const [step, setStep] = useState("source");
  const [events, setEvents] = useState(null);
  const [templates, setTemplates] = useState(null);
  const [eventChoice, setEventChoice] = useState("");
  const [templateChoice, setTemplateChoice] = useState("");
  const [definition, setDefinition] = useState(null);
  const [choices, setChoices] = useState({});
  const [attachments, setAttachments] = useState(false);
  const [review, setReview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState(null);

  useEffect(() => {
    let alive = true;
    workspaceApi.copySources(eventId).then(({ data }) => { if (alive) setEvents(data?.events ?? []); });
    workspaceApi.templates(eventId).then(({ data }) => { if (alive) setTemplates(data?.templates ?? []); });
    return () => { alive = false; };
  }, [eventId]);

  // Poll the copy job; each poll also moves it forward.
  useEffect(() => {
    if (!job || job.status !== "running") return undefined;
    const timer = setTimeout(async () => {
      const { data, error } = await workspaceApi.copyJob(eventId, job.id);
      if (error) { toast.error(error.message); return; }
      setJob(data.job);
      if (data.job.status === "done") { await ws.reload(); toast.success(`Copied ${data.job.copied.toLocaleString()} records`); }
    }, 1500);
    return () => clearTimeout(timer);
  }, [job, eventId, ws]);

  const body = () => (source === "event"
    ? { sourceEventId: eventChoice, choices: { objects: choices, attachments } }
    : { templateId: templateChoice, choices: {} });

  const next = async () => {
    if (step === "source" && source === "event") {
      setBusy(true);
      const { data, error } = await workspaceApi.copySource(eventId, eventChoice);
      setBusy(false);
      if (error) { toast.error(error.message); return; }
      setDefinition(data);
      setChoices(Object.fromEntries(data.objects.map((object) => [object.id, { mode: "structure" }])));
      setStep("choose");
      return;
    }
    setBusy(true);
    const { data, error } = await workspaceApi.copy(eventId, { mode: "plan", ...body() });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setReview(data);
    setStep("review");
  };

  const start = async () => {
    setBusy(true);
    const { data, error } = await workspaceApi.copy(eventId, { mode: "start", ...body() });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    await ws.reload();
    if (data.job) { setJob(data.job); setStep("running"); }
    else { toast.success("Copied"); onOpenChange(false); }
  };

  const setChoice = (objectId, patch) => setChoices((current) => ({ ...current, [objectId]: { ...current[objectId], ...patch } }));
  const canNext = step === "source" ? (source === "event" ? Boolean(eventChoice) : Boolean(templateChoice))
    : step === "choose" ? Object.values(choices).some((choice) => choice.mode !== "skip") : false;

  return (
    <>
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle className="text-base">{ws.exists ? "Import from another event" : "Set up from another event"}</SheetTitle>
          <SheetDescription>
            {step === "source" ? "Choose where to copy from." : step === "choose" ? "Choose what to bring over for each list." : step === "review" ? "Check what will happen before anything is created." : "Copying…"}
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {step === "source" ? (
            <div className="space-y-4">
              <SegmentedTabs value={source} onChange={setSource} tabs={[{ label: "Another event", value: "event" }, { label: "A template", value: "template" }]} />
              {source === "event" ? (
                events === null ? <div className="flex justify-center py-10"><LogoLoading size={40} aria-label="Loading events" /></div>
                  : events.length ? (
                    <div className="space-y-1.5">
                      <Label>Event</Label>
                      <Select value={eventChoice} onValueChange={setEventChoice}>
                        <SelectTrigger className="w-full"><SelectValue placeholder="Choose an event" /></SelectTrigger>
                        <SelectContent>{events.map((event) => <SelectItem key={event.id} value={event.id}>{event.name}{event.date ? ` · ${formatDate(event.date)}` : ""}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  ) : <p className="text-sm text-text-secondary">No other event in this project has a workspace yet.</p>
              ) : templates === null ? <div className="flex justify-center py-10"><LogoLoading size={40} aria-label="Loading templates" /></div>
                : templates.length ? (
                  <div className="space-y-2">
                    {templates.map((template) => (
                      <button key={template.id} type="button" onClick={() => setTemplateChoice(template.id)}
                        className={cn("w-full rounded-lg border px-4 py-3 text-left", templateChoice === template.id ? "border-foreground/40 bg-surface-card" : "border-border hover:bg-surface-subtle")}>
                        <p className="text-sm font-medium text-foreground">{template.name}</p>
                        <p className="mt-0.5 text-xs text-text-secondary">{template.description || template.lists.join(", ")}</p>
                      </button>
                    ))}
                  </div>
                ) : <p className="text-sm text-text-secondary">No templates yet. Save one from any workspace&apos;s settings.</p>}
            </div>
          ) : null}

          {step === "choose" && definition ? (
            <div className="space-y-3">
              {definition.objects.map((object) => {
                const choice = choices[object.id] ?? { mode: "skip" };
                const fields = definition.fields.filter((field) => field.objectId === object.id);
                const excluded = new Set(choice.excludeFieldIds ?? []);
                const views = definition.views.filter((view) => view.objectId === object.id);
                return (
                  <div key={object.id} className="space-y-2 rounded-lg border border-border bg-surface-subtle px-3 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <ObjectIcon icon={object.icon} className="h-4 w-4 text-text-secondary" />
                      <span className="mr-auto text-sm font-medium text-foreground">{object.plural}</span>
                      <SegmentedTabs tabs={MODES} value={choice.mode} onChange={(mode) => setChoice(object.id, { mode })} />
                    </div>
                    {choice.mode !== "skip" ? (
                      <div className="flex flex-wrap items-center gap-2">
                        {choice.mode === "records" ? (
                          <Select value={choice.viewId ?? ALL} onValueChange={(viewId) => setChoice(object.id, { viewId: viewId === ALL ? undefined : viewId })}>
                            <SelectTrigger className="h-8 w-52"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value={ALL}>All records</SelectItem>
                              {views.map((view) => <SelectItem key={view.id} value={view.id}>Only “{view.name}”</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : null}
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button size="sm" variant="ghost"><SlidersHorizontal className="h-4 w-4" />{fields.length - excluded.size} of {fields.length} fields</Button>
                          </PopoverTrigger>
                          <PopoverContent align="start" className="max-h-72 w-64 overflow-y-auto p-1">
                            {fields.map((field) => (
                              <label key={field.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface-subtle">
                                <Checkbox checked={!excluded.has(field.id)} disabled={field.id === object.titleFieldId}
                                  onCheckedChange={() => setChoice(object.id, { excludeFieldIds: excluded.has(field.id) ? [...excluded].filter((id) => id !== field.id) : [...excluded, field.id] })} />
                                {field.name}
                              </label>
                            ))}
                          </PopoverContent>
                        </Popover>
                      </div>
                    ) : null}
                  </div>
                );
              })}
              {Object.values(choices).some((choice) => choice.mode === "records") ? (
                <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-3 text-sm">
                  <span><span className="font-medium text-foreground">Copy attached files</span><span className="block text-xs text-text-tertiary">Otherwise file fields start empty.</span></span>
                  <Switch checked={attachments} onCheckedChange={setAttachments} />
                </label>
              ) : null}
            </div>
          ) : null}

          {step === "review" && review ? (
            <div className="space-y-3">
              <p className="text-sm text-text-secondary">Lists: {review.lists.map((list) => list.name).join(", ")}</p>
              <ul className="space-y-2">
                {review.sentences.map((sentence) => (
                  <li key={sentence} className="rounded-lg border border-border bg-surface-subtle px-3 py-2 text-sm text-foreground">{sentence}</li>
                ))}
              </ul>
              {!review.sentences.length ? <p className="text-sm text-foreground">Everything will be copied as it is.</p> : null}
            </div>
          ) : null}

          {step === "running" && job ? (
            <div className="space-y-3 py-6">
              <p className="text-sm text-foreground">{job.status === "done" ? "Done." : job.status === "failed" ? "The copy stopped." : `${job.step}… ${job.copied.toLocaleString()} so far`}</p>
              <Progress value={job.status === "done" ? 100 : job.progress} />
              {job.error ? <p className="text-sm text-red-600 dark:text-red-400">{job.error}</p> : null}
              {job.status === "running" ? <p className="text-xs text-text-tertiary">You can close this; the copy keeps going and finishes in the background.</p> : null}
            </div>
          ) : null}
        </div>
        <SheetFooter className="flex-row justify-between gap-2 border-t border-border px-5 py-3">
          <div>
            {step === "choose" || (step === "review" && source === "event") ? (
              <Button variant="ghost" onClick={() => setStep(step === "review" ? "choose" : "source")}>Back</Button>
            ) : step === "review" ? <Button variant="ghost" onClick={() => setStep("source")}>Back</Button> : null}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>{step === "running" ? "Close" : "Cancel"}</Button>
            {step === "review" ? (
              <Button onClick={start} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Copy</Button>
            ) : step !== "running" ? (
              <Button onClick={next} disabled={busy || !canNext}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Next</Button>
            ) : null}
          </div>
        </SheetFooter>
    </>
  );
}
