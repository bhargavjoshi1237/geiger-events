"use client";

import { useEffect, useState } from "react";
import { Copy, LayoutTemplate, Loader2, Plus, RotateCcw, Trash2 } from "lucide-react";
import {
  Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, LogoLoading, Textarea,
} from "@geiger/ui";
import { toast } from "sonner";
import { EditorSectionHeader, SectionCard, SegmentedTabs } from "@/components/internal/shared/screen_kit";
import { workspaceApi } from "@/lib/workspace/client";
import { formatDate, timeAgo } from "../state/format";
import { ObjectIcon } from "../ws_ui";
import { CopyWizard } from "../setup/copy_wizard";
import { ObjectSheet } from "../edit/object_sheet";
import { ApiSection } from "./api_section";
import { TemplateGallery } from "../setup/template_gallery";

const DAY = 86_400_000;
const daysLeft = (deletedAt) => Math.max(0, 30 - Math.floor((Date.now() - new Date(deletedAt).getTime()) / DAY));

// One sentence per change for the change log.
function describe(change, data) {
  const object = data?.objects.find((item) => item.id === change.objectId);
  const field = data?.fields.find((item) => item.id === change.fieldId);
  const list = object?.plural ?? "a list";
  switch (change.action) {
    case "object.create": return `added the list ${list}`;
    case "object.update": return `changed the list ${list}`;
    case "object.delete": return `moved the list ${list} to the trash`;
    case "object.restore": return `restored the list ${list}`;
    case "field.create": return `added the field ${field?.name ?? "a field"} to ${list}`;
    case "field.update": return `changed the field ${field?.name ?? "a field"} on ${list}`;
    case "field.delete": return `moved the field ${field?.name ?? "a field"} to the trash`;
    case "field.restore": return `restored the field ${field?.name ?? "a field"}`;
    case "record.create": return `added a record to ${list}`;
    case "record.update": return `edited a record in ${list}`;
    case "records.delete": return `moved ${change.after?.recordIds?.length ?? 1} record${(change.after?.recordIds?.length ?? 1) === 1 ? "" : "s"} to the trash`;
    case "records.restore": return `restored ${change.after?.recordIds?.length ?? 1} record${(change.after?.recordIds?.length ?? 1) === 1 ? "" : "s"}`;
    case "change.undo": return "undid a change";
    default: return "made a change";
  }
}

function ChangeLog({ eventId, data }) {
  const [kind, setKind] = useState("all");
  return (
    <SectionCard title="Change log" description="Everything changed in this workspace, newest first.">
      <div className="space-y-3">
        <SegmentedTabs value={kind} onChange={setKind} tabs={[{ label: "Everything", value: "all" }, { label: "Structure", value: "structure" }, { label: "Records", value: "record" }]} />
        <ChangeList key={kind} eventId={eventId} kind={kind} data={data} />
      </div>
    </SectionCard>
  );
}

function ChangeList({ eventId, kind, data }) {
  const [rows, setRows] = useState(null);
  const [more, setMore] = useState(false);
  const filter = kind === "all" ? undefined : kind;
  useEffect(() => {
    let alive = true;
    workspaceApi.changes(eventId, { kind: filter }).then(({ data: result }) => {
      if (!alive) return;
      const page = result?.changes ?? [];
      setRows(page);
      setMore(page.length === 50);
    });
    return () => { alive = false; };
  }, [eventId, filter]);
  const older = async () => {
    const { data: result } = await workspaceApi.changes(eventId, { kind: filter, before: rows[rows.length - 1].at });
    const page = result?.changes ?? [];
    setRows((current) => [...current, ...page]);
    setMore(page.length === 50);
  };
  return (
    <>
        {rows === null ? <div className="flex justify-center py-8"><LogoLoading size={36} aria-label="Loading changes" /></div> : rows.length ? (
          <ol className="divide-y divide-border">
            {rows.map((change) => (
              <li key={change.id} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 text-foreground"><span className="font-medium">{change.actor}</span> <span className="text-text-secondary">{describe(change, data)}</span>{change.undone ? <span className="text-text-tertiary"> (undone)</span> : null}</span>
                <span className="shrink-0 text-xs text-text-tertiary">{timeAgo(change.at)}</span>
              </li>
            ))}
          </ol>
        ) : <p className="text-sm text-text-secondary">No changes yet.</p>}
        {more ? <Button variant="outline" size="sm" onClick={older}>Show older</Button> : null}
    </>
  );
}

function Trash({ eventId, ws }) {
  const [trash, setTrash] = useState(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    workspaceApi.trash(eventId).then(({ data }) => { if (alive) setTrash(data ?? { objects: [], fields: [], records: [] }); });
    return () => { alive = false; };
  }, [eventId, ws.data, version]);
  const restore = async (action, payload) => { const result = await ws.run(action, payload, { success: "Restored", undo: false }); if (!result.error) setVersion((n) => n + 1); };
  const objects = new Map((ws.data?.objects ?? []).map((object) => [object.id, object]));
  const items = trash ? [
    ...trash.objects.map((object) => ({ id: object.id, label: `List · ${object.plural}`, at: object.deletedAt, restore: () => restore("object.restore", { objectId: object.id }) })),
    ...trash.fields.map((field) => ({ id: field.id, label: `Field · ${field.name} on ${objects.get(field.objectId)?.plural ?? "a list"}`, at: field.deletedAt, restore: () => restore("field.restore", { fieldId: field.id, objectId: field.objectId }) })),
    ...trash.records.map((record) => {
      const object = objects.get(record.objectId);
      return { id: record.id, label: `${object?.name ?? "Record"} · ${record.label || `${object?.numberPrefix ?? "REC"}-${record.number}`}`, at: record.deletedAt, restore: object && !object.deletedAt ? () => restore("records.restore", { recordIds: [record.id] }) : null };
    }),
  ].sort((a, b) => new Date(b.at) - new Date(a.at)) : null;
  return (
    <SectionCard title="Trash" description="Deleted lists, fields and records stay here for 30 days, then they're removed for good.">
      {items === null ? <div className="flex justify-center py-8"><LogoLoading size={36} aria-label="Loading trash" /></div> : items.length ? (
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0 truncate text-foreground">{item.label}</span>
              <span className="flex shrink-0 items-center gap-3">
                <span className="text-xs text-text-tertiary">{daysLeft(item.at)} days left</span>
                {item.restore && ws.can.configure ? <Button size="sm" variant="ghost" onClick={item.restore}><RotateCcw className="h-4 w-4" />Restore</Button> : null}
              </span>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-text-secondary">The trash is empty.</p>}
    </SectionCard>
  );
}

function Templates({ eventId }) {
  const [templates, setTemplates] = useState(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    workspaceApi.templates(eventId).then(({ data }) => { if (alive) setTemplates(data?.templates ?? []); });
    return () => { alive = false; };
  }, [eventId, version]);
  const load = () => setVersion((n) => n + 1);
  const save = async () => {
    setBusy(true);
    const { error } = await workspaceApi.saveTemplate(eventId, { name, description });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Template saved");
    setOpen(false); setName(""); setDescription("");
    load();
  };
  const remove = async (id) => {
    const { error } = await workspaceApi.deleteTemplate(eventId, id);
    if (error) toast.error(error.message); else load();
  };
  return (
    <SectionCard title="Templates" description="Save this workspace's lists, fields and shared views (not records) to start other events from."
      action={<Button size="sm" variant="outline" onClick={() => setOpen(true)}><LayoutTemplate className="h-4 w-4" />Save as template</Button>}>
      {templates === null ? null : templates.length ? (
        <ul className="divide-y divide-border">
          {templates.map((template) => (
            <li key={template.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0"><span className="block truncate font-medium text-foreground">{template.name}</span><span className="block truncate text-xs text-text-secondary">{template.lists.join(", ")} · saved {formatDate(template.updatedAt)}</span></span>
              <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Delete ${template.name}`} onClick={() => remove(template.id)}><Trash2 className="h-4 w-4" /></Button>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-text-secondary">No templates saved in this project yet.</p>}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Save as template</DialogTitle><DialogDescription>Anyone in this project can start an event workspace from it.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label htmlFor="ws-template-name">Name</Label><Input id="ws-template-name" autoFocus maxLength={100} value={name} onChange={(e) => setName(e.target.value)} placeholder="Research conference" /></div>
            <div className="space-y-1.5"><Label htmlFor="ws-template-description">Description</Label><Textarea id="ws-template-description" rows={3} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={busy || !name.trim()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Save template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}

function DeleteWorkspace({ ws, eventName }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const confirmText = eventName || "delete";
  const remove = async () => {
    setBusy(true);
    const result = await ws.run("workspace.delete", {}, { success: "Workspace deleted", undo: false });
    setBusy(false);
    if (!result.error) setOpen(false);
  };
  return (
    <SectionCard title="Delete workspace" description="Removes every list, record, file and view in this event's workspace. This can't be undone.">
      <Button variant="outline" className="text-red-600 hover:text-red-600 dark:text-red-400" onClick={() => { setTyped(""); setOpen(true); }}>
        <Trash2 className="h-4 w-4" />Delete workspace
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this workspace?</DialogTitle>
            <DialogDescription>Type <span className="font-medium text-foreground">{confirmText}</span> to confirm. Everything in it is removed for good.</DialogDescription>
          </DialogHeader>
          <Input autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="bg-red-500/90 text-white hover:bg-red-500" disabled={busy || typed.trim() !== confirmText} onClick={remove}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Delete workspace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}

export function SettingsScreen({ eventId, ws, onOpenObject }) {
  const [wizard, setWizard] = useState(false);
  const [creating, setCreating] = useState(false);
  const [gallery, setGallery] = useState(false);
  return (
    <div className="space-y-5">
      <EditorSectionHeader title="Workspace settings" description="Lists, copying, templates, history and the trash."
        action={ws.can.configure ? <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" />New list</Button> : null} />
      <SectionCard title="Lists" description="Each list appears in the sidebar under Workspace.">
        {ws.objects.length ? (
          <ul className="divide-y divide-border">
            {[...ws.objects].sort((a, b) => a.position - b.position).map((object) => (
              <li key={object.id}>
                <button type="button" onClick={() => onOpenObject(object.id)} className="flex w-full items-center gap-2 py-2 text-left text-sm hover:text-foreground">
                  <ObjectIcon icon={object.icon} className="h-4 w-4 text-text-secondary" />
                  <span className="font-medium text-foreground">{object.plural}</span>
                  <span className="text-xs text-text-tertiary">{object.numberPrefix}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-text-secondary">No lists yet.</p>}
      </SectionCard>
      {ws.can.configure ? (
        <SectionCard title="Import from another event or a template" description="Bring over lists, fields, views and records from an earlier event, or add a built-in template's lists, automations, documents and portal pages.">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setWizard(true)}><Copy className="h-4 w-4" />Import from another event</Button>
            <Button variant="outline" onClick={() => setGallery(true)}><LayoutTemplate className="h-4 w-4" />Add a built-in template</Button>
          </div>
        </SectionCard>
      ) : null}
      {ws.can.configure ? <Templates eventId={eventId} /> : null}
      {ws.can.configure ? <ApiSection eventId={eventId} ws={ws} /> : null}
      <ChangeLog eventId={eventId} data={ws.data} />
      <Trash eventId={eventId} ws={ws} />
      {ws.can.configure ? <DeleteWorkspace ws={ws} eventName={ws.data?.event?.name} /> : null}
      <CopyWizard open={wizard} onOpenChange={setWizard} eventId={eventId} ws={ws} />
      <TemplateGallery open={gallery} onOpenChange={setGallery} eventId={eventId} onInstalled={() => ws.reload()} />
      <ObjectSheet open={creating} onOpenChange={setCreating} data={ws.data} object={null} run={ws.run} onCreated={(object) => onOpenObject(object.id)} />
    </div>
  );
}
