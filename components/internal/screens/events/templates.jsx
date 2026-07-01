"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Users,
  Music,
  GraduationCap,
  Video,
  Mic,
  PartyPopper,
  Sparkles,
  Plus,
  ArrowUpRight,
  MoreHorizontal,
  Pencil,
  Copy,
  Trash2,
  LayoutTemplate,
  Loader2,
} from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  EmptyState,
  Field,
  ScreenHeader,
  SearchInput,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  EVENT_TEMPLATES,
  TEMPLATE_CATEGORY_MAP,
  TEMPLATE_CATEGORY_OPTIONS,
  TEMPLATE_ICON_OPTIONS,
  newId,
} from "./sample_data";
import {
  listTemplates,
  createTemplate,
  updateTemplate,
  softDeleteTemplate,
  incrementTemplateUses,
} from "@/lib/supabase/templates";
import { createEvent } from "@/lib/supabase/events";
import { getUser } from "@/lib/supabase/user";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { useProject } from "@/context/project-context";

// Lucide name (stored as data on the template) → component. Falls back to a
// neutral icon so an unknown name never crashes the card.
const TEMPLATE_ICONS = {
  Users,
  Music,
  GraduationCap,
  Video,
  Mic,
  PartyPopper,
  Sparkles,
};

const FORMAT_OPTIONS = [
  { value: "In-person", label: "In-person" },
  { value: "Online", label: "Online" },
  { value: "Hybrid", label: "Hybrid" },
];

const VISIBILITY_OPTIONS = [
  { value: "Public", label: "Public" },
  { value: "Unlisted", label: "Unlisted" },
  { value: "Private", label: "Private" },
];

const EMPTY_DRAFT = {
  name: "",
  category: "Community",
  icon: "Users",
  description: "",
  type: "In-person",
  capacity: "",
  visibility: "Public",
};

// Flatten a template view model into the dialog's flat draft shape.
function templateToDraft(t) {
  return {
    name: t.name,
    category: t.category,
    icon: t.icon,
    description: t.description,
    type: t.blueprint?.type || "In-person",
    capacity: t.blueprint?.capacity ? String(t.blueprint.capacity) : "",
    visibility: t.blueprint?.visibility || "Public",
  };
}

function TemplateDialog({ open, onOpenChange, onSubmit, initial, mode }) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);

  // Re-seed the form whenever a different template is edited (or on create).
  const [seedKey, setSeedKey] = useState("");
  const key = `${mode}:${initial?.id || "new"}`;
  if (open && key !== seedKey) {
    setSeedKey(key);
    setDraft(initial ? templateToDraft(initial) : EMPTY_DRAFT);
  } else if (!open && seedKey !== "") {
    // Reset on close so the next open always re-seeds (even create→create).
    setSeedKey("");
  }

  const set = (k) => (value) => setDraft((d) => ({ ...d, [k]: value }));

  const submit = () => {
    if (!draft.name.trim()) {
      toast.error("Give your template a name first.");
      return;
    }
    onSubmit({
      name: draft.name.trim(),
      category: draft.category,
      icon: draft.icon,
      description: draft.description.trim(),
      blueprint: {
        type: draft.type,
        capacity: Number(draft.capacity) || 0,
        visibility: draft.visibility,
        timezone: initial?.blueprint?.timezone || "Europe/London",
        summary: initial?.blueprint?.summary || "",
      },
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-background">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Edit template" : "New template"}
          </DialogTitle>
          <DialogDescription>
            Save a starting point — its blueprint pre-fills format, capacity, and
            visibility every time you use it.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <Field label="Template name" htmlFor="tmpl-name">
            <Input
              id="tmpl-name"
              value={draft.name}
              onChange={(e) => set("name")(e.target.value)}
              placeholder="e.g. Monthly Community Meetup"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Category">
              <Select value={draft.category} onValueChange={set("category")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_CATEGORY_OPTIONS.slice(1).map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Icon">
              <Select value={draft.icon} onValueChange={set("icon")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_ICON_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Description">
            <Textarea
              rows={2}
              value={draft.description}
              onChange={(e) => set("description")(e.target.value)}
              placeholder="What's included in this template?"
            />
          </Field>

          <div className="rounded-lg border border-border bg-surface-subtle p-3">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
              Blueprint defaults
            </p>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Format">
                <Select value={draft.type} onValueChange={set("type")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMAT_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Capacity">
                <Input
                  type="number"
                  min={0}
                  value={draft.capacity}
                  onChange={(e) => set("capacity")(e.target.value)}
                  placeholder="e.g. 80"
                />
              </Field>
              <Field label="Visibility">
                <Select value={draft.visibility} onValueChange={set("visibility")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VISIBILITY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={submit}
          >
            {mode === "edit" ? "Save template" : "Create template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TemplatesScreen() {
  // Seed from bundled samples for an instant paint, then replace with the live
  // table. `source` decides whether mutations persist.
  const [templates, setTemplates] = useState(EVENT_TEMPLATES);
  const [source, setSource] = useState("sample");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [userId, setUserId] = useState(null);
  const { openEventInTab } = useWorkspaceUrl();
  const { projectId } = useProject();

  const usingDb = source === "db";

  useEffect(() => {
    let alive = true;
    listTemplates(projectId).then((rows) => {
      if (!alive) return;
      if (rows) {
        setTemplates(rows);
        setSource("db");
      }
      setLoading(false);
    });
    getUser().then((u) => alive && setUserId(u?.id || null));
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    return templates.filter((t) => {
      if (category !== "all" && t.category !== category) return false;
      if (search && !t.name.toLowerCase().includes(search.toLowerCase()))
        return false;
      return true;
    });
  }, [templates, search, category]);

  const persistCreate = (template) => {
    if (!usingDb) return;
    createTemplate(template).then((saved) => {
      if (!saved) toast.error("Couldn't save the template to the server.");
      else
        setTemplates((prev) =>
          prev.map((t) => (t.id === saved.id ? saved : t)),
        );
    });
  };

  const handleCreate = (input) => {
    const template = { id: newId(), uses: 0, createdBy: userId, projectId, ...input };
    setTemplates((prev) => [template, ...prev]);
    toast.success(`Template "${template.name}" saved.`);
    persistCreate(template);
  };

  const handleUpdate = (input) => {
    const id = editing.id;
    setTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...input } : t)),
    );
    toast.success("Template updated.");
    if (usingDb) {
      updateTemplate(id, input).then((saved) => {
        if (!saved) toast.error("Couldn't save your changes to the server.");
      });
    }
  };

  const handleDuplicate = (t) => {
    const copy = {
      ...t,
      id: newId(),
      name: `${t.name} (copy)`,
      uses: 0,
      createdBy: userId,
      projectId,
    };
    setTemplates((prev) => [copy, ...prev]);
    toast.success(`Duplicated "${t.name}".`);
    persistCreate(copy);
  };

  const handleDelete = (t) => {
    setTemplates((prev) => prev.filter((x) => x.id !== t.id));
    toast.success(`Deleted "${t.name}".`);
    if (usingDb) {
      softDeleteTemplate(t.id).then((ok) => {
        if (!ok) toast.error("Couldn't delete the template on the server.");
      });
    }
  };

  // Use = spin up a fresh draft event seeded from the blueprint, persist it,
  // then hand off to the event editor (in the All Events tab).
  const handleUse = (t) => {
    const bp = t.blueprint || {};
    const id = newId();
    const draftEvent = {
      id,
      name: t.name,
      status: "Draft",
      type: bp.type || "In-person",
      date: "2026-07-15",
      time: "18:00",
      venue: "TBD",
      address: "",
      city: "London",
      timezone: bp.timezone || "Europe/London",
      capacity: bp.capacity || 0,
      sold: 0,
      revenue: 0,
      visibility: bp.visibility || "Public",
      organizer: "Ava Mitchell",
      summary: bp.summary || "",
      coverUrl: "",
      gallery: [],
      seriesId: null,
      createdBy: userId,
      projectId,
    };

    // Optimistically bump the use counter.
    setTemplates((prev) =>
      prev.map((x) => (x.id === t.id ? { ...x, uses: (x.uses || 0) + 1 } : x)),
    );

    if (usingDb) {
      createEvent(draftEvent).then((saved) => {
        if (!saved) toast.error("Couldn't create the event on the server.");
      });
      incrementTemplateUses(t.id, t.uses);
    }

    toast.success(`Created a draft from "${t.name}".`);
    openEventInTab(id, "All Events");
  };

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (t) => {
    setEditing(t);
    setDialogOpen(true);
  };

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Templates"
        description="Reusable event setups — format, capacity, and visibility — so you launch a new event in minutes."
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={openCreate}
          >
            <Plus className="h-4 w-4" /> New template
          </Button>
        }
      />

      <Toolbar>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-9 w-44 bg-surface-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TEMPLATE_CATEGORY_OPTIONS.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search templates…"
          className="w-full sm:max-w-xs"
        />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading templates…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={LayoutTemplate}
            title={
              templates.length
                ? "No templates match your filters"
                : "No templates yet"
            }
            description={
              templates.length
                ? "Try clearing the search or category, or create a new template."
                : "Create your first template to launch new events in a couple of clicks."
            }
            action={
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={openCreate}
              >
                <Plus className="h-4 w-4" /> New template
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => {
            const Icon = TEMPLATE_ICONS[t.icon] || Sparkles;
            const cat = TEMPLATE_CATEGORY_MAP[t.category];
            return (
              <div
                key={t.id}
                className="group flex flex-col rounded-xl border border-border bg-surface-subtle p-5 transition-colors hover:border-border-strong"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface-card text-muted-foreground">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant={cat?.variant || "neutral"}>
                      {cat?.label || t.category}
                    </Badge>
                    <div onClick={(ev) => ev.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
                            aria-label={`Actions for ${t.name}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="border-border bg-surface-subtle text-foreground"
                        >
                          <DropdownMenuItem
                            className="focus:bg-surface-hover"
                            onClick={() => openEdit(t)}
                          >
                            <Pencil className="h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="focus:bg-surface-hover"
                            onClick={() => handleDuplicate(t)}
                          >
                            <Copy className="h-4 w-4" /> Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-surface-hover" />
                          <DropdownMenuItem
                            variant="destructive"
                            className="text-red-400 focus:bg-red-500/10 focus:text-red-400"
                            onClick={() => handleDelete(t)}
                          >
                            <Trash2 className="h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
                <h3 className="mt-4 text-base font-semibold text-foreground">
                  {t.name}
                </h3>
                <p className="mt-1 flex-1 text-sm text-text-secondary">
                  {t.description}
                </p>
                <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                  <span className="text-xs text-text-tertiary">
                    Used by {t.uses || 0} events
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
                    onClick={() => handleUse(t)}
                  >
                    Use <ArrowUpRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <TemplateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={editing ? handleUpdate : handleCreate}
        initial={editing}
        mode={editing ? "edit" : "create"}
      />
    </MainScreenWrapper>
  );
}

export default TemplatesScreen;
