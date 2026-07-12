"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import {
  MainScreenWrapper,
  SecondaryScreenWrapper,
} from "@/components/internal/shared/screen_wrappers";
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
import { Switch } from "@/components/ui/switch";
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
import { cn } from "@/lib/utils";
import { useProject } from "@/context/project-context";
import { newId } from "@/components/internal/screens/events/sample_data";
import { getUser } from "@/lib/supabase/user";
import {
  listRecords,
  createRecord,
  updateRecord,
  softDeleteRecord,
} from "@/lib/supabase/ticketing";

// Default data adapter — the ticketing records store. Other areas (e.g.
// Campaigns' template/sequence assets) pass their own `data` adapter with the
// same shape so this screen backs any reusable-records module.
const TICKETING_DATA = {
  list: listRecords,
  create: createRecord,
  update: updateRecord,
  remove: softDeleteRecord,
};

const kindLabel = (kinds, value) =>
  kinds.find((k) => k.value === value)?.label || value;

// --- Create dialog -----------------------------------------------------------

function CreateRecordDialog({ open, onOpenChange, singular, kinds, onCreate }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState(kinds[0]?.value || "");

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setName("");
      setKind(kinds[0]?.value || "");
    }
  }

  const submit = () => {
    if (!name.trim()) {
      toast.error(`Give the ${singular} a name.`);
      return;
    }
    onCreate(name.trim(), kind);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-background">
        <DialogHeader>
          <DialogTitle>New {singular}</DialogTitle>
          <DialogDescription>
            Name it and pick a type — you&apos;ll set everything else on its edit
            page.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Name" htmlFor="rec-name">
            <Input
              id="rec-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`e.g. Summer ${singular}`}
              autoFocus
            />
          </Field>
          {kinds.length > 1 ? (
            <Field label="Type">
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {kinds.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
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
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Per-record edit page ----------------------------------------------------

function RecordEditPage({
  record,
  singular,
  kinds,
  EditForm,
  onBack,
  onSave,
  hideHeaderActive = false,
}) {
  const [name, setName] = useState(record.name);
  const [active, setActive] = useState(record.active);
  const [config, setConfig] = useState(record.config || {});
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) {
      toast.error("Give it a name.");
      return;
    }
    setSaving(true);
    await onSave(record.id, {
      name: name.trim(),
      active,
      config,
    });
    setSaving(false);
  };

  return (
    <SecondaryScreenWrapper>
      <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={onBack}
            className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
          <div className="flex flex-wrap items-center gap-2.5">
            <input
              value={name}
              size={Math.max(name.length, 6)}
              spellCheck={false}
              onChange={(e) => setName(e.target.value)}
              aria-label={`${singular} name`}
              className="min-w-0 max-w-full rounded-sm bg-transparent text-2xl font-semibold tracking-tight text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40 md:text-3xl"
            />
            {kinds.length > 1 ? (
              <Badge variant="neutral">{kindLabel(kinds, record.kind)}</Badge>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {hideHeaderActive ? null : (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              {active ? "Active" : "Inactive"}
              <Switch checked={active} onCheckedChange={setActive} />
            </label>
          )}
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={saving}
            onClick={save}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <div className="mt-6">
        <EditForm
          record={record}
          config={config}
          setConfig={setConfig}
          active={active}
          setActive={setActive}
        />
      </div>
    </SecondaryScreenWrapper>
  );
}

// --- List screen -------------------------------------------------------------

// A reusable global-records screen: list of a module's records, a create
// dialog, and a per-record edit page. Each module supplies its kinds, list-card
// summary, and edit form; persistence + optimistic state live here.
export function RecordsScreen({
  module,
  title,
  description,
  singular,
  icon: Icon,
  kinds,
  summarize,
  EditForm,
  headerExtra,
  data,
  hideHeaderActive = false,
  summaryRight = false,
}) {
  const api = data || TICKETING_DATA;
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [userId, setUserId] = useState(null);
  const { projectId } = useProject();

  useEffect(() => {
    let alive = true;
    api.list(projectId, module).then((rows) => {
      if (!alive) return;
      setRecords(rows ?? []);
      setLoading(false);
    });
    getUser().then((u) => alive && setUserId(u?.id || null));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, module]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((r) =>
      q ? (r.name || "").toLowerCase().includes(q) : true,
    );
  }, [records, search]);

  const handleCreate = (name, kind) => {
    const defaults = kinds.find((k) => k.value === kind)?.defaultConfig || {};
    const record = {
      id: newId(),
      module,
      kind,
      name,
      active: true,
      config: typeof defaults === "function" ? defaults() : { ...defaults },
      projectId,
      createdBy: userId,
      createdAt: new Date().toISOString(),
    };
    setRecords((prev) => [record, ...prev]);
    setOpenId(record.id);
    api.create(record).then((saved) => {
      if (saved === null) return;
      if (!saved) toast.error(`Couldn't save the ${singular} to the server.`);
      else setRecords((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
    });
  };

  const handleSave = async (id, patch) => {
    setRecords((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
    const saved = await api.update(id, patch);
    if (saved === false || saved === null) {
      // null = not configured (local-only, treat as ok); false = write failed.
      if (saved === false) {
        toast.error("Couldn't save your changes to the server.");
        return;
      }
    }
    toast.success("Saved.");
  };

  const handleToggleActive = (record) => {
    const next = !record.active;
    setRecords((prev) =>
      prev.map((r) => (r.id === record.id ? { ...r, active: next } : r)),
    );
    api.update(record.id, { active: next }).then((res) => {
      if (res === false) toast.error("Couldn't update on the server.");
    });
  };

  const handleDelete = (record) => {
    setDeleteTarget(null);
    setRecords((prev) => prev.filter((r) => r.id !== record.id));
    toast.success(`Deleted "${record.name}".`);
    api.remove(record.id).then((ok) => {
      if (ok === false) toast.error("Couldn't delete on the server.");
    });
  };

  // Edit page takes over the screen when a record is open.
  const openRecord = records.find((r) => r.id === openId) || null;
  if (openRecord) {
    return (
      <RecordEditPage
        record={openRecord}
        singular={singular}
        kinds={kinds}
        EditForm={EditForm}
        onBack={() => setOpenId(null)}
        onSave={handleSave}
        hideHeaderActive={hideHeaderActive}
      />
    );
  }

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title={title}
        description={description}
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4" /> New {singular}
          </Button>
        }
      />

      <Toolbar>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={`Search ${title.toLowerCase()}…`}
          className="w-full sm:max-w-xs"
        />
        {headerExtra}
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : filtered.length ? (
        <div className="grid gap-3">
          {filtered.map((record) => (
            <div
              key={record.id}
              role="button"
              tabIndex={0}
              onClick={() => setOpenId(record.id)}
              onKeyDown={(e) => e.key === "Enter" && setOpenId(record.id)}
              className={cn(
                "group flex items-center gap-3 rounded-xl border border-border bg-surface-subtle p-4 text-left transition-colors hover:border-border-strong hover:bg-surface-hover",
                record.active ? "" : "opacity-60",
              )}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-muted-foreground">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">
                    {record.name}
                  </span>
                  {kinds.length > 1 ? (
                    <Badge variant="neutral">
                      {kindLabel(kinds, record.kind)}
                    </Badge>
                  ) : null}
                  {!record.active ? (
                    <span className="text-[11px] font-medium uppercase tracking-wide text-text-tertiary">
                      Inactive
                    </span>
                  ) : null}
                </div>
                {summarize && !summaryRight ? (
                  <p className="mt-0.5 truncate text-xs text-text-secondary">
                    {summarize(record)}
                  </p>
                ) : null}
              </div>
              {summarize && summaryRight ? (
                <p className="hidden shrink-0 whitespace-nowrap text-xs text-text-secondary sm:block">
                  {summarize(record)}
                </p>
              ) : null}
              <div onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
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
                      onClick={() => setOpenId(record.id)}
                    >
                      <Pencil className="h-4 w-4" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer gap-2 text-muted-foreground focus:bg-surface-hover focus:text-foreground"
                      onClick={() => handleToggleActive(record)}
                    >
                      {record.active ? "Deactivate" : "Activate"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-surface-strong" />
                    <DropdownMenuItem
                      className="cursor-pointer gap-2 text-red-300 focus:bg-red-500/10 focus:text-red-300"
                      onClick={() => setDeleteTarget(record)}
                    >
                      <Trash2 className="h-4 w-4 text-red-300" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={Icon}
            title={records.length ? "No matches" : `No ${title.toLowerCase()} yet`}
            description={
              records.length
                ? "Try a different search."
                : `Create a reusable ${singular} here, then attach it to any event from its edit page.`
            }
            action={
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="h-4 w-4" /> New {singular}
              </Button>
            }
          />
        </div>
      )}

      <CreateRecordDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        singular={singular}
        kinds={kinds}
        onCreate={handleCreate}
      />

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {singular}</DialogTitle>
            <DialogDescription>
              Delete{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.name}
              </span>
              ? Events it&apos;s attached to will stop using it. This can&apos;t
              be undone.
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
    </MainScreenWrapper>
  );
}
