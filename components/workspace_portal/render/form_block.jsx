"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarClock, Check, CheckCircle2, Loader2, Lock } from "lucide-react";
import { Button, Card, Label } from "@geiger/ui";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getType } from "@/lib/workspace/schema/types/index.js";
import { formatDateTime, timeAgo } from "@/components/internal/screens/workspace/state/format";
import { FieldInput } from "@/components/internal/screens/workspace/record/field_input";
import { BlockError, BlockFrame, BlockLoading, BlockMessage } from "./block_frame";
import { CodeSignIn } from "./code_sign_in";
import { usePortalView } from "./portal_context";
import { useBlockData } from "./use_block_data";
import { CellValue } from "./values";

const isEmpty = (value) => value === null || value === undefined || value === "" || (Array.isArray(value) && !value.length);
const WIDE = new Set(["long_text", "rich_text", "attachments", "multi_select", "link_record"]);

function FormField({ field, item, value, error, onChange, api, readOnly, record, list }) {
  const { eventId, timeZone } = usePortalView();
  const id = `wp-form-${field.id}`;
  return (
    <div className={cn("grid min-w-0 content-start gap-2", WIDE.has(field.type) && "@xl/block:col-span-2")}>
      <Label htmlFor={id} className="text-[13px] font-medium text-foreground">
        {field.name}{item.required ? <span className="ml-0.5 text-red-500" aria-hidden>*</span> : null}
      </Label>
      {item.help ? <p className="-mt-0.5 text-xs text-text-secondary">{item.help}</p> : null}
      {readOnly ? (
        <div className="flex min-h-6 text-sm text-foreground">{record ? <CellValue list={list} fieldId={field.id} record={record} compact={false} /> : null}</div>
      ) : (
        <FieldInput id={id} field={field} value={value} eventId={eventId} timeZone={timeZone} api={api} onChange={onChange} />
      )}
      {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}

function startValues(record, items, byId) {
  const values = {};
  for (const item of items) {
    const field = byId.get(item.fieldId);
    if (!field) continue;
    values[field.id] = getType(field.type).cast === "link" ? record?.links?.[field.id] ?? [] : record?.values?.[field.id] ?? null;
  }
  return values;
}

function FormBody({ block, data }) {
  const config = block.config;
  const { api, page, lists, record: pageRecord, refresh } = usePortalView();
  const list = lists[config.objectId];
  const personList = config.signup?.enabled ? lists[config.signup.objectId] : null;
  const byId = useMemo(() => new Map((list?.fields ?? []).map((field) => [field.id, field])), [list]);
  const personById = useMemo(() => new Map((personList?.fields ?? []).map((field) => [field.id, field])), [personList]);
  const isEdit = config.mode === "edit";
  const editRecord = isEdit ? data.record : null;
  const editable = new Set(isEdit ? data.editable ?? [] : []);
  const needsPerson = !isEdit && data.signup && !data.person;
  const personItems = needsPerson ? (config.signup.personFields ?? []).filter((item) => personById.has(item.fieldId)) : [];
  const sections = (config.sections ?? []).map((section) => ({ ...section, fields: section.fields.filter((item) => byId.has(item.fieldId)) }))
    .filter((section) => section.fields.length || section.description);
  // A stepped form gives "Your details" (sign-up) its own first step, then one step per section.
  const personStep = Boolean(personItems.length) && config.steps;
  const stepCount = sections.length + (personStep ? 1 : 0);
  const stepped = config.steps && stepCount > 1;
  const allItems = sections.flatMap((section) => section.fields);

  const [values, setValues] = useState(() => (isEdit ? startValues(editRecord, allItems, byId) : { ...(data.draft?.values ?? {}) }));
  const [person, setPerson] = useState(() => ({ ...(data.draft?.person ?? {}) }));
  const [step, setStep] = useState(() => Math.min(Math.max(0, data.draft?.step ?? 0), Math.max(0, stepCount - 1)));
  const sectionAt = (index) => (personStep ? (index === 0 ? null : sections[index - 1]) : sections[index]);
  const stepOf = (problems) => {
    if (personStep && Object.keys(problems).some((key) => key.startsWith("person:"))) return 0;
    return Math.max(0, sections.findIndex((section) => section.fields.some((item) => problems[item.fieldId]))) + (personStep ? 1 : 0);
  };
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [saved, setSaved] = useState(data.draftSavedAt ?? null);
  const [savingDraft, setSavingDraft] = useState(false);
  const touched = useRef(false);

  const scopedApi = useMemo(() => ({
    ...api, signUpload: (body) => api.signUpload({ ...body, pageId: page.id, blockId: block.id, ...(editRecord ? { recordId: editRecord.id } : {}) }),
  }), [api, page.id, block.id, editRecord]);
  const keepsDrafts = !isEdit && config.drafts && data.signedIn && !api.readOnly && Boolean(api.saveDraft);

  // Autosaves a draft a moment after the last change.
  useEffect(() => {
    if (!keepsDrafts || !touched.current || done) return undefined;
    const timer = setTimeout(async () => {
      setSavingDraft(true);
      const { data: result } = await api.saveDraft({ pageId: page.id, blockId: block.id, data: { values, person, step } });
      setSavingDraft(false);
      if (result?.at) setSaved(result.at);
    }, 1200);
    return () => clearTimeout(timer);
  }, [keepsDrafts, values, person, step, done, api, page.id, block.id]);

  const setValue = (fieldId, next) => {
    touched.current = true;
    setValues((current) => ({ ...current, [fieldId]: next }));
    if (errors[fieldId]) setErrors((current) => ({ ...current, [fieldId]: undefined }));
  };
  const setPersonValue = (fieldId, next) => {
    touched.current = true;
    setPerson((current) => ({ ...current, [fieldId]: next }));
    if (errors[`person:${fieldId}`]) setErrors((current) => ({ ...current, [`person:${fieldId}`]: undefined }));
  };

  const missing = (items, source, prefix = "") => Object.fromEntries(items.filter((item) => item.required && isEmpty(source[item.fieldId]))
    .filter((item) => !isEdit || editable.has(item.fieldId)).map((item) => [`${prefix}${item.fieldId}`, "Required."]));

  const next = () => {
    const current = sectionAt(step);
    const problems = { ...(step === 0 ? missing(personItems, person, "person:") : {}), ...(current ? missing(current.fields, values) : {}) };
    if (Object.keys(problems).length) { setErrors(problems); return; }
    touched.current = true;
    setStep((n) => Math.min(stepCount - 1, n + 1));
  };

  const submit = async () => {
    const problems = { ...missing(personItems, person, "person:"), ...missing(allItems, values) };
    if (Object.keys(problems).length) {
      setErrors(problems);
      if (stepped) setStep(stepOf(problems));
      toast.error("Fill in the required answers.");
      return;
    }
    if (!data.signedIn && !isEdit) { setVerifying(true); return; }
    await send();
  };

  const send = async () => {
    setBusy(true);
    let body;
    if (isEdit) {
      const changed = {};
      for (const item of allItems) {
        if (!editable.has(item.fieldId)) continue;
        const field = byId.get(item.fieldId);
        const before = getType(field.type).cast === "link" ? editRecord.links?.[field.id] ?? [] : editRecord.values?.[field.id] ?? null;
        if (JSON.stringify(values[field.id] ?? null) !== JSON.stringify(before)) changed[field.id] = values[field.id] === "" ? null : values[field.id] ?? null;
      }
      body = { action: "record.update", recordId: editRecord.id, expectedRevision: editRecord.revision, values: changed };
    } else {
      const clean = Object.fromEntries(allItems.filter((item) => !isEmpty(values[item.fieldId])).map((item) => [item.fieldId, values[item.fieldId]]));
      const details = Object.fromEntries(personItems.filter((item) => !isEmpty(person[item.fieldId])).map((item) => [item.fieldId, person[item.fieldId]]));
      body = { action: "record.create", pageId: page.id, blockId: block.id, recordId: pageRecord?.id ?? null, values: clean, ...(needsPerson ? { person: details } : {}) };
    }
    const { data: result, error } = await api.command(body);
    setBusy(false);
    if (error) {
      if (error.fields) {
        setErrors(error.fields);
        if (stepped) setStep(stepOf(error.fields));
      }
      toast.error(error.message);
      return;
    }
    setDone(result ?? {});
    if (!isEdit) { setValues({}); setPerson({}); setStep(0); touched.current = false; }
    refresh();
  };

  if (done) {
    const message = done.success?.message || config.success?.message || (isEdit ? "Your changes are saved." : "Thanks — we've received it.");
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
        <p className="max-w-md whitespace-pre-line text-sm text-foreground">{message}</p>
        <div className="mt-1 flex flex-wrap justify-center gap-2">
          {done.link && api.openRecord ? <Button variant="outline" onClick={() => api.openRecord({ list: done.link.objectKey, number: done.link.number, objectId: config.objectId })}>View submission</Button> : null}
          {config.success?.page && api.navigate ? <Button onClick={() => api.navigate(config.success.page)}>Continue</Button> : null}
          {!isEdit ? <Button variant={config.success?.page ? "outline" : "default"} onClick={() => setDone(null)}>Submit another</Button> : null}
          {isEdit ? <Button variant="outline" onClick={() => setDone(null)}>Back to the form</Button> : null}
        </div>
      </div>
    );
  }

  const current = sectionAt(step);
  const visible = stepped ? (current ? [current] : []) : sections;
  const showPerson = personItems.length > 0 && (!stepped || step === 0);
  const last = !stepped || step === stepCount - 1;
  const titles = [...(personStep ? ["Your details"] : []), ...sections.map((section, index) => section.title || `Step ${index + 1 + (personStep ? 1 : 0)}`)];
  const required = [...(showPerson ? personItems : []), ...visible.flatMap((section) => section.fields)].some((item) => item.required);
  const draftNote = api.readOnly ? api.readOnly : keepsDrafts ? (savingDraft ? "Saving draft…" : saved ? `Draft saved ${timeAgo(saved)}` : "Your answers are saved as you go.") : "";

  return (
    <div className="@container/block">
      {stepped ? <Stepper titles={titles} step={step} /> : null}

      {showPerson ? (
        <FormSection title="Your details" description="We'll use these to set up your account for this event.">
          <div className="grid gap-5 @xl/block:grid-cols-2">
            {personItems.map((item) => (
              <FormField key={item.fieldId} field={personById.get(item.fieldId)} item={item} value={person[item.fieldId]} api={scopedApi}
                error={errors[`person:${item.fieldId}`]} onChange={(value) => setPersonValue(item.fieldId, value)} />
            ))}
          </div>
        </FormSection>
      ) : null}

      {visible.map((section, index) => (
        <FormSection key={`${step}-${index}`} title={section.title} description={section.description} divided={showPerson || index > 0}>
          <div className="grid gap-5 @xl/block:grid-cols-2">
            {section.fields.map((item) => (
              <FormField key={item.fieldId} field={byId.get(item.fieldId)} item={item} value={values[item.fieldId]} api={scopedApi}
                error={errors[item.fieldId]} onChange={(value) => setValue(item.fieldId, value)}
                readOnly={isEdit && !editable.has(item.fieldId)} record={editRecord} list={list} />
            ))}
          </div>
        </FormSection>
      ))}

      {verifying ? (
        <Card className="mx-5 mb-5 gap-3 bg-background p-4 shadow-none sm:mx-6">
          <div className="grid gap-1">
            <p className="text-sm font-semibold text-foreground">Confirm your email to submit</p>
            <p className="text-sm text-text-secondary">We&apos;ll send a code so you can come back to your submission later.</p>
          </div>
          {api.signIn ? (
            <CodeSignIn signIn={api.signIn} submitLabel="Send code" onDone={async () => { setVerifying(false); await send(); api.onSignedIn?.(); }} />
          ) : <p className="text-sm text-text-secondary">Signing in isn&apos;t available here.</p>}
          <Button variant="ghost" size="sm" className="self-start" onClick={() => setVerifying(false)}>Back to the form</Button>
        </Card>
      ) : (
        <div className="flex flex-wrap items-center gap-2.5 border-t border-border bg-background/40 px-5 py-3.5">
          <span className="min-w-0 flex-1 text-[12.5px] text-text-secondary">
            {required ? <><span className="text-red-500">*</span> Required</> : null}
            {required && draftNote ? " · " : null}{draftNote}
          </span>
          {stepped && step > 0 ? <Button variant="outline" className="bg-surface-card" onClick={() => setStep((n) => n - 1)}><ArrowLeft className="h-4 w-4" />Back</Button> : null}
          {last ? (
            <Button onClick={submit} disabled={busy || Boolean(api.readOnly)}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{config.submitLabel || (isEdit ? "Save changes" : "Submit")}
            </Button>
          ) : <Button onClick={next}>Continue<ArrowRight className="h-4 w-4" /></Button>}
        </div>
      )}
    </div>
  );
}

// Numbered steps across the top of a stepped form: done ones ticked, the current one in the event colour.
function Stepper({ titles, step }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3.5">
      {titles.map((title, index) => (
        <span key={index} className="contents">
          {index ? <span className="hidden h-px w-10 bg-border-strong sm:block" aria-hidden /> : null}
          <span className={cn("inline-flex items-center gap-2.5 text-[13.5px] font-medium", index <= step ? "text-foreground" : "text-text-secondary")}>
            <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
              index <= step ? "bg-primary text-primary-foreground" : "border border-border-strong text-text-secondary")}>
              {index < step ? <Check className="h-3.5 w-3.5" /> : index + 1}
            </span>
            <span className={cn(index !== step && "hidden sm:inline")}>{title}</span>
          </span>
        </span>
      ))}
      <span className="flex-1" />
      <span className="font-mono text-xs text-text-secondary">Step {step + 1} of {titles.length}</span>
    </div>
  );
}

// One part of a form: its title and description on the left, the fields on the right (stacked on narrow screens).
function FormSection({ title, description, divided = false, children }) {
  const side = Boolean(title || description);
  return (
    <section className={cn("grid gap-x-10 gap-y-5 px-5 py-7 sm:px-6", side && "@2xl/block:grid-cols-[minmax(0,240px)_minmax(0,1fr)]", divided && "border-t border-border")}>
      {side ? (
        <div className="grid content-start gap-1.5">
          {title ? <h3 className="text-[14.5px] font-semibold text-foreground">{title}</h3> : null}
          {description ? <p className="whitespace-pre-line text-[13px] leading-relaxed text-text-secondary">{description}</p> : null}
        </div>
      ) : null}
      <div className="min-w-0">{children}</div>
    </section>
  );
}

// Collects a new record (optionally signing the person up) or edits one; respects the form's open and close dates.
export function FormBlock({ block, fill }) {
  const config = block.config;
  const { api, timeZone } = usePortalView();
  const { data, error, loading, reload } = useBlockData(block, {});
  const [signingIn, setSigningIn] = useState(false);

  let body;
  if (loading) body = <BlockLoading label="Loading form" />;
  else if (error) body = <BlockError error={error} onRetry={reload} />;
  else if (data.state === "not_open") {
    body = <BlockMessage icon={CalendarClock} title="Not open yet" text={config.opensAt ? `This form opens ${formatDateTime(config.opensAt, timeZone)}.` : "This form isn't open yet."} />;
  } else if (data.state === "closed") {
    body = <BlockMessage icon={Lock} title="Closed" text={config.closesAt ? `Submissions closed ${formatDateTime(config.closesAt, timeZone)}.` : "Submissions are closed."} />;
  } else if (config.mode === "edit" && !data.record) {
    body = <BlockMessage icon={Lock} title="Nothing to edit" text="This form edits a record you have access to." />;
  } else if (config.mode === "create" && !data.canCreate && !data.signup) {
    body = data.signedIn ? (
      <BlockMessage icon={Lock} title="Not available to you" text="You can't submit this form. Contact the organisers if you think this is wrong." />
    ) : (
      <div className="mx-auto grid max-w-sm gap-4 px-4 py-10">
        <div className="grid gap-1 text-center">
          <p className="text-sm font-semibold text-foreground">Sign in to fill in this form</p>
          <p className="text-sm text-text-secondary">Use the email address the organisers have for you.</p>
        </div>
        {signingIn && api.signIn ? <CodeSignIn signIn={api.signIn} onDone={() => api.onSignedIn?.()} />
          : <Button onClick={() => setSigningIn(true)} disabled={!api.signIn}>Sign in</Button>}
      </div>
    );
  } else {
    body = <FormBody key={`${data.record?.id ?? "new"}:${data.record?.revision ?? 0}`} block={block} data={data} />;
  }

  const filling = body?.type === FormBody;
  return (
    <BlockFrame fill={fill}>
      {config.title || config.intro ? (
        <div className="grid gap-1.5 border-b border-border px-5 py-5 sm:px-6">
          {config.title ? <h2 className="text-lg font-semibold text-foreground">{config.title}</h2> : null}
          {config.intro ? <p className="whitespace-pre-line text-sm leading-relaxed text-text-secondary">{config.intro}</p> : null}
          {data?.state === "open" && config.closesAt ? (
            <p className="flex items-center gap-1.5 text-xs text-text-tertiary"><CalendarClock className="h-3.5 w-3.5" />Closes {formatDateTime(config.closesAt, timeZone)}</p>
          ) : null}
        </div>
      ) : null}
      {filling ? body : <div className="px-5 py-2">{body}</div>}
    </BlockFrame>
  );
}
