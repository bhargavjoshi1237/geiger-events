"use client";

import { useState } from "react";
import { Check, ChevronDown, FileText, Loader2, Plus } from "lucide-react";
import {
  Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger, Input, Label, LucideIcon, Separator,
} from "@geiger/ui";
import { EmptyState } from "@/components/internal/shared/screen_kit";
import { slugifyPage } from "@/lib/workspace/portal/pages.js";
import { ObjectIcon } from "../ws_ui";
import { PageBody, PageToolbar } from "../shell/page";
import { PageEditor } from "./page_editor";

function NewPage({ open, onOpenChange, portal, onCreated }) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const create = async () => {
    setBusy(true);
    const taken = new Set(portal.pages.map((page) => page.slug));
    let slug = slugifyPage(title);
    for (let n = 2; taken.has(slug) || ["r", "sign-in", "invite", "api", "account"].includes(slug); n++) slug = `${slugifyPage(title)}-${n}`;
    const result = await portal.run("page.save", {
      page: { title: title.trim(), slug, icon: "file", kind: "page", layout: "blocks", audience: { roles: [], public: false, team: false, nav: true }, body: { rows: [], blocks: [] } },
    }, { success: "Page added" });
    setBusy(false);
    if (!result.error) { onCreated(result.data.page.id); onOpenChange(false); setTitle(""); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New page</DialogTitle>
          <DialogDescription>Start empty, then add blocks. You choose who sees it afterwards.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="wp-new-page">Name</Label>
          <Input id="wp-new-page" autoFocus maxLength={80} value={title} placeholder="My reviews" onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter" && title.trim()) create(); }} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={create} disabled={busy || !title.trim()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Create page</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function audienceLine(page, roles) {
  const audience = page.audience ?? {};
  if (audience.public) return "Everyone";
  const names = roles.filter((role) => (audience.roles ?? []).includes(role.id)).map((role) => role.name);
  if (names.length) return names.join(", ");
  return audience.team ? "Team only" : "Nobody yet";
}

// The page switcher sits on the toolbar beside the portal tabs; the selected page's editor fills the space below.
export function PagesTab({ eventId, ws, portal, pageId, onPageChange, tabs }) {
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(null);
  const [reset, setReset] = useState(0);
  const pages = portal.pages.filter((page) => page.kind === "page");
  const recordPages = new Map(portal.pages.filter((page) => page.kind === "record").map((page) => [page.objectId, page]));
  const current = portal.pages.find((page) => page.id === pageId) ?? pages[0] ?? null;
  const index = current?.kind === "page" ? pages.findIndex((page) => page.id === current.id) : -1;

  const move = (page, direction) => {
    const order = portal.pages.map((item) => item.id);
    const index = order.indexOf(page.id);
    const list = pages.map((item) => item.id);
    const target = list[list.indexOf(page.id) + direction];
    if (!target) return;
    const other = order.indexOf(target);
    [order[index], order[other]] = [order[other], order[index]];
    portal.run("page.reorder", { order });
  };

  const customise = async (object) => {
    setBusy(object.id);
    const { data, error } = await portal.api.view({ what: "default_record_page", objectId: object.id });
    if (error) { setBusy(null); return; }
    const result = await portal.run("page.save", { page: { kind: "record", objectId: object.id, title: object.name, icon: object.icon, layout: "blocks", audience: {}, body: data.body } },
      { success: "Record page added" });
    setBusy(null);
    if (!result.error) onPageChange(result.data.page.id);
  };

  const leading = (
    <div className="flex shrink-0 items-center gap-2">
      {tabs}
      <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-5" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="max-w-56 bg-surface-card font-normal" aria-label="Switch page">
            <LucideIcon name={current?.icon || "file"} className="text-text-secondary" />
            <span className="truncate">{current?.title ?? "No pages yet"}</span>
            <ChevronDown className="text-text-tertiary" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          <DropdownMenuLabel className="text-xs text-text-secondary">Pages</DropdownMenuLabel>
          {pages.map((page) => (
            <DropdownMenuItem key={page.id} onSelect={() => onPageChange(page.id)}>
              <LucideIcon name={page.icon || "file"} />
              <span className="grid min-w-0 flex-1">
                <span className="truncate">{page.title}</span>
                <span className="truncate text-xs text-text-tertiary">{audienceLine(page, portal.roles)}</span>
              </span>
              {current?.id === page.id ? <Check className="text-foreground" /> : null}
            </DropdownMenuItem>
          ))}
          {!pages.length ? <p className="px-2 py-1.5 text-sm text-text-secondary">No pages yet.</p> : null}
          <DropdownMenuItem onSelect={() => setCreating(true)}><Plus />New page</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs text-text-secondary">Record pages</DropdownMenuLabel>
          {ws.objects.map((object) => {
            const page = recordPages.get(object.id);
            return page ? (
              <DropdownMenuItem key={object.id} onSelect={() => onPageChange(page.id)}>
                <ObjectIcon icon={object.icon} /><span className="min-w-0 flex-1 truncate">{object.name}</span>
                {current?.id === page.id ? <Check className="text-foreground" /> : null}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem key={object.id} disabled={busy === object.id} onSelect={() => customise(object)}>
                <ObjectIcon icon={object.icon} /><span className="min-w-0 flex-1 truncate text-text-secondary">{object.name}</span>
                <DropdownMenuShortcut className="tracking-normal">{busy === object.id ? <Loader2 className="animate-spin" /> : "Customise"}</DropdownMenuShortcut>
              </DropdownMenuItem>
            );
          })}
          <p className="px-2 pb-1.5 pt-1 text-xs text-text-tertiary">Lists without one use a page with every field the viewer may see.</p>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <>
      {current ? (
        <PageEditor key={`${current.id}:${reset}`} eventId={eventId} ws={ws} portal={portal} page={current} toolbar={leading}
          movable={index >= 0 ? { up: index > 0, down: index < pages.length - 1 } : null} onMove={(direction) => move(current, direction)}
          onDeleted={() => onPageChange(null)} onReset={() => setReset((n) => n + 1)} />
      ) : (
        <>
          <PageToolbar>{leading}</PageToolbar>
          <PageBody className="flex items-center justify-center">
            <EmptyState icon={FileText} title="Add your first page" description="A home page, a form people fill in, a list of their reviews — each page is made of blocks."
              action={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" />New page</Button>} />
          </PageBody>
        </>
      )}
      <NewPage open={creating} onOpenChange={setCreating} portal={portal} onCreated={onPageChange} />
    </>
  );
}
