"use client";

import { useState } from "react";
import { Archive, Layers3, LayoutGrid, Save } from "lucide-react";
import { Button, LogoLoading } from "@geiger/ui";
import { EditorSectionHeader } from "@/components/internal/shared/screen_kit";
import { ModuleEditor, NewModuleForm } from "./module_editor";
import { RecordsView } from "./records_view";
import { SetupPanel } from "./setup_panel";
import { useWorkspace } from "./use_workspace";

export function WorkspaceSection({ event, headerItem }) {
  const workspace = useWorkspace(event.id);
  const [tab, setTab] = useState("records");
  const [selectedKey, setSelectedKey] = useState(null);
  const draft = workspace.draft ?? [];
  const published = workspace.data?.modules ?? [];
  const pool = tab === "configure" ? draft : published;
  const effectiveKey = pool.some((item) => item.key === selectedKey) ? selectedKey : pool[0]?.key;

  if (workspace.loading && !workspace.data) {
    return <div className="flex items-center gap-3 py-12 text-sm text-muted-foreground"><LogoLoading size={36} />Loading event workspace…</div>;
  }

  const setup = (modules) => workspace.saveDraft(modules, 0);
  const save = () => workspace.saveDraft(draft, workspace.data.revision);
  const publish = async () => {
    const result = await workspace.publish(workspace.data.revision);
    if (!result.error) { await workspace.load(); setTab("records"); }
  };
  const archive = async (moduleKey) => {
    const result = await workspace.archiveModule(moduleKey, workspace.data.revision);
    if (!result.error) await workspace.load();
  };
  const updateModule = (definition) => workspace.setDraft(draft.map((item) =>
    item.key === definition.key ? definition : item));
  const removeModule = (moduleKey) => workspace.setDraft(draft.filter((item) => item.key !== moduleKey));
  const selectedDraft = draft.find((item) => item.key === effectiveKey);
  const selectedPublished = published.find((item) => item.key === effectiveKey);

  return <div className="space-y-6">
    <EditorSectionHeader title={headerItem?.label || "Operations workspace"}
      description={headerItem?.desc || "Private organiser modules for this event."} />
    {workspace.error ? <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
      {workspace.error.message ?? "Couldn't complete the request."}
      {workspace.error.code === "revision_conflict" ? <p className="mt-1 text-xs">Your unsaved edits remain here. Compare with the latest workspace before retrying.</p> : null}
    </div> : null}
    {!workspace.data ? <Button variant="outline" onClick={workspace.load}>Try again</Button>
      : workspace.data.revision === 0 ? <SetupPanel eventId={event.id} onSetup={setup} />
      : <>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-card p-4">
          <div className="flex items-center gap-3"><div className="rounded-lg bg-primary/10 p-2 text-primary"><Layers3 className="h-5 w-5" /></div>
            <div><p className="font-semibold text-foreground">Event workspace</p>
              <p className="text-xs text-muted-foreground">{workspace.data.status === "active" ? `Published version ${workspace.data.publishedVersion}` : "Draft setup"} · revision {workspace.data.revision}</p></div></div>
          <div className="flex gap-2"><Button variant={tab === "records" ? "secondary" : "ghost"} size="sm" onClick={() => setTab("records")}><LayoutGrid className="mr-1 h-4 w-4" /> Records</Button>
            <Button variant={tab === "configure" ? "secondary" : "ghost"} size="sm" onClick={() => setTab("configure")}><Archive className="mr-1 h-4 w-4" /> Configure</Button></div>
        </div>
        {tab === "configure" ? <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{workspace.dirty ? "Unsaved changes" : "Draft saved"} · {draft.length} modules</p>
            <div className="flex gap-2"><Button variant="outline" onClick={save} disabled={!workspace.dirty}><Save className="mr-1 h-4 w-4" /> Save draft</Button>
              <Button onClick={publish} disabled={workspace.dirty}>Publish workspace</Button></div>
          </div>
          <p className="text-xs text-muted-foreground">Save changes, then publish. Published versions and record history are kept for audit. Changes to populated fields may require a deliberate data migration.</p>
          <div className="flex flex-wrap gap-2">{draft.map((item) => <Button key={item.key} size="sm" variant={effectiveKey === item.key ? "secondary" : "outline"}
            onClick={() => setSelectedKey(item.key)}>{item.label}{item.enabled === false ? " · archived" : ""}</Button>)}</div>
          {selectedDraft ? <ModuleEditor key={selectedDraft.key} eventId={event.id} definition={selectedDraft} modules={draft}
            published={published.some((item) => item.key === selectedDraft.key)} dirty={workspace.dirty}
            onChange={updateModule} onRemove={() => removeModule(selectedDraft.key)} onArchive={() => archive(selectedDraft.key)} /> : null}
          <NewModuleForm modules={draft} onAdd={(definition) => { workspace.setDraft([...draft, definition]); setSelectedKey(definition.key); }} />
        </> : published.length ? <>
          <div className="flex flex-wrap gap-2">{published.map((item) =>
            <Button key={item.key} size="sm" variant={effectiveKey === item.key ? "secondary" : "outline"} onClick={() => setSelectedKey(item.key)}>{item.label}{item.enabled === false ? " · history" : ""}</Button>)}</div>
          {selectedPublished ? <RecordsView key={`${event.id}:${selectedPublished.key}`} eventId={event.id} definition={selectedPublished} /> : null}
        </> : <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No published modules yet. Configure your draft and publish it to start recording work.
        </div>}
      </>}
  </div>;
}
