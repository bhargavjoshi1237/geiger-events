"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BadgeCheckIcon,
  BanIcon,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import {
  MainScreenWrapper,
  SecondaryScreenWrapper,
} from "@/components/internal/shared/screen_wrappers";
import {
  EditorHeader,
  EditorShell,
} from "@/components/internal/shared/editor_shell";
import {
  DataTable,
  EmptyState,
  Field,
  InlineTitleInput,
  ScreenHeader,
  SearchInput,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import {
  ListPagination,
  usePagination,
} from "@/components/internal/shared/pagination";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { Input } from "@geiger/ui/input";
import { Switch } from "@geiger/ui/switch";
import { ActionMenu } from "@geiger/ui/action-menu";
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
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import { useProject } from "@/context/project-context";
import { newId } from "@/components/internal/screens/events/sample_data";
import { getUser } from "@/lib/supabase/user";
import {
  listRecords,
  createRecord,
  updateRecord,
  softDeleteRecord,
} from "@/lib/supabase/ticketing";

const TICKETING_DATA = {
  list: listRecords,
  create: createRecord,
  update: updateRecord,
  remove: softDeleteRecord,
};

const kindLabel = (kinds, value) =>
  kinds.find((k) => k.value === value)?.label || value;

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

const RECORD_STATUS_MAP = {
  active: { label: "Active", variant: "success", dotClass: "bg-emerald-400" },
  inactive: { label: "Inactive", variant: "neutral", dotClass: "bg-[#737373]" },
};

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
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="grid gap-4"
        >
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
        </form>
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

function RecordEditPage({
  record,
  singular,
  kinds,
  EditForm,
  sections,
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

  const formProps = {
    record,
    config,
    setConfig,
    active,
    setActive,
  };

  const header = {
    back: { label: "Back", onClick: onBack },
    title: (
      <InlineTitleInput
        value={name}
        onChange={(e) => setName(e.target.value)}
        aria-label={`${singular} name`}
        placeholder={`Untitled ${singular.toLowerCase()}`}
        className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl"
      />
    ),
    badges:
      kinds.length > 1 ? (
        <Badge variant="neutral">{kindLabel(kinds, record.kind)}</Badge>
      ) : null,
    actions: (
      <>
        {hideHeaderActive ? null : (
          <label className="flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border bg-transparent px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-active hover:text-foreground">
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
      </>
    ),
  };

  if (sections?.length) {
    return (
      <EditorShell {...header} nav={sections} defaultSection={sections[0].key}>
        {({ activeItem }) => {
          const Body = activeItem.render;
          return <Body {...formProps} />;
        }}
      </EditorShell>
    );
  }

  return (
    <SecondaryScreenWrapper>
      <EditorHeader {...header} />

      <div className="mt-6">
        <EditForm {...formProps} />
      </div>
    </SecondaryScreenWrapper>
  );
}

export function RecordsScreen({
  module,
  title,
  description,
  singular,
  icon: Icon,
  kinds,
  summarize,
  EditForm,
  sections,
  headerExtra,
  data,
  hideHeaderActive = false,
}) {
  const api = data || TICKETING_DATA;
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [kind, setKind] = useState("all");
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

  // The type filter only exists for modules with more than one kind.
  const kindOptions = useMemo(
    () => [
      { value: "all", label: "All Types" },
      ...kinds.map((k) => ({ value: k.value, label: k.label })),
    ],
    [kinds],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((r) => {
      if (status !== "all" && !!r.active !== (status === "active")) return false;
      if (kind !== "all" && r.kind !== kind) return false;
      if (q && !(r.name || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [records, search, status, kind]);

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

  const pager = usePagination(filtered, {
    resetKey: `${search}|${status}|${kind}`,
  });

  // Mirrors the All Events table: identity first, then the module's own
  // summary, status, and the row menu pinned right.
  const columns = [
    {
      key: "name",
      header: "Name",
      render: (r) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-muted-foreground">
            <Icon className="h-4 w-4" />
          </div>
          <span className="font-medium text-foreground">{r.name}</span>
        </div>
      ),
    },
    kinds.length > 1 && {
      key: "kind",
      header: "Type",
      render: (r) => <Badge variant="neutral">{kindLabel(kinds, r.kind)}</Badge>,
    },
    summarize && {
      key: "summary",
      header: "Details",
      render: (r) => (
        <span className="text-sm text-text-secondary">{summarize(r)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <StatusPill
          status={r.active ? "active" : "inactive"}
          map={RECORD_STATUS_MAP}
        />
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (r) => (
        <ActionMenu
          label={`Actions for ${r.name}`}
          items={[
            { icon: Pencil, label: "Edit", onSelect: () => setOpenId(r.id) },
            {
              icon: r.active ? BanIcon : BadgeCheckIcon,
              label: r.active ? "Deactivate" : "Activate",
              onSelect: () => handleToggleActive(r),
            },
            { separator: true },
            {
              icon: Trash2,
              label: "Delete",
              variant: "destructive",
              onSelect: () => setDeleteTarget(r),
            },
          ]}
        />
      ),
    },
  ].filter(Boolean);

  const openRecord = records.find((r) => r.id === openId) || null;
  if (openRecord) {
    return (
      <RecordEditPage
        record={openRecord}
        singular={singular}
        kinds={kinds}
        EditForm={EditForm}
        sections={sections}
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
        <div className="flex items-center gap-2">
          {headerExtra}
          <FilterDropdown
            value={status}
            onValueChange={setStatus}
            options={STATUS_FILTER_OPTIONS}
            height="h-9"
          />
          {kinds.length > 1 ? (
            <FilterDropdown
              value={kind}
              onValueChange={setKind}
              options={kindOptions}
              height="h-9"
            />
          ) : null}
        </div>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={`Search ${title.toLowerCase()}…`}
        />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : (
        <div className="space-y-5">
          <DataTable
            columns={columns}
            data={pager.pageItems}
            getRowKey={(r) => r.id}
            onRowClick={(r) => setOpenId(r.id)}
            empty={
              <div className="rounded-xl border border-border bg-surface-subtle">
                <EmptyState
                  icon={Icon}
                  title={
                    records.length ? "No matches" : `No ${title.toLowerCase()} yet`
                  }
                  description={
                    records.length
                      ? "Try clearing the search or filters."
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
            }
          />
          <ListPagination {...pager} itemLabel={title.toLowerCase()} />
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
