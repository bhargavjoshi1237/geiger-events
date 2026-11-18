"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Copy, GripVertical, LayoutTemplate, Loader2, Plus, RotateCcw, Settings2, Trash2 } from "lucide-react";
import {
  Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, LoadingArea, SectionCard,
  SettingRow, SettingsList, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Textarea,
} from "@geiger/ui";
import { toast } from "sonner";
import { SegmentedTabs } from "@/components/internal/shared/screen_kit";
import { cn } from "@/lib/utils";
import { workspaceApi } from "@/lib/workspace/client";
import { formatDate, timeAgo } from "../state/format";
import { liveFieldsOf } from "../state/use_workspace";
import { ObjectIcon } from "../ws_ui";
import { PageBar, PageBody, WorkspacePage } from "../shell/page";
import { CopyWizard } from "../setup/copy_wizard";
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

function Lists({ ws, onOpenObject }) {
  const [dragging, setDragging] = useState(null);
  const objects = [...ws.objects].sort((a, b) => a.position - b.position);
  const counts = ws.data?.counts ?? {};
  const canReorder = Boolean(ws.can.configure);
  const drop = (targetId) => {
    if (!dragging || dragging === targetId) return;
    const order = objects.map((object) => object.id);
    order.splice(order.indexOf(dragging), 1);
    order.splice(order.indexOf(targetId), 0, dragging);
    ws.run("object.reorder", { order }, { quiet: true });
  };
  return (
    <SectionCard title="Lists" description={canReorder ? "Each list appears in the workspace sidebar. Drag to reorder." : "Each list appears in the workspace sidebar."} bodyPadding={false}>
      {objects.length ? (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 px-4" />
              <TableHead className="px-4">List</TableHead>
              <TableHead className="px-4">Prefix</TableHead>
              <TableHead className="px-4 text-right">Records</TableHead>
              <TableHead className="hidden px-4 text-right sm:table-cell">Fields</TableHead>
              <TableHead className="w-10 px-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {objects.map((object) => (
              <TableRow key={object.id} draggable={canReorder} onDragStart={() => setDragging(object.id)} onDragEnd={() => setDragging(null)}
                onDragOver={(event) => { if (dragging) event.preventDefault(); }} onDrop={() => { drop(object.id); setDragging(null); }}
                onClick={() => onOpenObject(object.id)} className={cn("cursor-pointer", dragging === object.id && "opacity-50")}>
                <TableCell className="px-4 py-3">{canReorder ? <GripVertical className="h-3.5 w-3.5 cursor-grab text-text-tertiary" /> : null}</TableCell>
                <TableCell className="px-4 py-3">
                  <span className="flex min-w-0 items-center gap-2.5 font-medium text-foreground"><ObjectIcon icon={object.icon} className="h-4 w-4 shrink-0 text-muted-foreground" /><span className="truncate">{object.plural}</span></span>
                </TableCell>
                <TableCell className="px-4 py-3 font-mono text-xs text-text-secondary">{object.numberPrefix}</TableCell>
                <TableCell className="px-4 py-3 text-right tabular-nums text-muted-foreground">{counts[object.id]?.toLocaleString() ?? "—"}</TableCell>
                <TableCell className="hidden px-4 py-3 text-right tabular-nums text-muted-foreground sm:table-cell">{liveFieldsOf(ws.data, object.id).length}</TableCell>
                <TableCell className="px-4 py-3 text-text-tertiary"><ChevronRight className="ml-auto h-3.5 w-3.5" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : <p className="p-5 text-sm text-text-secondary">No lists yet.</p>}
    </SectionCard>
  );
}

function ChangeLog({ eventId, data }) {
  const [kind, setKind] = useState("all");
  return (
    <SectionCard title="Change log" description="Everything changed in this workspace, newest first.">
      <div className="grid gap-3">
        <SegmentedTabs value={kind} onChange={setKind} className="w-auto justify-self-start" buttonClassName="h-7"
          tabs={[{ label: "Everything", value: "all" }, { label: "Structure", value: "structure" }, { label: "Records", value: "record" }]} />
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
        {rows === null ? <LoadingArea size={36} label="Loading changes" className="py-8" /> : rows.length ? (
          <ol className="grid divide-y divide-border">
            {rows.map((change) => (
              <li key={change.id} className="flex items-baseline justify-between gap-3 py-2.5 text-sm">
                <span className="min-w-0 text-foreground"><span className="font-medium">{change.actor}</span> <span className="text-muted-foreground">{describe(change, data)}</span>{change.undone ? <span className="text-text-tertiary"> (undone)</span> : null}</span>
                <span className="shrink-0 text-xs text-text-tertiary">{timeAgo(change.at)}</span>
              </li>
            ))}
          </ol>
        ) : <p className="text-sm text-text-secondary">No changes yet.</p>}
        {more ? <Button variant="outline" size="sm" className="justify-self-start" onClick={older}>Show older</Button> : null}
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
    ...trash.objects.map((object) => ({ id: object.id, kind: "List", label: object.plural, at: object.deletedAt, restore: () => restore("object.restore", { objectId: object.id }) })),
    ...trash.fields.map((field) => ({ id: field.id, kind: "Field", label: `${field.name} on ${objects.get(field.objectId)?.plural ?? "a list"}`, at: field.deletedAt, restore: () => restore("field.restore", { fieldId: field.id, objectId: field.objectId }) })),
    ...trash.records.map((record) => {
      const object = objects.get(record.objectId);
      return { id: record.id, kind: "Record", label: `${object?.name ?? "Record"} · ${record.label || `${object?.numberPrefix ?? "REC"}-${record.number}`}`, at: record.deletedAt, restore: object && !object.deletedAt ? () => restore("records.restore", { recordIds: [record.id] }) : null };
    }),
  ].sort((a, b) => new Date(b.at) - new Date(a.at)) : null;
  return (
    <SectionCard title="Trash" description="Deleted lists, fields and records stay here for 30 days, then they're removed for good.">
      {items === null ? <LoadingArea size={36} label="Loading trash" className="py-8" /> : items.length ? (
        <SettingsList>
          {items.map((item) => (
            <SettingRow key={item.id} title={item.label} description={`${item.kind} · ${daysLeft(item.at)} days left`}
              control={item.restore && ws.can.configure ? <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={item.restore}><RotateCcw className="h-3.5 w-3.5" />Restore</Button> : null} />
          ))}
        </SettingsList>
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
      action={<Button size="sm" variant="outline" onClick={() => setOpen(true)}><LayoutTemplate className="h-3.5 w-3.5" />Save as template</Button>}>
      {templates === null ? <LoadingArea size={36} label="Loading templates" className="py-8" /> : templates.length ? (
        <SettingsList>
          {templates.map((template) => (
            <SettingRow key={template.id} title={template.name} description={`${template.lists.join(", ")} · saved ${formatDate(template.updatedAt)}`}
              control={<Button size="icon-sm" variant="ghost" className="text-text-secondary" aria-label={`Delete ${template.name}`} onClick={() => remove(template.id)}><Trash2 className="h-3.5 w-3.5" /></Button>} />
          ))}
        </SettingsList>
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
    <SectionCard title={<span className="text-red-600 dark:text-red-400">Delete workspace</span>} description="Removes every list, record, file and view in this event's workspace. This can't be undone.">
      <Button variant="outline" size="sm" className="text-red-600 hover:text-red-600 dark:text-red-400" onClick={() => { setTyped(""); setOpen(true); }}>
        <Trash2 className="h-3.5 w-3.5" />Delete workspace
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

export function SettingsScreen({ eventId, ws, onOpenObject, onCreateList }) {
  const [wizard, setWizard] = useState(false);
  const [gallery, setGallery] = useState(false);
  return (
    <WorkspacePage>
      <PageBar icon={Settings2} title="Workspace settings" note="Lists, copying, templates, history and the trash"
        actions={ws.can.configure ? <Button size="sm" onClick={onCreateList}><Plus className="h-4 w-4" />New list</Button> : null} />
      <PageBody>
        <div className="mx-auto grid max-w-5xl gap-5 px-4 py-6 sm:px-6">
          <Lists ws={ws} onOpenObject={onOpenObject} />
          {ws.can.configure ? (
            <SectionCard title="Import from another event" description="Bring over lists, fields, views and records from an earlier event, or add a built-in template's lists, automations, documents and portal pages.">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setWizard(true)}><Copy className="h-3.5 w-3.5" />Import from another event</Button>
                <Button variant="outline" size="sm" onClick={() => setGallery(true)}><LayoutTemplate className="h-3.5 w-3.5" />Add a built-in template</Button>
              </div>
            </SectionCard>
          ) : null}
          {ws.can.configure ? <Templates eventId={eventId} /> : null}
          {ws.can.configure ? <ApiSection eventId={eventId} ws={ws} /> : null}
          <ChangeLog eventId={eventId} data={ws.data} />
          <Trash eventId={eventId} ws={ws} />
          {ws.can.configure ? <DeleteWorkspace ws={ws} eventName={ws.data?.event?.name} /> : null}
        </div>
      </PageBody>
      <CopyWizard open={wizard} onOpenChange={setWizard} eventId={eventId} ws={ws} />
      <TemplateGallery open={gallery} onOpenChange={setGallery} eventId={eventId} onInstalled={() => ws.reload()} />
    </WorkspacePage>
  );
}
