"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Loader2, Plus, RefreshCcw, Trash2 } from "lucide-react";
import {
  Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Input, LogoLoading, LucideIcon,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch,
} from "@geiger/ui";
import { cn } from "@/lib/utils";
import { liveFieldsOf } from "../state/use_workspace";
import { TemplateInput } from "../process/template_input";
import { BLOCK_EDITORS, FieldChecklist, Row } from "./block_settings";
import { DiscardDialog, ListPicker, RecordPicker, newBlockId } from "./editor_parts";

const INNER = ["heading", "text", "field", "image", "qr", "signature", "spacer", "divider"];

export function blankBlock(kind) {
  const id = newBlockId();
  switch (kind) {
    case "heading": return { id, kind, text: "", level: 1, align: "left" };
    case "text": return { id, kind, text: "", size: 11, align: "left", bold: false, muted: false };
    case "field": return { id, kind, fieldId: null, label: true, align: "left" };
    case "image": return { id, kind, url: "", width: 40, align: "left" };
    case "qr": return { id, kind, source: "text", text: "", size: 30, caption: "", align: "left" };
    case "signature": return { id, kind, url: "", name: "", role: "", align: "left" };
    case "spacer": return { id, kind, height: 8 };
    case "divider": return { id, kind };
    case "table": return { id, kind, linkFieldId: null, columns: [], title: "" };
    case "columns": return { id, kind, left: [blankBlock("text")], right: [blankBlock("text")] };
    default: return { id, kind };
  }
}

export function blankPdf(objectId) {
  return {
    kind: "pdf", name: "Untitled document", objectId: objectId ?? null,
    config: {
      page: { size: "A4", orientation: "portrait", margin: 20, font: "sans", color: "#111827", accent: "#111827", background: "" },
      certificate: { enabled: false, holder: "", fields: [] },
      blocks: [{ ...blankBlock("heading"), text: "{{event.name}}" }, blankBlock("text")],
    },
  };
}

function AddBlockMenu({ catalog, kinds, onAdd, label = "Add block" }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button type="button" variant="outline" size="sm"><Plus className="h-4 w-4" />{label}</Button></DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {kinds.map((kind) => (
          <DropdownMenuItem key={kind} onSelect={() => onAdd(blankBlock(kind))}>
            <LucideIcon name={catalog[kind]?.icon ?? "square"} className="h-4 w-4" />{catalog[kind]?.label ?? kind}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function BlockList({ blocks, onChange, ctx, catalog, kinds, nested = false }) {
  const set = (index, next) => onChange(blocks.map((item, i) => (i === index ? next : item)));
  const move = (index, by) => {
    const next = [...blocks];
    const [item] = next.splice(index, 1);
    next.splice(index + by, 0, item);
    onChange(next);
  };
  return (
    <div className="space-y-2">
      {blocks.map((block, index) => {
        const Editor = BLOCK_EDITORS[block.kind];
        return (
          <div key={block.id} className={cn("rounded-lg border border-border", nested ? "bg-surface-subtle" : "bg-surface-card")}>
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <LucideIcon name={catalog[block.kind]?.icon ?? "square"} className="h-4 w-4 text-text-secondary" />
              <span className="text-sm font-medium text-foreground">{catalog[block.kind]?.label ?? block.kind}</span>
              <div className="ml-auto flex items-center">
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label="Move up" disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp className="h-3.5 w-3.5" /></Button>
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label="Move down" disabled={index === blocks.length - 1} onClick={() => move(index, 1)}><ArrowDown className="h-3.5 w-3.5" /></Button>
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label="Remove block" onClick={() => onChange(blocks.filter((_, i) => i !== index))}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
            <div className="p-3">
              {block.kind === "columns" ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {["left", "right"].map((side) => (
                    <div key={side} className="space-y-2">
                      <p className="text-xs font-medium text-text-secondary">{side === "left" ? "Left column" : "Right column"}</p>
                      <BlockList nested blocks={block[side] ?? []} onChange={(list) => set(index, { ...block, [side]: list })} ctx={ctx} catalog={catalog} kinds={INNER} />
                    </div>
                  ))}
                </div>
              ) : Editor ? <Editor ctx={ctx} block={block} onChange={(next) => set(index, next)} /> : null}
            </div>
          </div>
        );
      })}
      <AddBlockMenu catalog={catalog} kinds={kinds} onAdd={(block) => onChange([...blocks, block])} label={nested ? "Add" : "Add block"} />
    </div>
  );
}

function PageSettings({ page, onChange }) {
  const set = (patch) => onChange({ ...page, ...patch });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Row label="Paper">
        <Select value={`${page.size}:${page.orientation}`} onValueChange={(value) => { const [size, orientation] = value.split(":"); set({ size, orientation }); }}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="A4:portrait">A4, portrait</SelectItem>
            <SelectItem value="A4:landscape">A4, landscape</SelectItem>
            <SelectItem value="Letter:portrait">Letter, portrait</SelectItem>
            <SelectItem value="Letter:landscape">Letter, landscape</SelectItem>
          </SelectContent>
        </Select>
      </Row>
      <Row label="Typeface">
        <Select value={page.font} onValueChange={(font) => set({ font })}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="sans">Sans (Noto Sans)</SelectItem><SelectItem value="serif">Serif (Noto Serif)</SelectItem></SelectContent>
        </Select>
      </Row>
      <Row label="Margins">
        <div className="flex items-center gap-2">
          <Input type="number" min={5} max={60} className="h-9 w-24" value={page.margin} onChange={(e) => set({ margin: Math.max(5, Math.min(60, Number(e.target.value) || 5)) })} />
          <span className="text-sm text-text-secondary">mm</span>
        </div>
      </Row>
      <div className="flex items-end gap-4">
        <Row label="Text"><Input type="color" className="h-9 w-14 p-1" value={page.color} onChange={(e) => set({ color: e.target.value })} aria-label="Text colour" /></Row>
        <Row label="Headings"><Input type="color" className="h-9 w-14 p-1" value={page.accent} onChange={(e) => set({ accent: e.target.value })} aria-label="Heading colour" /></Row>
      </div>
      <Row label="Background image (optional)" hint="Fills the page behind everything. An https:// PNG or JPEG." className="sm:col-span-2">
        <Input value={page.background ?? ""} placeholder="https://example.org/certificate-frame.png" onChange={(e) => set({ background: e.target.value })} />
      </Row>
    </div>
  );
}

// Live preview: the server renders the real PDF for the chosen record (or sample values) shortly after each change.
function PreviewPanel({ api, draft, eventId, objectId, data, object }) {
  const [recordId, setRecordId] = useState(null);
  const [version, setVersion] = useState(0);
  const [preview, setPreview] = useState({ key: null, url: null, warnings: [], error: null });
  const urlRef = useRef(null);
  const body = useMemo(() => JSON.stringify({ document: draft, recordId, version }), [draft, recordId, version]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const { document, recordId: chosen } = JSON.parse(body);
      api.preview({ document, recordId: chosen }, controller.signal).then(({ data: result, error }) => {
        if (controller.signal.aborted) { if (result?.url) URL.revokeObjectURL(result.url); return; }
        if (result?.url) {
          if (urlRef.current) URL.revokeObjectURL(urlRef.current);
          urlRef.current = result.url;
        }
        setPreview({ key: body, url: result?.url ?? urlRef.current, warnings: result?.warnings ?? [], error });
      }).catch(() => {});
    }, 700);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [api, body]);

  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

  const busy = preview.key !== body;
  return (
    <div className="space-y-3 lg:sticky lg:top-4">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <RecordPicker eventId={eventId} data={data} object={object} objectId={objectId} value={recordId} onChange={setRecordId} />
        </div>
        <Button type="button" variant="outline" size="icon" aria-label="Render again" onClick={() => setVersion((n) => n + 1)}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
        </Button>
      </div>
      {preview.error ? <p className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">{preview.error.message}</p> : null}
      {preview.warnings.map((warning) => <p key={warning} className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">{warning}</p>)}
      {preview.url ? (
        <iframe src={preview.url} title="PDF preview" className="h-[72vh] w-full rounded-lg border border-border bg-white" />
      ) : (
        <div className="flex h-[72vh] items-center justify-center rounded-lg border border-border bg-surface-subtle">
          {preview.error ? <p className="px-6 text-center text-sm text-text-secondary">Fix the problem above to see the page.</p> : <LogoLoading size={48} aria-label="Rendering the preview" />}
        </div>
      )}
    </div>
  );
}

// Full-width editor for one PDF document: settings and blocks on the left, the rendered PDF on the right.
export function PdfEditor({ eventId, ws, documents, document: initial, onClose }) {
  const data = ws.data;
  const [draft, setDraft] = useState(initial);
  const [saved, setSaved] = useState(initial.id ? initial : null);
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const catalog = documents.data?.catalog?.blocks ?? {};
  const object = data.objects.find((item) => item.id === draft.objectId && !item.deletedAt) ?? null;
  const certificate = draft.config.certificate ?? { enabled: false, holder: "", fields: [] };
  const extra = certificate.enabled ? documents.data?.catalog?.placeholders ?? [] : [];
  const ctx = { data, objectId: draft.objectId, extra, certificate: certificate.enabled };
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved ?? initial) || !saved;
  const setConfig = (patch) => setDraft((current) => ({ ...current, config: { ...current.config, ...patch } }));

  const save = async () => {
    setSaving(true);
    const result = await documents.run("document.save", { id: saved?.id, document: draft, expectedRevision: saved?.revision }, { success: "Document saved" });
    setSaving(false);
    if (result.data?.document) { setSaved(result.data.document); setDraft(result.data.document); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => (dirty ? setLeaving(true) : onClose())}>
          <ArrowLeft className="h-4 w-4" />Documents
        </Button>
        <Input value={draft.name} maxLength={120} aria-label="Document name" className="h-9 max-w-xs" onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
        <div className="w-48"><ListPicker data={data} value={draft.objectId} onChange={(objectId) => setDraft((d) => ({ ...d, objectId }))} /></div>
        <div className="ml-auto flex items-center gap-2">
          {dirty ? <span className="text-xs text-text-tertiary">Unsaved changes</span> : null}
          <Button onClick={save} disabled={saving || !draft.name.trim()}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Save</Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,30rem)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Page</h3>
            <PageSettings page={draft.config.page} onChange={(page) => setConfig({ page })} />
          </section>

          <section className="space-y-3 rounded-lg border border-border p-3">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Switch checked={certificate.enabled} disabled={!draft.objectId} onCheckedChange={(enabled) => setConfig({ certificate: { ...certificate, enabled } })} />
              This is a certificate
            </label>
            <p className="text-xs text-text-secondary">
              {draft.objectId
                ? "Each copy gets a unique code that anyone can check on a public page. Add a QR code that holds the check link, or show {{certificate.code}}."
                : "Choose the list this document is for to make it a certificate."}
            </p>
            {certificate.enabled ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Row label="Issued to"><TemplateInput data={data} objectId={draft.objectId} value={certificate.holder} placeholder="{{Name}}" onChange={(holder) => setConfig({ certificate: { ...certificate, holder } })} /></Row>
                <Row label="Shown on the check page">
                  <FieldChecklist fields={liveFieldsOf(data, draft.objectId).filter((field) => field.type !== "attachments")} value={certificate.fields}
                    onChange={(fields) => setConfig({ certificate: { ...certificate, fields } })} placeholder="Choose fields to show" />
                </Row>
              </div>
            ) : null}
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Blocks</h3>
            <BlockList blocks={draft.config.blocks} onChange={(blocks) => setConfig({ blocks })} ctx={ctx} catalog={catalog} kinds={Object.keys(catalog)} />
          </section>
        </div>

        <PreviewPanel api={documents.api} draft={draft} eventId={eventId} objectId={draft.objectId} data={data} object={object} />
      </div>
      <DiscardDialog open={leaving} onOpenChange={setLeaving} onDiscard={onClose} />
    </div>
  );
}

