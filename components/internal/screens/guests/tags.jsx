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
import { getUser } from "@/lib/supabase/user";
import { SEGMENT_COLOR_MAP, SEGMENT_COLOR_OPTIONS } from "./constants";

const EMPTY_DRAFT = { name: "", color: "slate", description: "" };

export function TagsScreen() {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [editing, setEditing] = useState(null);
  const [merging, setMerging] = useState(null);
  const [mergeInto, setMergeInto] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [userId, setUserId] = useState(null);
  const { projectId } = useProject();

  useEffect(() => {
    let alive = true;
    listTags(projectId).then((t) => {
      if (!alive) return;
      setTags(t ?? []);
      setLoading(false);
    });
    getUser().then((u) => alive && setUserId(u?.id || null));
    return () => {
      alive = false;
    };
  }, [projectId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tags;
    return tags.filter((t) => t.name.toLowerCase().includes(q));
  }, [tags, search]);

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
        <div />
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
