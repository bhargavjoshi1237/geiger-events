"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button, Input, LogoLoading } from "@geiger/ui";
import { TemplateInput, TemplateRichText } from "../process/template_input";
import { Row } from "./block_settings";
import { DiscardDialog, ListPicker, RecordPicker } from "./editor_parts";

export const blankEmail = (objectId) => ({ kind: "email", name: "Untitled email", objectId: objectId ?? null, config: { subject: "", body: "" } });

function EmailPreview({ api, draft, eventId, object }) {
  const [recordId, setRecordId] = useState(null);
  const [preview, setPreview] = useState({ key: null, mail: null, error: null });
  const body = useMemo(() => JSON.stringify({ document: draft, recordId }), [draft, recordId]);
  const ready = draft.config.subject.trim() && draft.config.body.replace(/<[^>]+>/g, "").trim();

  useEffect(() => {
    if (!ready) return undefined;
    let alive = true;
    const timer = setTimeout(() => {
      const input = JSON.parse(body);
      api.command({ action: "email.preview", ...input }).then(({ data, error }) => { if (alive) setPreview({ key: body, mail: data, error }); });
    }, 600);
    return () => { alive = false; clearTimeout(timer); };
  }, [api, body, ready]);

  return (
    <div className="space-y-3 lg:sticky lg:top-4">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1"><RecordPicker eventId={eventId} object={object} objectId={draft.objectId} value={recordId} onChange={setRecordId} /></div>
        {ready && preview.key !== body ? <Loader2 className="h-4 w-4 animate-spin text-text-secondary" aria-label="Updating the preview" /> : null}
      </div>
      {!ready ? (
        <div className="flex h-[60vh] items-center justify-center rounded-lg border border-border bg-surface-subtle px-6 text-center text-sm text-text-secondary">Write a subject and a message to see the email.</div>
      ) : preview.error ? (
        <p className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">{preview.error.message}</p>
      ) : preview.mail ? (
        <div className="overflow-hidden rounded-lg border border-border">
          <p className="truncate border-b border-border bg-surface-card px-3 py-2 text-sm"><span className="text-text-secondary">Subject: </span>{preview.mail.subject}</p>
          <iframe title="Email preview" sandbox="" srcDoc={preview.mail.html} className="h-[60vh] w-full bg-white" />
        </div>
      ) : (
        <div className="flex h-[60vh] items-center justify-center rounded-lg border border-border bg-surface-subtle"><LogoLoading size={48} aria-label="Rendering the preview" /></div>
      )}
    </div>
  );
}

// Editor for one reusable email: subject and message with placeholders, previewed in the event's email layout.
export function EmailEditor({ eventId, ws, documents, document: initial, onClose }) {
  const data = ws.data;
  const [draft, setDraft] = useState(initial);
  const [saved, setSaved] = useState(initial.id ? initial : null);
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [bodyKey, setBodyKey] = useState(0);
  const object = data.objects.find((item) => item.id === draft.objectId && !item.deletedAt) ?? null;
  const dirty = !saved || JSON.stringify(draft) !== JSON.stringify(saved);
  const setConfig = (patch) => setDraft((current) => ({ ...current, config: { ...current.config, ...patch } }));

  const save = async () => {
    setSaving(true);
    const result = await documents.run("document.save", { id: saved?.id, document: draft, expectedRevision: saved?.revision }, { success: "Email template saved" });
    setSaving(false);
    if (result.data?.document) {
      setSaved(result.data.document);
      setDraft(result.data.document);
      setBodyKey((n) => n + 1);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => (dirty ? setLeaving(true) : onClose())}><ArrowLeft className="h-4 w-4" />Documents</Button>
        <Input value={draft.name} maxLength={120} aria-label="Template name" className="h-9 max-w-xs" onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
        <div className="w-48"><ListPicker data={data} value={draft.objectId} onChange={(objectId) => setDraft((d) => ({ ...d, objectId }))} /></div>
        <div className="ml-auto flex items-center gap-2">
          {dirty ? <span className="text-xs text-text-tertiary">Unsaved changes</span> : null}
          <Button onClick={save} disabled={saving || !draft.name.trim()}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Save</Button>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,32rem)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          <Row label="Subject"><TemplateInput data={data} objectId={draft.objectId} value={draft.config.subject} maxLength={300} onChange={(subject) => setConfig({ subject })} /></Row>
          <Row label="Message" hint="Automations with a “Send an email” step can use this template instead of writing the message there.">
            <TemplateRichText key={bodyKey} data={data} objectId={draft.objectId} value={draft.config.body} onChange={(body) => setConfig({ body })} />
          </Row>
        </div>
        <EmailPreview api={documents.api} draft={draft} eventId={eventId} object={object} />
      </div>
      <DiscardDialog open={leaving} onOpenChange={setLeaving} onDiscard={onClose} />
    </div>
  );
}
