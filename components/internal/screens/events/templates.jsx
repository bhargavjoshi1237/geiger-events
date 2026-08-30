"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Sparkles,
  Plus,
  ArrowUpRight,
  Check,
  Pencil,
  Copy,
  Trash2,
  LayoutTemplate,
  Loader2,
  X,
} from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  EmptyState,
  Field,
  ScreenHeader,
  SearchInput,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { Input } from "@geiger/ui/input";
import { Textarea } from "@geiger/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import { IconPicker, LucideIcon } from "@geiger/ui/icon-picker";
import { ActionMenu } from "@geiger/ui/action-menu";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import {
  EVENT_TEMPLATES,
  TEMPLATE_CATEGORY_MAP,
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
import { useDefaultOrganizer } from "@/lib/events/use-default-organizer";

// Sentinel value for the "add a category" row inside the category Select.
const NEW_CATEGORY = "__new_category__";

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

function TemplateDialog({
  open,
  onOpenChange,
  onSubmit,
  initial,
  mode,
  categories,
}) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  // null while picking from the list; a string once the user is typing a new one.
  const [newCategory, setNewCategory] = useState(null);

  const [seedKey, setSeedKey] = useState("");
  const key = `${mode}:${initial?.id || "new"}`;
  if (open && key !== seedKey) {
    setSeedKey(key);
    setDraft(initial ? templateToDraft(initial) : EMPTY_DRAFT);
    setNewCategory(null);
  } else if (!open && seedKey !== "") {
    setSeedKey("");
  }

  const set = (k) => (value) => setDraft((d) => ({ ...d, [k]: value }));

  // A category the user just invented isn't on any template yet, so fold the
  // current draft value in to keep the Select able to show it.
  const categoryChoices = useMemo(() => {
    const all = new Set(categories);
    if (draft.category) all.add(draft.category);
    return [...all];
  }, [categories, draft.category]);

  const commitCategory = () => {
    const name = newCategory.trim();
    if (name) set("category")(name);
    setNewCategory(null);
  };

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
              {newCategory === null ? (
                <Select
                  value={draft.category}
                  onValueChange={(value) =>
                    value === NEW_CATEGORY
                      ? setNewCategory("")
                      : set("category")(value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryChoices.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                    <SelectSeparator />
                    <SelectItem value={NEW_CATEGORY}>
                      <Plus className="h-4 w-4" /> Add category…
                    </SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex items-center gap-1">
                  <Input
                    autoFocus
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitCategory();
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        setNewCategory(null);
                      }
                    }}
                    placeholder="e.g. Workshop"
                    aria-label="New category name"
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Add category"
                    className="shrink-0 text-muted-foreground hover:bg-surface-active hover:text-foreground"
                    onClick={commitCategory}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Cancel new category"
                    className="shrink-0 text-muted-foreground hover:bg-surface-active hover:text-foreground"
                    onClick={() => setNewCategory(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </Field>
            <Field label="Icon" htmlFor="tmpl-icon">
              <IconPicker
                id="tmpl-icon"
                value={draft.icon}
                onValueChange={set("icon")}
                placeholder="Pick an icon"
              />
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
          <Field label="Blueprint defaults">
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
          </Field>
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
  const [templates, setTemplates] = useState(EVENT_TEMPLATES);
  const [source, setSource] = useState("sample");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [userId, setUserId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const { openEventInTab } = useWorkspaceUrl();
  const { projectId } = useProject();
  const defaultOrganizer = useDefaultOrganizer();

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

  // The built-in categories plus any the user has added on a template.
  const categories = useMemo(() => {
    const all = new Set(Object.keys(TEMPLATE_CATEGORY_MAP));
    templates.forEach((t) => t.category && all.add(t.category));
    return [...all];
  }, [templates]);

  const categoryOptions = useMemo(
    () => [
      { value: "all", label: "All categories" },
      ...categories.map((c) => ({ value: c, label: c })),
    ],
    [categories],
  );

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
      organizer: defaultOrganizer,
      summary: bp.summary || "",
      coverUrl: "",
      gallery: [],
      seriesId: null,
      createdBy: userId,
      projectId,
    };

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
        <FilterDropdown
          value={category}
          onValueChange={setCategory}
          options={categoryOptions}
          height="h-9"
        />
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search templates…"
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
            const cat = TEMPLATE_CATEGORY_MAP[t.category];
            return (
              <div
                key={t.id}
                className="group flex flex-col rounded-xl border border-border bg-surface-subtle p-5 transition-colors hover:border-border-strong"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface-card text-muted-foreground">
                    <LucideIcon
                      name={t.icon}
                      fallback={Sparkles}
                      className="h-5 w-5"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant={cat?.variant || "neutral"}>
                      {cat?.label || t.category}
                    </Badge>
                    <ActionMenu
                      label={`Actions for ${t.name}`}
                      items={[
                        { icon: Pencil, label: "Edit", onSelect: () => openEdit(t) },
                        { icon: Copy, label: "Duplicate", onSelect: () => handleDuplicate(t) },
                        { separator: true },
                        {
                          icon: Trash2,
                          label: "Delete",
                          variant: "destructive",
                          onSelect: () => setDeleteTarget(t),
                        },
                      ]}
                    />
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
        categories={categories}
      />

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.name}
              </span>
              ? This action can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              className="bg-red-500/90 text-white hover:bg-red-500"
              onClick={() => {
                handleDelete(deleteTarget);
                setDeleteTarget(null);
              }}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainScreenWrapper>
  );
}

export default TemplatesScreen;
