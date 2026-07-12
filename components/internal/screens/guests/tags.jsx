"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Merge,
  MoreHorizontal,
  Pencil,
  Plus,
  Tag as TagIcon,
  Trash2,
} from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  Field,
  ScreenHeader,
  SearchInput,
  StatsBar,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { cn } from "@/lib/utils";
import { useProject } from "@/context/project-context";
import {
  listTags,
  createTag,
  updateTag,
  renameTag,
  mergeTags,
  deleteTagEverywhere,
} from "@/lib/supabase/tags";
import { listContacts } from "@/lib/supabase/contacts";
import { getUser } from "@/lib/supabase/user";
import { SEGMENT_COLOR_MAP, SEGMENT_COLOR_OPTIONS, initials } from "./constants";

const TAG_SORT_OPTIONS = [
  { value: "count-desc", label: "Most used" },
  { value: "count-asc", label: "Least used" },
  { value: "name-asc", label: "Name (A–Z)" },
  { value: "name-desc", label: "Name (Z–A)" },
];

const EMPTY_DRAFT = { name: "", color: "slate", description: "" };

export function TagsScreen() {
  const [tags, setTags] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("count-desc");
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [editing, setEditing] = useState(null);
  const [merging, setMerging] = useState(null);
  const [mergeInto, setMergeInto] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [openTag, setOpenTag] = useState(null);
  const [userId, setUserId] = useState(null);
  const { projectId } = useProject();

  useEffect(() => {
    let alive = true;
    Promise.all([listTags(projectId), listContacts(projectId)]).then(
      ([t, cs]) => {
        if (!alive) return;
        setTags(t ?? []);
        setContacts(cs ?? []);
        setLoading(false);
      },
    );
    getUser().then((u) => alive && setUserId(u?.id || null));
    return () => {
      alive = false;
    };
  }, [projectId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? tags.filter((t) => t.name.toLowerCase().includes(q))
      : [...tags];
    const byName = (a, b) => a.name.localeCompare(b.name);
    list.sort((a, b) => {
      switch (sort) {
        case "count-asc":
          return a.count - b.count || byName(a, b);
        case "name-asc":
          return byName(a, b);
        case "name-desc":
          return byName(b, a);
        case "count-desc":
        default:
          return b.count - a.count || byName(a, b);
      }
    });
    return list;
  }, [tags, search, sort]);

  // Contacts carrying the tag currently open in the side sheet.
  const tagContacts = useMemo(() => {
    if (!openTag) return [];
    const name = openTag.name.toLowerCase();
    return contacts.filter((c) =>
      (c.tags || []).some((x) => String(x).toLowerCase() === name),
    );
  }, [openTag, contacts]);

  const stats = useMemo(() => {
    const applications = tags.reduce((sum, t) => sum + t.count, 0);
    const mostUsed = tags.reduce((max, t) => Math.max(max, t.count), 0);
    const unused = tags.filter((t) => t.count === 0).length;
    return [
      { label: "Tags", value: tags.length.toLocaleString() },
      { label: "Applications", value: applications.toLocaleString() },
      { label: "Most used", value: mostUsed.toLocaleString() },
      { label: "Unused", value: unused.toLocaleString() },
    ];
  }, [tags]);

  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const handleCreate = async () => {
    const name = draft.name.trim();
    if (!name) {
      toast.error("Give the tag a name.");
      return;
    }
    if (tags.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      toast.error("That tag already exists.");
      return;
    }
    const tag = {
      id: crypto.randomUUID(),
      projectId,
      name,
      color: draft.color,
      description: draft.description,
      count: 0,
      createdBy: userId,
    };
    setTags((prev) =>
      [...prev, tag].sort(
        (a, b) => b.count - a.count || a.name.localeCompare(b.name),
      ),
    );
    setCreateOpen(false);
    setDraft(EMPTY_DRAFT);
    toast.success("Tag created.");
    const saved = await createTag(tag);
    if (saved === null) toast.error("Couldn't save the tag.");
  };

  const handleEditSave = async () => {
    const oldName = editing._name;
    const name = editing.name.trim();
    if (!name) {
      toast.error("Give the tag a name.");
      return;
    }
    const renamed = name !== oldName;
    if (
      renamed &&
      tags.some((t) => t.name.toLowerCase() === name.toLowerCase())
    ) {
      toast.error("Another tag already uses that name.");
      return;
    }
    setTags((prev) =>
      prev.map((t) =>
        t.name === oldName
          ? { ...t, name, color: editing.color, description: editing.description }
          : t,
      ),
    );
    setOpenTag((o) =>
      o && o.name === oldName
        ? { ...o, name, color: editing.color, description: editing.description }
        : o,
    );
    setEditing(null);
    toast.success("Tag updated.");

    let ok = true;
    if (renamed) {
      ok = await renameTag(projectId, oldName, name, editing.id);
    }
    if (editing.id) {
      const res = await updateTag(editing.id, {
        name,
        color: editing.color,
        description: editing.description,
      });
      if (res === null) ok = false;
    } else {
      // No catalog row yet — create one so color/description persist.
      const res = await createTag({
        id: crypto.randomUUID(),
        projectId,
        name,
        color: editing.color,
        description: editing.description,
        createdBy: userId,
      });
      if (res === null) ok = false;
    }
    if (!ok) toast.error("Couldn't save every change.");
  };

  const handleMerge = async () => {
    const target = tags.find((t) => t.name === mergeInto);
    if (!target || target.name === merging.name) {
      toast.error("Pick a different tag to merge into.");
      return;
    }
    setTags((prev) =>
      prev
        .filter((t) => t.name !== merging.name)
        .map((t) =>
          t.name === target.name ? { ...t, count: t.count + merging.count } : t,
        ),
    );
    const source = merging;
    setMerging(null);
    setMergeInto("");
    setOpenTag((o) => (o && o.name === source.name ? null : o));
    toast.success(`Merged “${source.name}” into “${target.name}”.`);
    const ok = await mergeTags(
      projectId,
      [source.name],
      target.name,
      [source.id],
    );
    if (!ok) toast.error("Couldn't merge on the server.");
  };

  const handleDelete = async (tag) => {
    setTags((prev) => prev.filter((t) => t.name !== tag.name));
    setOpenTag((o) => (o && o.name === tag.name ? null : o));
    toast.success("Tag deleted.");
    const ok = await deleteTagEverywhere(projectId, tag.name, tag.id);
    if (!ok) toast.error("Couldn't delete on the server.");
  };

  const columns = [
    {
      key: "tag",
      header: "Tag",
      render: (t) => (
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "inline-block h-2.5 w-2.5 shrink-0 rounded-full border",
              SEGMENT_COLOR_MAP[t.color] || SEGMENT_COLOR_MAP.slate,
            )}
          />
          <span className="font-medium text-foreground">{t.name}</span>
        </div>
      ),
    },
    {
      key: "count",
      header: "Contacts",
      render: (t) => (
        <span className="text-sm text-foreground tabular-nums">
          {t.count.toLocaleString()}
        </span>
      ),
    },
    {
      key: "description",
      header: "Description",
      render: (t) => (
        <span className="text-sm text-text-secondary">
          {t.description || "—"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (t) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-text-secondary hover:text-foreground"
                aria-label="Tag actions"
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
                onClick={() =>
                  setEditing({
                    id: t.id,
                    _name: t.name,
                    name: t.name,
                    color: t.color,
                    description: t.description,
                  })
                }
              >
                <Pencil className="h-4 w-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="focus:bg-surface-hover"
                disabled={tags.length < 2}
                onClick={() => {
                  setMerging(t);
                  setMergeInto("");
                }}
              >
                <Merge className="h-4 w-4" /> Merge into…
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem
                className="text-red-400 focus:bg-red-500/10 focus:text-red-400"
                onClick={() => setDeleteTarget(t)}
              >
                <Trash2 className="h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Tags"
        description="The tag vocabulary across your contacts. Recolor, rename, merge duplicates, or retire a tag — changes apply to every contact."
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => {
              setDraft(EMPTY_DRAFT);
              setCreateOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> New tag
          </Button>
        }
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <FilterDropdown
          value={sort}
          onValueChange={setSort}
          options={TAG_SORT_OPTIONS}
          height="h-9"
        />
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search tags…"
          className="w-full sm:max-w-xs"
        />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading tags…
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(t) => t.name}
          onRowClick={(t) => setOpenTag(t)}
          empty={
            <EmptyState
              icon={TagIcon}
              title={search.trim() ? "No tags match" : "No tags yet"}
              description={
                search.trim()
                  ? "Try a different search."
                  : "Tag contacts from the Contact Book, or create a tag here to start organizing your audience."
              }
              action={
                search.trim() ? (
                  <Button
                    variant="outline"
                    className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                    onClick={() => setSearch("")}
                  >
                    Clear search
                  </Button>
                ) : (
                  <Button
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => {
                      setDraft(EMPTY_DRAFT);
                      setCreateOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4" /> New tag
                  </Button>
                )
              }
            />
          }
        />
      )}

      {/* Create */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New tag</DialogTitle>
            <DialogDescription>
              Create a reusable tag. Apply it to contacts from the Contact Book.
            </DialogDescription>
          </DialogHeader>
          <TagFields draft={draft} onChange={set} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleCreate}
            >
              Create tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit tag</DialogTitle>
            <DialogDescription>
              Renaming updates the tag on every contact that carries it.
            </DialogDescription>
          </DialogHeader>
          {editing ? (
            <TagFields
              draft={editing}
              onChange={(key) => (value) =>
                setEditing((e) => ({ ...e, [key]: value }))
              }
            />
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleEditSave}
            >
              Save tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge */}
      <Dialog open={!!merging} onOpenChange={(o) => !o && setMerging(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Merge tag</DialogTitle>
            <DialogDescription>
              Move every contact tagged{" "}
              <span className="font-medium text-foreground">
                {merging?.name}
              </span>{" "}
              onto another tag, then retire it.
            </DialogDescription>
          </DialogHeader>
          <Field label="Merge into">
            <Select value={mergeInto} onValueChange={setMergeInto}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a tag" />
              </SelectTrigger>
              <SelectContent>
                {tags
                  .filter((t) => t.name !== merging?.name)
                  .map((t) => (
                    <SelectItem key={t.name} value={t.name}>
                      {t.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMerging(null)}>
              Cancel
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleMerge}
            >
              <Merge className="h-4 w-4" /> Merge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete tag</DialogTitle>
            <DialogDescription>
              Remove{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.name}
              </span>{" "}
              from all {deleteTarget?.count?.toLocaleString()} contact
              {deleteTarget?.count === 1 ? "" : "s"}? The contacts themselves stay.
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

      {/* Tag detail sheet — opens from a row click. */}
      <Sheet open={!!openTag} onOpenChange={(o) => !o && setOpenTag(null)}>
        <SheetContent className="w-full gap-0 p-0 sm:max-w-md">
          {openTag ? (
            <div className="flex h-full flex-col">
              <SheetHeader className="border-b border-border">
                <div className="flex items-center gap-3 pr-8">
                  <span
                    className={cn(
                      "inline-block h-3 w-3 shrink-0 rounded-full border",
                      SEGMENT_COLOR_MAP[openTag.color] || SEGMENT_COLOR_MAP.slate,
                    )}
                  />
                  <div className="min-w-0">
                    <SheetTitle className="truncate">{openTag.name}</SheetTitle>
                    <SheetDescription>
                      {openTag.count.toLocaleString()}{" "}
                      {openTag.count === 1 ? "contact" : "contacts"}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="flex flex-wrap gap-2 border-b border-border p-4">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                  onClick={() =>
                    setEditing({
                      id: openTag.id,
                      _name: openTag.name,
                      name: openTag.name,
                      color: openTag.color,
                      description: openTag.description,
                    })
                  }
                >
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={tags.length < 2}
                  className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                  onClick={() => {
                    setMerging(openTag);
                    setMergeInto("");
                  }}
                >
                  <Merge className="h-4 w-4" /> Merge
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto text-red-300 hover:bg-red-500/10 hover:text-red-300"
                  onClick={() => setDeleteTarget(openTag)}
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              </div>

              {openTag.description ? (
                <div className="border-b border-border p-4">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">
                    Description
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    {openTag.description}
                  </p>
                </div>
              ) : null}

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-text-secondary">
                  Contacts
                </p>
                {tagContacts.length ? (
                  <div className="space-y-1.5">
                    {tagContacts.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center gap-3 rounded-lg border border-border bg-surface-card px-3 py-2"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface-subtle text-xs font-semibold text-foreground">
                          {initials(c.name, c.email) || "?"}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {c.name || "Unnamed"}
                          </p>
                          <p className="truncate text-xs text-text-secondary">
                            {c.email || "No email"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-text-tertiary">
                    No contacts carry this tag yet.
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </MainScreenWrapper>
  );
}

function TagFields({ draft, onChange }) {
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-[1fr_auto] gap-4">
        <Field label="Name" htmlFor="tag-name">
          <Input
            id="tag-name"
            value={draft.name}
            onChange={(e) => onChange("name")(e.target.value)}
            placeholder="e.g. VIP"
          />
        </Field>
        <Field label="Color">
          <Select value={draft.color} onValueChange={onChange("color")}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SEGMENT_COLOR_OPTIONS.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Field label="Description">
        <Input
          value={draft.description}
          onChange={(e) => onChange("description")(e.target.value)}
          placeholder="Optional"
        />
      </Field>
    </div>
  );
}

export default TagsScreen;
