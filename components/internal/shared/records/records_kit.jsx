"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  MoreHorizontal,
  Pencil,
  Copy,
  Plus,
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
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  cn,
} from "@geiger/ui";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { useWorkspaceUrl, DEFAULT_SECTION } from "@/lib/hooks/use-workspace-url";
import { useProject } from "@/context/project-context";
import { getUser } from "@/lib/supabase/user";
import { FieldControl, FieldSection, readField, fieldPatch } from "./record_fields";

const emptyDraft = (mod) => ({
  name: "",
  status: mod.defaults.status,
  coverUrl: "",
  startsAt: "",
  endsAt: "",
  config: { ...mod.defaults.config },
});

async function fetchPresence(ids) {
  if (!ids.length) return {};
  try {
    const res = await fetch(`/api/live/stats/bulk?roomIds=${ids.join(",")}`);
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

function CreateRecordDialog({ mod, projectId, open, onOpenChange, onCreate }) {
  const [draft, setDraft] = useState(() => emptyDraft(mod));
  const Icon = mod.icon;
  const values = { ...draft, projectId, deferUploads: true };
  const RICH_TYPES = new Set(["audience", "access", "image"]);
  const basicFields = mod.createFields.filter((f) => !RICH_TYPES.has(f.type));
  const richFields = mod.createFields.filter((f) => RICH_TYPES.has(f.type));

  const onFieldValue = (field) => (val) =>
    setDraft((d) => ({ ...d, ...fieldPatch(field, d, val) }));

  const close = (o) => {
    if (!o) {
      if (draft.coverUrl?.preview) URL.revokeObjectURL(draft.coverUrl.preview);
      setDraft(emptyDraft(mod));
    }
    onOpenChange(o);
  };

  const submit = () => {
    if (!draft.name.trim()) {
      toast.error(`Give your ${mod.singular.toLowerCase()} a name first.`);
      return;
    }
    onCreate(draft);
    setDraft(emptyDraft(mod));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden bg-background p-0">
        <DialogHeader className="flex-row items-center gap-3 space-y-0 border-b border-border p-5 text-left">
          {Icon ? (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-subtle text-foreground">
              <Icon className="h-5 w-5" />
            </div>
          ) : null}
          <div className="min-w-0 space-y-0.5">
            <DialogTitle className="text-base">{mod.createLabel}</DialogTitle>
            <DialogDescription className="text-xs">
              Set the essentials now — you can fill in the rest in the editor.
            </DialogDescription>
          </div>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="max-h-[60vh] overflow-y-auto">
            {basicFields.length ? (
              <div className="grid gap-4 p-5">
                {basicFields.map((field) => (
                  <Field key={field.key} label={field.label} hint={field.hint}>
                    <FieldControl
                      field={field}
                      value={readField(field, draft)}
                      values={values}
                      onValue={onFieldValue(field)}
                    />
                  </Field>
                ))}
              </div>
            ) : null}

            {richFields.map((field) => (
              <div
                key={field.key}
                className="space-y-3 border-t border-border bg-surface-subtle/30 p-5"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{field.label}</p>
                  {field.hint ? (
                    <p className="mt-0.5 text-xs text-text-secondary">{field.hint}</p>
                  ) : null}
                </div>
                <FieldControl
                  field={field}
                  value={readField(field, draft)}
                  values={values}
                  onValue={onFieldValue(field)}
                />
              </div>
            ))}
          </div>

          <DialogFooter className="border-t border-border bg-surface-subtle/40 px-5 py-4">
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={() => close(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> {mod.createLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RecordDetail({ mod, record, onBack, onUpdate, onDelete }) {
  const { section: rawSection, setSection } = useWorkspaceUrl();
  const [form, setForm] = useState(record);
  const [seedId, setSeedId] = useState(record?.id);
  const [saving, setSaving] = useState(false);
  if (record && record.id !== seedId) {
    setSeedId(record.id);
    setForm(record);
  }

  const isRich = mod.detail.depth === "rich";
  const Hero = mod.detail.hero || null;
  const heroOwnsTitle = Boolean(Hero) && mod.detail.heroOwnsTitle !== false;
  const TitleBadges = mod.detail.titleBadges || null;
  const nav = useMemo(() => (isRich ? mod.detail.nav : []), [isRich, mod]);
  const active = isRich
    ? nav.some((i) => i.key === rawSection)
      ? rawSection
      : nav[0].key
    : DEFAULT_SECTION;
  const activeItem = useMemo(
    () => (isRich ? nav.find((i) => i.key === active) || nav[0] : null),
    [isRich, nav, active],
  );

  const isDirty = useMemo(() => {
    try {
      return JSON.stringify(form) !== JSON.stringify(record);
    } catch {
      return true;
    }
  }, [form, record]);

  if (!record) return null;

  const patch = (partial) => setForm((f) => ({ ...f, ...partial }));
  const commit = (partial) => {
    const next = { ...form, ...partial };
    setForm(next);
    onUpdate?.(next);
  };
  const save = async () => {
    if (!isDirty || saving) return;
    setSaving(true);
    try {
      await onUpdate?.(form);
      toast.success("Changes saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <MainScreenWrapper>
      <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {mod.title}
          </button>
          {!heroOwnsTitle ? (
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                {form.name || `Untitled ${mod.singular.toLowerCase()}`}
              </h1>
              {mod.statusMap ? (
                <StatusPill status={form.status} map={mod.statusMap} />
              ) : null}
              {TitleBadges ? <TitleBadges record={form} /> : null}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            variant="outline"
            className="border-border bg-transparent text-red-300 hover:bg-red-500/10 hover:text-red-300"
            onClick={() => onDelete?.(record)}
          >
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={!isDirty || saving}
            onClick={save}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save Changes
          </Button>
        </div>
      </div>

      {Hero ? <Hero record={form} commit={commit} /> : null}

      {isRich ? (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_260px]">
          <div className="order-2 min-w-0 lg:order-1">
            <div className="mb-5">
              <h2 className="text-lg font-semibold capitalize text-white">
                {activeItem.label}
              </h2>
              <p className="mt-0.5 text-sm text-text-secondary">{activeItem.desc}</p>
            </div>
            {activeItem.render ? (
              activeItem.render({ record: form, patch, commit })
            ) : (
              <FieldSection fields={activeItem.fields} values={form} onPatch={patch} bare />
            )}
          </div>

          <aside className="order-1 lg:order-2">
            <nav className="space-y-0.5 lg:sticky lg:top-0">
              {nav.map((item) => {
                const Icon = item.icon;
                const isActive = active === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setSection(item.key)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                      isActive
                        ? "bg-surface-card font-medium text-white"
                        : "text-muted-foreground hover:bg-surface-subtle hover:text-foreground",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        isActive ? "text-white" : "text-text-secondary",
                      )}
                    />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      ) : (
        <div className="w-full max-w-3xl space-y-10 pt-2">
          {mod.detail.panels.map((panel) => (
            <FieldSection
              key={panel.title}
              bare
              title={panel.title}
              description={panel.description}
              fields={panel.fields}
              values={form}
              onPatch={patch}
            />
          ))}
        </div>
      )}
    </MainScreenWrapper>
  );
}

export function RecordsScreen({ mod, api }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(() =>
    Object.fromEntries(mod.filters.map((f) => [f.key, "all"])),
  );
  const [sorts, setSorts] = useState(() =>
    Object.fromEntries((mod.sorts || []).map((s) => [s.key, "none"])),
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const { recordId, openRecord, closeRecord } = useWorkspaceUrl();
  const { projectId } = useProject();
  const [userId, setUserId] = useState(null);
  const [presence, setPresence] = useState({});

  const selectedRecord = useMemo(
    () => (recordId ? records.find((r) => r.id === recordId) || null : null),
    [recordId, records],
  );

  useEffect(() => {
    let alive = true;
    api.list(projectId, mod.key).then((rows) => {
      if (!alive) return;
      setRecords(rows ?? []);
      setLoading(false);
      if (!mod.usesPresence) return;
      fetchPresence((rows ?? []).map((r) => r.id)).then((p) => alive && setPresence(p));
    });
    getUser().then((u) => alive && setUserId(u?.id || null));
    return () => {
      alive = false;
    };
  }, [projectId, api, mod.key, mod.usesPresence]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((r) => {
      for (const f of mod.filters) {
        const val = filters[f.key];
        if (val && val !== "all" && f.get(r) !== val) return false;
      }
      if (q && !mod.search(r).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [records, search, filters, mod]);

  const stats = useMemo(() => mod.stats(records, { presence }), [records, mod, presence]);

  const sorted = useMemo(() => {
    let list = filtered;
    for (const s of mod.sorts || []) {
      const dir = sorts[s.key];
      if (dir !== "asc" && dir !== "desc") continue;
      list = [...list].sort((a, b) => {
        const diff = (Number(s.get(a)) || 0) - (Number(s.get(b)) || 0);
        return dir === "asc" ? diff : -diff;
      });
    }
    return list;
  }, [filtered, sorts, mod]);

  const rows = useMemo(
    () =>
      mod.usesPresence
        ? sorted.map((r) => ({ ...r, _presence: presence[r.id] || null }))
        : sorted,
    [sorted, presence, mod],
  );

  const persistCreate = (record, pending) => {
    api.create(record).then(async (saved) => {
      if (!saved) {
        toast.error("Couldn't save to the server.");
        return;
      }
      let next = saved;
      if (pending) {
        const res = await pending.upload(saved.id, pending.file);
        URL.revokeObjectURL(pending.preview);
        if (res?.url) {
          next = { ...saved, coverUrl: res.url };
          api.update(saved.id, { coverUrl: res.url });
        } else {
          toast.error("Saved, but the image couldn't be uploaded.");
        }
      }
      setRecords((prev) => prev.map((r) => (r.id === next.id ? next : r)));
    });
  };

  const handleCreate = (draft) => {
    const imageField = mod.createFields.find((f) => f.type === "image");
    const pending =
      draft.coverUrl?.file && imageField?.upload
        ? { ...draft.coverUrl, upload: imageField.upload }
        : null;
    const record = {
      id: crypto.randomUUID(),
      module: mod.key,
      name: draft.name.trim(),
      status: draft.status,
      coverUrl: pending ? pending.preview : draft.coverUrl || "",
      startsAt: draft.startsAt || null,
      endsAt: draft.endsAt || null,
      config: draft.config,
      createdBy: userId,
      projectId,
    };
    setRecords((prev) => [record, ...prev]);
    toast.success(`"${record.name}" added.`);
    persistCreate({ ...record, coverUrl: pending ? "" : record.coverUrl }, pending);
  };

  const handleUpdate = (updated) => {
    setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    return api
      .update(updated.id, {
        name: updated.name,
        status: updated.status,
        coverUrl: updated.coverUrl,
        startsAt: updated.startsAt ?? "",
        endsAt: updated.endsAt ?? "",
        config: updated.config,
      })
      .then((saved) => {
        if (!saved) toast.error("Couldn't save your changes to the server.");
        return saved;
      });
  };

  const handleDelete = (record) => {
    setDeleteTarget(null);
    setRecords((prev) => prev.filter((r) => r.id !== record.id));
    toast.success(`Deleted "${record.name}".`);
    api.remove(record.id).then((ok) => {
      if (!ok) toast.error("Couldn't delete on the server.");
    });
    if (record.id === selectedRecord?.id) closeRecord();
  };

  const handleDuplicate = (record) => {
    const copy = {
      ...record,
      id: crypto.randomUUID(),
      name: `${record.name} (copy)`,
      coverUrl: "",
      createdBy: userId,
      projectId,
    };
    setRecords((prev) => [copy, ...prev]);
    toast.success(`Duplicated "${record.name}".`);
    persistCreate(copy);
  };

  const columns = [
    ...mod.columns,
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (r) => (
        <div onClick={(ev) => ev.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Actions for ${r.name}`}
                className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-44 border-border bg-surface-card shadow-xl"
            >
              <DropdownMenuItem
                className="cursor-pointer gap-2 text-muted-foreground focus:bg-surface-hover focus:text-foreground"
                onClick={() => openRecord(r.id)}
              >
                <Pencil className="h-4 w-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer gap-2 text-muted-foreground focus:bg-surface-hover focus:text-foreground"
                onClick={() => handleDuplicate(r)}
              >
                <Copy className="h-4 w-4" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-surface-strong" />
              <DropdownMenuItem
                className="cursor-pointer gap-2 text-red-300 focus:bg-red-500/10 focus:text-red-300"
                onClick={() => setDeleteTarget(r)}
              >
                <Trash2 className="h-4 w-4 text-red-300" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  const deleteDialog = (
    <Dialog
      open={!!deleteTarget}
      onOpenChange={(open) => !open && setDeleteTarget(null)}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete {mod.singular.toLowerCase()}</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete{" "}
            <span className="font-medium text-foreground">{deleteTarget?.name}</span>?
            This action can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button
            className="bg-red-500/90 text-white hover:bg-red-500"
            onClick={() => handleDelete(deleteTarget)}
          >
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (selectedRecord) {
    return (
      <>
        <RecordDetail
          mod={mod}
          record={selectedRecord}
          onBack={closeRecord}
          onUpdate={handleUpdate}
          onDelete={setDeleteTarget}
        />
        {deleteDialog}
      </>
    );
  }

  const EmptyIcon = mod.icon;
  const hasFilters = search || Object.values(filters).some((v) => v !== "all");

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title={mod.title}
        description={mod.description}
        actions={
          <div className="flex items-center gap-2">
            {mod.settingsAction ? (
              <mod.settingsAction api={api} projectId={projectId} />
            ) : null}
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-4 w-4" /> {mod.createLabel}
            </Button>
          </div>
        }
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex items-center gap-2">
          {mod.filters.map((f) => (
            <FilterDropdown
              key={f.key}
              value={filters[f.key]}
              onValueChange={(v) => setFilters((prev) => ({ ...prev, [f.key]: v }))}
              options={f.options}
              height="h-9"
            />
          ))}
          {(mod.sorts || []).map((s) => (
            <FilterDropdown
              key={s.key}
              value={sorts[s.key]}
              onValueChange={(v) => setSorts((prev) => ({ ...prev, [s.key]: v }))}
              options={s.options}
              height="h-9"
            />
          ))}
        </div>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={mod.searchPlaceholder}
        />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          getRowKey={(r) => r.id}
          onRowClick={(r) => openRecord(r.id)}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              <EmptyState
                icon={EmptyIcon}
                title={
                  records.length
                    ? "No results match your filters"
                    : `No ${mod.title.toLowerCase()} yet`
                }
                description={
                  records.length
                    ? "Try clearing the search or filters."
                    : `Add your first ${mod.singular.toLowerCase()} to get started.`
                }
                action={
                  hasFilters && records.length ? (
                    <Button
                      variant="outline"
                      className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                      onClick={() => {
                        setSearch("");
                        setFilters(
                          Object.fromEntries(mod.filters.map((f) => [f.key, "all"])),
                        );
                      }}
                    >
                      Clear filters
                    </Button>
                  ) : (
                    <Button
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={() => setCreateOpen(true)}
                    >
                      <Plus className="h-4 w-4" /> {mod.createLabel}
                    </Button>
                  )
                }
              />
            </div>
          }
        />
      )}

      <CreateRecordDialog
        mod={mod}
        projectId={projectId}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={handleCreate}
      />

      {deleteDialog}
    </MainScreenWrapper>
  );
}
