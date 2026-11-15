"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle, ArrowDown, ArrowUp, Check, Copy, ExternalLink, Loader2, Monitor, MoreHorizontal, Settings2, Smartphone, Trash2, Users, X,
} from "lucide-react";
import {
  Button, Checkbox, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, IconPicker, Input, Label, LogoLoading, LucideIcon, Popover, PopoverContent,
  PopoverTrigger, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, ToggleGroup, ToggleGroupItem,
} from "@geiger/ui";
import { toast } from "sonner";
import { SegmentedTabs, Toolbar } from "@/components/internal/shared/screen_kit";
import { cn } from "@/lib/utils";
import { workspaceApi } from "@/lib/workspace/client";
import { BLOCK_KINDS, defaultBlockConfig } from "@/lib/workspace/portal/blocks.js";
import { toBlocks, toCanvas } from "@/lib/workspace/portal/pages.js";
import { FileViewer } from "@/components/workspace_portal/render/pdf_viewer";
import { PageView } from "@/components/workspace_portal/render/page_view";
import { PortalViewProvider } from "@/components/workspace_portal/render/portal_context";
import { RecordView } from "@/components/workspace_portal/render/record_view";
import { createPreviewAdapter } from "./adapters";
import { BlockInspector } from "./block_inspector";
import { addBlock, addRow, duplicateBlock, removeBlock } from "./body_ops";
import { EditCanvas, EditRows } from "./page_canvas";
import { portalUrl } from "./people_tab";
import { defaultAs, PreviewAs } from "./preview_controls";

const SAVE_ERRORS = ["invalid_block", "invalid_page", "invalid_input", "invalid_rule", "revision_conflict", "not_found"];
const draftOf = (page) => ({ title: page.title, slug: page.slug, icon: page.icon, layout: page.layout, audience: page.audience ?? {}, body: page.body ?? { rows: [], blocks: [] } });

function Palette({ onAdd }) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-0.5">
        <p className="text-sm font-semibold text-foreground">Add a block</p>
        <p className="text-xs text-text-secondary">Click a block on the page to change its settings.</p>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {Object.entries(BLOCK_KINDS).map(([kind, meta]) => (
          <button key={kind} type="button" onClick={() => onAdd(kind)} title={meta.hint}
            className="flex flex-col items-start gap-1.5 rounded-lg border border-border bg-surface-card p-2.5 text-left hover:border-foreground/30">
            <LucideIcon name={meta.icon} className="h-4 w-4 text-text-secondary" />
            <span className="text-sm font-medium text-foreground">{meta.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Who sees a page: everyone, chosen roles, the team, and whether it shows in the portal menu.
function Audience({ audience, roles, onChange }) {
  const set = (patch) => onChange({ ...audience, ...patch });
  const chosen = new Set(audience.roles ?? []);
  const summary = audience.public ? "Everyone" : chosen.size ? roles.filter((role) => chosen.has(role.id)).map((role) => role.name).join(", ") : audience.team ? "Only the team" : "Nobody yet";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("w-full justify-start font-normal",
          !audience.public && !chosen.size && !audience.team && "border-amber-500/40 text-amber-700 dark:text-amber-400")}>
          <Users /><span className="truncate">{summary}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3">
        <div className="grid gap-3">
          <label className="flex items-center justify-between gap-3 text-sm"><span>Everyone, without signing in</span><Switch checked={Boolean(audience.public)} onCheckedChange={(value) => set({ public: value })} /></label>
          {!audience.public ? (
            <div className="grid gap-1.5">
              <p className="text-xs text-text-tertiary">Or people with any of these roles</p>
              {roles.filter((role) => role.key !== "public").map((role) => (
                <label key={role.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={chosen.has(role.id)} onCheckedChange={(checked) => set({ roles: checked ? [...chosen, role.id] : [...chosen].filter((id) => id !== role.id) })} />
                  {role.name}
                </label>
              ))}
            </div>
          ) : null}
          <div className="grid gap-3 border-t border-border pt-3">
            <label className="flex items-center justify-between gap-3 text-sm"><span>Show in the portal menu</span><Switch checked={audience.nav !== false} onCheckedChange={(value) => set({ nav: value })} /></label>
            <label className="flex items-center justify-between gap-3 text-sm"><span className="grid"><span>Team page</span><span className="text-xs text-text-tertiary">Also in the dashboard sidebar</span></span>
              <Switch checked={Boolean(audience.team)} onCheckedChange={(value) => set({ team: value })} /></label>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function PageSettings({ open, onOpenChange, draft, page, eventId, onSave }) {
  const [title, setTitle] = useState(draft.title);
  const [slug, setSlug] = useState(draft.slug);
  const [icon, setIcon] = useState(draft.icon);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Page settings</DialogTitle>
          <DialogDescription>{page.kind === "record" ? "Record pages open from a list, at /r/<list>/<number>." : "The page's name, address and icon in the menu."}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5"><Label htmlFor="wp-page-title">Name</Label><Input id="wp-page-title" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          {page.kind === "page" ? (
            <div className="grid gap-1.5">
              <Label htmlFor="wp-page-slug">Address</Label>
              <div className="flex items-center gap-1.5">
                <span className="shrink-0 text-xs text-text-tertiary">…/workspace/</span>
                <Input id="wp-page-slug" maxLength={63} value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} />
              </div>
            </div>
          ) : null}
          <div className="grid gap-1.5"><Label>Icon</Label><IconPicker value={icon} onValueChange={setIcon} /></div>
          <p className="truncate text-xs text-text-tertiary">{portalUrl(eventId)}/{page.kind === "page" ? slug : "r/…"}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!title.trim()} onClick={() => { onSave({ title: title.trim(), slug, icon }); onOpenChange(false); }}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Picks the record a record page is previewed with.
function SampleRecord({ eventId, objectId, value, onChange }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    let alive = true;
    workspaceApi.records(eventId, objectId, { limit: 50 }).then(({ data }) => {
      if (!alive) return;
      const list = data?.rows ?? [];
      setRows(list);
      if (list[0]) onChange((current) => current ?? list[0].number);
    });
    return () => { alive = false; };
  }, [eventId, objectId, onChange]);
  if (!rows?.length) return null;
  return (
    <Select value={value ? String(value) : ""} onValueChange={(next) => onChange(Number(next))}>
      <SelectTrigger className="h-8 w-44"><SelectValue placeholder="Sample record" /></SelectTrigger>
      <SelectContent>{rows.map((row) => <SelectItem key={row.id} value={String(row.number)}>{row.title || `#${row.number}`}</SelectItem>)}</SelectContent>
    </Select>
  );
}

// One page in the builder: edit its blocks (autosaved to the draft) and see it with real data as a role or person.
export function PageEditor({ eventId, ws, portal, page, toolbar, movable, onMove, onDeleted, onReset }) {
  const { run, api, reload } = portal;
  const [draft, setDraft] = useState(() => draftOf(page));
  const [save, setSave] = useState({ state: "saved", error: null });
  const [selected, setSelected] = useState(null);
  const [mode, setMode] = useState("edit");
  const [device, setDevice] = useState("desktop");
  const [as, setAs] = useState(() => defaultAs(page, portal.roles));
  const [settings, setSettings] = useState(false);
  const [saved, setSaved] = useState(0);
  const [sample, setSample] = useState(null);
  const [view, setView] = useState({ key: null, data: null, error: null });
  const revision = useRef(page.revision);
  const queue = useRef(Promise.resolve());
  const pending = useRef(null);
  const object = page.kind === "record" ? ws.objects.find((item) => item.id === page.objectId) : null;

  // Saves the latest draft a moment after the last change; saves run one after another so revisions line up.
  useEffect(() => {
    if (!pending.current) return undefined;
    const timer = setTimeout(() => {
      const body = pending.current;
      pending.current = null;
      queue.current = queue.current.then(async () => {
        setSave({ state: "saving", error: null });
        const result = await run("page.save", { page: { id: page.id, ...body }, expectedRevision: revision.current }, { handle: SAVE_ERRORS });
        if (result.error) { setSave({ state: "error", error: result.error }); return; }
        revision.current = result.data.page.revision;
        setSave({ state: "saved", error: null });
        setSaved((n) => n + 1);
      });
    }, 900);
    return () => clearTimeout(timer);
  }, [draft, page.id, run]);

  const change = (patch) => {
    const next = { ...draft, ...patch };
    pending.current = next;
    setDraft(next);
    setSave((current) => (current.state === "saving" ? current : { state: "dirty", error: null }));
  };

  // Lists, the viewer and (on record pages) the sample record, as the chosen role or person sees them.
  const viewKey = JSON.stringify({ id: page.id, as, saved, sample, kind: page.kind });
  useEffect(() => {
    const request = JSON.parse(viewKey);
    if (request.kind === "record" && (!request.sample || !object)) return undefined;
    const controller = new AbortController();
    const body = request.kind === "record"
      ? { what: "record", objectKey: object.key, number: request.sample, as: request.as }
      : { what: "page", pageId: request.id, as: request.as };
    api.view(body, controller.signal).then(({ data, error }) => { if (!controller.signal.aborted) setView({ key: viewKey, data, error }); }).catch(() => {});
    return () => controller.abort();
  }, [api, viewKey, object]);

  const adapter = useMemo(() => createPreviewAdapter({
    eventId, as,
    onOpenRecord: () => toast("Records open on their own page in the portal."),
    onNavigate: () => toast("Buttons take people to that page in the portal."),
  }), [eventId, as]);

  const livePage = useMemo(() => ({ id: page.id, slug: draft.slug, title: draft.title, icon: draft.icon, kind: page.kind, objectId: page.objectId, layout: draft.layout, body: draft.body }),
    [page.id, page.kind, page.objectId, draft]);
  const selectedBlock = draft.body.blocks?.find((block) => block.id === selected) ?? null;
  const peopleId = portal.portal?.peopleObjectId ?? null;
  const ctx = {
    ws, eventId, page: { ...livePage, audience: draft.audience }, pages: portal.pages, peopleId, emailFieldId: portal.portal?.emailFieldId ?? null,
    timeZone: ws.data?.event?.timeZone ?? "UTC",
    tokens: { me: peopleId, record: page.kind === "record" ? page.objectId : null },
  };

  const add = (kind, where) => {
    let body = draft.body;
    if (!kind) { change({ body: addRow(body, where.widths) }); return; }
    const config = defaultBlockConfig(kind, { definition: ws.data, objectId: page.objectId, pageKind: page.kind });
    let target = where;
    if (!target && draft.layout === "blocks" && selectedBlock?.at) target = { row: selectedBlock.at.row, col: selectedBlock.at.col };
    const result = addBlock(body, kind, config, { layout: draft.layout, ...(target ?? {}) });
    body = result.body;
    change({ body });
    setSelected(result.id);
  };

  const switchLayout = (layout) => {
    if (layout === draft.layout) return;
    change({ layout, body: layout === "canvas" ? toCanvas(draft.body) : toBlocks(draft.body) });
  };

  const remove = async () => {
    const result = await run("page.delete", { pageId: page.id });
    if (!result.error) {
      toast.success(`Page “${page.title}” removed`, { action: { label: "Undo", onClick: () => run("page.restore", { pageId: page.id }, { success: "Restored" }) } });
      onDeleted?.();
    }
  };

  const fresh = view.key === viewKey;
  const data = view.data;
  const canvasProps = { page: livePage, selected, onSelect: setSelected, onBody: (body) => change({ body }), interactive: false, onAdd: add };
  const editing = mode === "edit" && !(draft.layout === "canvas" && device === "phone");

  let preview;
  if (page.kind === "record" && !sample) preview = <p className="py-16 text-center text-sm text-text-secondary">Add a record to {object?.plural ?? "this list"} to preview its page.</p>;
  else if (!data && !view.error) preview = <div className="flex justify-center py-20"><LogoLoading size={48} aria-label="Loading preview" /></div>;
  else if (view.error && fresh) {
    preview = <p className="py-16 text-center text-sm text-text-secondary">{view.error.code === "not_found" ? "This role or person can't open this record." : view.error.message}</p>;
  } else {
    const content = editing ? (draft.layout === "canvas" ? <EditCanvas {...canvasProps} /> : <EditRows {...canvasProps} />)
      : page.kind === "record" ? <RecordView /> : <PageView />;
    preview = (
      <PortalViewProvider api={adapter} mode="preview" eventId={eventId} timeZone={data.session?.event?.timeZone ?? ctx.timeZone} page={livePage} lists={data.lists}
        record={data.record ?? null} comments={data.comments ?? []} activity={data.activity ?? []} session={data.session ?? null} revision={saved}>
        <FileViewer api={adapter}>
          {page.kind === "page" && data.open === false ? (
            <p className="mb-4 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-foreground">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />This page isn&apos;t open to who you&apos;re previewing as.
            </p>
          ) : null}
          {content}
        </FileViewer>
      </PortalViewProvider>
    );
  }

  const blockMeta = selectedBlock ? BLOCK_KINDS[selectedBlock.kind] : null;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Toolbar className="sm:flex-wrap">
        {toolbar}
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto sm:justify-end">
          <span className="inline-flex items-center gap-1.5 text-xs text-text-tertiary">
            {save.state === "saving" ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving</> : save.state === "dirty" ? "Unsaved"
              : save.state === "error" ? <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400"><AlertCircle className="h-3.5 w-3.5" />Not saved</span>
                : <><Check className="h-3.5 w-3.5" />Saved to draft</>}
          </span>
          {page.kind === "record" && object ? <SampleRecord eventId={eventId} objectId={object.id} value={sample} onChange={setSample} /> : null}
          <PreviewAs portal={portal} value={as} onChange={setAs} allowTeam={Boolean(draft.audience?.team)} />
          <SegmentedTabs className="w-auto" value={mode} onChange={setMode} tabs={[{ label: "Edit", value: "edit" }, { label: "Try it", value: "preview" }]} />
          <ToggleGroup type="single" variant="outline" size="sm" value={device} onValueChange={(value) => value && setDevice(value)} aria-label="Preview width">
            <ToggleGroupItem value="desktop" aria-label="Desktop width"><Monitor /></ToggleGroupItem>
            <ToggleGroupItem value="phone" aria-label="Phone width"><Smartphone /></ToggleGroupItem>
          </ToggleGroup>
        </div>
      </Toolbar>

      {save.state === "error" ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
          <span className="min-w-0 flex-1 text-foreground">{save.error?.message}</span>
          {save.error?.code === "revision_conflict" ? <Button size="sm" variant="outline" onClick={async () => { await reload(); onReset?.(); }}>Reload</Button> : null}
        </div>
      ) : null}

      <div className="flex min-w-0 flex-col overflow-clip rounded-xl border border-border bg-background xl:flex-row">
        <div className="min-w-0 flex-1 bg-surface-subtle p-3 sm:p-5">
          <div className={cn("mx-auto min-w-0 rounded-lg border border-border bg-background p-4 sm:p-6", device === "phone" ? "max-w-[390px] p-3 sm:p-4" : "max-w-6xl")}>
            {page.kind === "page" && !editing ? <h1 className="mb-5 text-2xl font-semibold tracking-tight text-foreground">{draft.title}</h1> : null}
            {draft.layout === "canvas" && device === "phone" && mode === "edit" ? (
              <p className="mb-3 text-xs text-text-tertiary">On phones, canvas blocks stack top to bottom. Switch to desktop width to arrange them.</p>
            ) : null}
            {preview}
          </div>
        </div>
        <div className="w-full shrink-0 border-t border-border xl:w-72 xl:border-l xl:border-t-0">
          <aside className="xl:sticky xl:top-4 xl:max-h-[calc(100dvh-2rem)] xl:overflow-y-auto">
            {selectedBlock ? (
              <>
                <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface-card text-text-secondary">
                    <LucideIcon name={blockMeta?.icon || "square"} className="h-3.5 w-3.5" />
                  </span>
                  <span className="grid min-w-0 flex-1">
                    <span className="truncate text-sm font-semibold text-foreground">{blockMeta?.label ?? "Block"}</span>
                    {blockMeta?.hint ? <span className="truncate text-xs text-text-tertiary">{blockMeta.hint}</span> : null}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button size="icon-sm" variant="ghost" aria-label="Block options"><MoreHorizontal /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => { const next = duplicateBlock(draft.body, selectedBlock.id); change({ body: next.body }); setSelected(next.id); }}><Copy />Duplicate</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={() => { change({ body: removeBlock(draft.body, selectedBlock.id) }); setSelected(null); }}><Trash2 />Delete block</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button size="icon-sm" variant="ghost" aria-label="Back to page" onClick={() => setSelected(null)}><X /></Button>
                </div>
                <div className="p-4">
                  <BlockInspector key={selectedBlock.id} ctx={ctx} block={selectedBlock}
                    onChange={(next) => change({ body: { ...draft.body, blocks: draft.body.blocks.map((block) => (block.id === next.id ? next : block)) } })} />
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface-card text-text-secondary">
                    <LucideIcon name={draft.icon || "file"} className="h-3.5 w-3.5" />
                  </span>
                  <span className="grid min-w-0 flex-1">
                    <span className="truncate text-sm font-semibold text-foreground">{draft.title}</span>
                    <span className="truncate text-xs text-text-tertiary">{page.kind === "record" ? `Record page · ${object?.name ?? "list"}` : `/${draft.slug}`}</span>
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button size="icon-sm" variant="ghost" aria-label="Page options"><MoreHorizontal /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setSettings(true)}><Settings2 />Page settings</DropdownMenuItem>
                      {page.kind === "page" ? <DropdownMenuItem onSelect={() => window.open(`${portalUrl(eventId)}/${draft.slug}`, "_blank", "noopener")}><ExternalLink />Open live page</DropdownMenuItem> : null}
                      {movable ? (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem disabled={!movable.up} onSelect={() => onMove?.(-1)}><ArrowUp />Move up</DropdownMenuItem>
                          <DropdownMenuItem disabled={!movable.down} onSelect={() => onMove?.(1)}><ArrowDown />Move down</DropdownMenuItem>
                        </>
                      ) : null}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={remove}><Trash2 />{page.kind === "record" ? "Use the default record page" : "Delete page"}</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="grid gap-5 p-4">
                  {page.kind === "page" ? (
                    <div className="grid gap-1.5">
                      <p className="text-xs font-medium text-text-secondary">Who sees it</p>
                      <Audience audience={draft.audience} roles={portal.roles} onChange={(audience) => change({ audience })} />
                    </div>
                  ) : null}
                  <div className="grid gap-1.5">
                    <p className="text-xs font-medium text-text-secondary">Layout</p>
                    <SegmentedTabs fullWidth value={draft.layout} onChange={switchLayout} tabs={[{ label: "Blocks", value: "blocks" }, { label: "Canvas", value: "canvas" }]} />
                  </div>
                  <div className="border-t border-border pt-4">
                    <Palette onAdd={(kind) => add(kind, null)} />
                  </div>
                </div>
              </>
            )}
          </aside>
        </div>
      </div>

      <PageSettings key={settings ? "open" : "closed"} open={settings} onOpenChange={setSettings} draft={draft} page={page} eventId={eventId} onSave={(patch) => change(patch)} />
    </div>
  );
}
