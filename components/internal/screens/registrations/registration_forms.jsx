"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Copy,
  FileText,
  GripVertical,
  Loader2,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EditorSectionHeader,
  EmptyState,
  Field,
  ScreenHeader,
  SearchInput,
  SectionCard,
  SettingsList,
  SettingRow,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import {
  listForms,
  createForm,
  updateForm,
  softDeleteForm,
} from "@/lib/supabase/registration_forms";
import { getUser } from "@/lib/supabase/user";
import {
  FORM_STATUS_MAP,
  FORM_STATUS_FILTER_OPTIONS,
  FIELD_TYPE_OPTIONS,
  formatDate,
} from "./constants";

const DEFAULT_CONFIRMATION = {
  title: "You're in!",
  body: "Thanks for registering — we've emailed your confirmation.",
  showCalendar: true,
  showShare: true,
};

const DEFAULT_SETTINGS = {
  tokenGated: false,
  memberOnly: false,
  group: false,
  autofill: true,
  opensAt: "",
  closesAt: "",
  confirmation: DEFAULT_CONFIRMATION,
};

function shortId() {
  return `f_${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Builder — a single form, tabbed (Fields / Access / Confirmation).
// ---------------------------------------------------------------------------
function FormBuilder({ form, onBack, onSave, onStatusChange }) {
  const [fields, setFields] = useState(form.fields || []);
  const [settings, setSettings] = useState({
    ...DEFAULT_SETTINGS,
    ...(form.settings || {}),
    confirmation: { ...DEFAULT_CONFIRMATION, ...(form.settings?.confirmation || {}) },
  });
  const [saving, setSaving] = useState(false);

  const setSetting = (key) => (value) =>
    setSettings((s) => ({ ...s, [key]: value }));
  const setConfirmation = (key) => (value) =>
    setSettings((s) => ({
      ...s,
      confirmation: { ...s.confirmation, [key]: value },
    }));

  const addField = () =>
    setFields((f) => [
      ...f,
      { id: shortId(), label: "Untitled question", type: "text", required: false },
    ]);

  const updateField = (id, patch) =>
    setFields((f) => f.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const removeField = (id) =>
    setFields((f) => f.filter((x) => x.id !== id));

  const moveField = (index, dir) =>
    setFields((f) => {
      const next = [...f];
      const j = index + dir;
      if (j < 0 || j >= next.length) return f;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });

  const save = async () => {
    setSaving(true);
    const ok = await onSave({ fields, settings });
    setSaving(false);
    if (ok !== false) toast.success("Form saved.");
    else toast.error("Couldn't save the form.");
  };

  // Fields that can drive a conditional "show when" rule (everything above the
  // current field is eligible — keeps the dependency acyclic).
  const fieldOptions = (currentId) =>
    fields.filter((f) => f.id !== currentId);

  return (
    <MainScreenWrapper>
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground hover:bg-surface-active hover:text-foreground"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" /> All forms
        </Button>
      </div>

      <EditorSectionHeader
        title={form.name}
        description={form.description || "Build the fields, access rules, and confirmation for this form."}
        action={
          <div className="flex items-center gap-2">
            <StatusPill status={form.status} map={FORM_STATUS_MAP} />
            <Button
              variant="outline"
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={() =>
                onStatusChange(form.status === "Published" ? "Draft" : "Published")
              }
            >
              {form.status === "Published" ? "Unpublish" : "Publish"}
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={saving}
              onClick={save}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? "Saving…" : "Save form"}
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="fields">
        <TabsList>
          <TabsTrigger value="fields">Fields</TabsTrigger>
          <TabsTrigger value="access">Access</TabsTrigger>
          <TabsTrigger value="confirmation">Confirmation</TabsTrigger>
        </TabsList>

        {/* Fields + conditional logic (Conditional Questions, Group). */}
        <TabsContent value="fields" className="space-y-4">
          <SectionCard
            title="Questions"
            description="Drag-free reorder with the arrows. Add a 'show when' rule to make a question conditional."
            action={
              <Button
                size="sm"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={addField}
              >
                <Plus className="h-4 w-4" /> Add question
              </Button>
            }
          >
            {fields.length ? (
              <div className="space-y-3">
                {fields.map((field, i) => (
                  <div
                    key={field.id}
                    className="rounded-lg border border-border bg-surface-card p-3"
                  >
                    <div className="flex items-start gap-2">
                      <div className="mt-2 flex flex-col text-text-tertiary">
                        <button
                          type="button"
                          aria-label="Move up"
                          className="hover:text-foreground disabled:opacity-30"
                          disabled={i === 0}
                          onClick={() => moveField(i, -1)}
                        >
                          ▲
                        </button>
                        <GripVertical className="h-4 w-4" />
                        <button
                          type="button"
                          aria-label="Move down"
                          className="hover:text-foreground disabled:opacity-30"
                          disabled={i === fields.length - 1}
                          onClick={() => moveField(i, 1)}
                        >
                          ▼
                        </button>
                      </div>

                      <div className="grid flex-1 gap-3">
                        <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
                          <Field label="Question label">
                            <Input
                              value={field.label}
                              onChange={(e) =>
                                updateField(field.id, { label: e.target.value })
                              }
                            />
                          </Field>
                          <Field label="Type">
                            <Select
                              value={field.type}
                              onValueChange={(v) => updateField(field.id, { type: v })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {FIELD_TYPE_OPTIONS.map((o) => (
                                  <SelectItem key={o.value} value={o.value}>
                                    {o.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </Field>
                        </div>

                        {field.type === "select" ? (
                          <Field
                            label="Options"
                            hint="Comma-separated choices for the dropdown."
                          >
                            <Input
                              value={(field.options || []).join(", ")}
                              onChange={(e) =>
                                updateField(field.id, {
                                  options: e.target.value
                                    .split(",")
                                    .map((s) => s.trim())
                                    .filter(Boolean),
                                })
                              }
                              placeholder="e.g. Small, Medium, Large"
                            />
                          </Field>
                        ) : null}

                        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                          <label className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Switch
                              checked={!!field.required}
                              onCheckedChange={(v) =>
                                updateField(field.id, { required: v })
                              }
                            />
                            Required
                          </label>

                          <div className="flex flex-1 items-center gap-2">
                            <span className="text-sm text-text-secondary">
                              Show when
                            </span>
                            <Select
                              value={field.showWhen?.fieldId || "always"}
                              onValueChange={(v) =>
                                updateField(field.id, {
                                  showWhen:
                                    v === "always"
                                      ? undefined
                                      : { fieldId: v, equals: field.showWhen?.equals || "" },
                                })
                              }
                            >
                              <SelectTrigger className="h-8 w-44">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="always">Always shown</SelectItem>
                                {fieldOptions(field.id).map((f) => (
                                  <SelectItem key={f.id} value={f.id}>
                                    {f.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {field.showWhen ? (
                              <Input
                                value={field.showWhen.equals}
                                onChange={(e) =>
                                  updateField(field.id, {
                                    showWhen: {
                                      ...field.showWhen,
                                      equals: e.target.value,
                                    },
                                  })
                                }
                                placeholder="equals…"
                                className="h-8 w-32"
                              />
                            ) : null}
                          </div>

                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Remove question"
                            className="text-red-300 hover:bg-red-500/10 hover:text-red-300"
                            onClick={() => removeField(field.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={FileText}
                title="No questions yet"
                description="Add the fields you want to collect at registration."
                action={
                  <Button
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={addField}
                  >
                    <Plus className="h-4 w-4" /> Add question
                  </Button>
                }
              />
            )}
          </SectionCard>
        </TabsContent>

        {/* Access — token-gated, member-only, group, autofill, deadlines. */}
        <TabsContent value="access" className="space-y-4">
          <SectionCard title="Who can register" description="Gate who's allowed to use this form.">
            <SettingsList>
              <SettingRow
                title="Token-gated"
                description="Require a connected wallet holding a specific token or NFT."
                checked={settings.tokenGated}
                onCheckedChange={setSetting("tokenGated")}
              />
              <SettingRow
                title="Member-only"
                description="Restrict to your members list, an email domain, or Geiger suite membership."
                checked={settings.memberOnly}
                onCheckedChange={setSetting("memberOnly")}
              />
              <SettingRow
                title="Group registration"
                description="Let one person register a team/table and collect details per seat."
                checked={settings.group}
                onCheckedChange={setSetting("group")}
              />
              <SettingRow
                title="Autofill returning guests"
                description="Recognise returning contacts and pre-fill known fields."
                checked={settings.autofill}
                onCheckedChange={setSetting("autofill")}
              />
            </SettingsList>
          </SectionCard>

          <SectionCard title="Registration window" description="Open and close the form automatically.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Opens" hint="Leave empty to open immediately.">
                <Input
                  type="date"
                  value={settings.opensAt}
                  onChange={(e) => setSetting("opensAt")(e.target.value)}
                />
              </Field>
              <Field label="Closes" hint="Leave empty for no deadline.">
                <Input
                  type="date"
                  value={settings.closesAt}
                  onChange={(e) => setSetting("closesAt")(e.target.value)}
                />
              </Field>
            </div>
          </SectionCard>
        </TabsContent>

        {/* Confirmation page. */}
        <TabsContent value="confirmation" className="space-y-4">
          <SectionCard
            title="Confirmation page"
            description="What registrants see right after they sign up."
          >
            <div className="space-y-4">
              <Field label="Heading">
                <Input
                  value={settings.confirmation.title}
                  onChange={(e) => setConfirmation("title")(e.target.value)}
                />
              </Field>
              <Field label="Message">
                <Textarea
                  rows={3}
                  value={settings.confirmation.body}
                  onChange={(e) => setConfirmation("body")(e.target.value)}
                />
              </Field>
              <SettingsList>
                <SettingRow
                  title="Show 'Add to calendar'"
                  description="Offer calendar links on the confirmation page."
                  checked={settings.confirmation.showCalendar}
                  onCheckedChange={setConfirmation("showCalendar")}
                />
                <SettingRow
                  title="Show share buttons"
                  description="Let attendees share the event after registering."
                  checked={settings.confirmation.showShare}
                  onCheckedChange={setConfirmation("showShare")}
                />
              </SettingsList>
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </MainScreenWrapper>
  );
}

// ---------------------------------------------------------------------------
// Create-form dialog
// ---------------------------------------------------------------------------
function CreateFormDialog({ open, onOpenChange, onCreate }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const submit = () => {
    if (!name.trim()) {
      toast.error("Give the form a name first.");
      return;
    }
    onCreate({ name: name.trim(), description: description.trim() });
    setName("");
    setDescription("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-background">
        <DialogHeader>
          <DialogTitle>New registration form</DialogTitle>
          <DialogDescription>
            A reusable field set your events can share. You can add questions and
            rules next.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Form name" htmlFor="form-name">
            <Input
              id="form-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Workshop Registration"
            />
          </Field>
          <Field label="Description">
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this form is for."
            />
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
            Create form
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// List + routing into the builder
// ---------------------------------------------------------------------------
export function RegistrationFormsScreen() {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    let alive = true;
    listForms().then((rows) => {
      if (!alive) return;
      setForms(rows ?? []);
      setLoading(false);
    });
    getUser().then((u) => alive && setUserId(u?.id || null));
    return () => {
      alive = false;
    };
  }, []);

  const openForm = useMemo(
    () => forms.find((f) => f.id === openId) || null,
    [forms, openId],
  );

  const filtered = useMemo(() => {
    return forms.filter((f) => {
      if (statusFilter !== "all" && f.status !== statusFilter) return false;
      if (search && !f.name.toLowerCase().includes(search.toLowerCase()))
        return false;
      return true;
    });
  }, [forms, search, statusFilter]);

  const stats = useMemo(() => {
    const published = forms.filter((f) => f.status === "Published").length;
    const avg = forms.length
      ? Math.round(
          forms.reduce((s, f) => s + (f.fields?.length || 0), 0) / forms.length,
        )
      : 0;
    return [
      { label: "Total forms", value: String(forms.length), footer: "In your library" },
      { label: "Published", value: String(published), footer: "Live & reusable" },
      { label: "Drafts", value: String(forms.length - published), footer: "Work in progress" },
      { label: "Avg. fields", value: String(avg), footer: "Per form" },
    ];
  }, [forms]);

  const patchForm = (id, patch) => {
    setForms((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const handleCreate = (draft) => {
    const form = {
      id: crypto.randomUUID(),
      name: draft.name,
      description: draft.description,
      status: "Draft",
      fields: [
        { id: "name", label: "Full name", type: "text", required: true },
        { id: "email", label: "Email", type: "email", required: true },
      ],
      settings: DEFAULT_SETTINGS,
      createdBy: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setForms((prev) => [form, ...prev]);
    setOpenId(form.id);
    toast.success(`Created "${form.name}".`);
    createForm(form).then((saved) => {
      if (saved === null) return;
      if (!saved) toast.error("Couldn't save the form to the server.");
      else setForms((prev) => prev.map((f) => (f.id === saved.id ? saved : f)));
    });
  };

  const handleSave = async (id, patch) => {
    patchForm(id, patch);
    const res = await updateForm(id, patch);
    return res === false ? false : true;
  };

  const handleStatusChange = (id, status) => {
    patchForm(id, { status });
    toast.success(status === "Published" ? "Form published." : "Form moved to draft.");
    updateForm(id, { status }).then((res) => {
      if (res === false) toast.error("Couldn't update on the server.");
    });
  };

  const handleDuplicate = (form) => {
    const copy = {
      ...form,
      id: crypto.randomUUID(),
      name: `${form.name} (copy)`,
      status: "Draft",
      createdBy: userId,
      createdAt: new Date().toISOString(),
    };
    setForms((prev) => [copy, ...prev]);
    toast.success(`Duplicated "${form.name}".`);
    createForm(copy).then((saved) => {
      if (saved === null) return;
      if (!saved) toast.error("Couldn't save the copy.");
      else setForms((prev) => prev.map((f) => (f.id === saved.id ? saved : f)));
    });
  };

  const handleDelete = (form) => {
    setDeleteTarget(null);
    setForms((prev) => prev.filter((f) => f.id !== form.id));
    toast.success(`Deleted "${form.name}".`);
    softDeleteForm(form.id).then((ok) => {
      if (ok === false) toast.error("Couldn't delete on the server.");
    });
  };

  if (openForm) {
    return (
      <FormBuilder
        form={openForm}
        onBack={() => setOpenId(null)}
        onSave={(patch) => handleSave(openForm.id, patch)}
        onStatusChange={(status) => handleStatusChange(openForm.id, status)}
      />
    );
  }

  const columns = [
    {
      key: "name",
      header: "Form",
      render: (f) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-foreground">{f.name}</span>
          {f.description ? (
            <span className="line-clamp-1 max-w-md text-xs text-text-secondary">
              {f.description}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (f) => <StatusPill status={f.status} map={FORM_STATUS_MAP} />,
    },
    {
      key: "fields",
      header: "Fields",
      align: "right",
      className: "text-right tabular-nums",
      render: (f) => f.fields?.length || 0,
    },
    {
      key: "updated",
      header: "Updated",
      render: (f) => (
        <span className="text-sm text-text-secondary">
          {formatDate((f.updatedAt || f.createdAt || "").split("T")[0])}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (f) => (
        <div onClick={(ev) => ev.stopPropagation()}>
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
              className="w-40 border-border bg-surface-card shadow-xl"
            >
              <DropdownMenuItem
                className="cursor-pointer gap-2 text-muted-foreground focus:bg-surface-hover focus:text-foreground"
                onClick={() => setOpenId(f.id)}
              >
                <FileText className="h-4 w-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer gap-2 text-muted-foreground focus:bg-surface-hover focus:text-foreground"
                onClick={() => handleDuplicate(f)}
              >
                <Copy className="h-4 w-4" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-surface-strong" />
              <DropdownMenuItem
                className="cursor-pointer gap-2 text-red-300 focus:bg-red-500/10 focus:text-red-300"
                onClick={() => setDeleteTarget(f)}
              >
                <Trash2 className="h-4 w-4 text-red-300" /> Delete
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
        title="Registration Forms"
        description="Reusable field sets your events share — questions, conditional logic, access rules, and the confirmation page."
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4" /> New form
          </Button>
        }
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <FilterDropdown
          value={statusFilter}
          onValueChange={setStatusFilter}
          options={FORM_STATUS_FILTER_OPTIONS}
          height="h-9"
        />
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search forms…"
          className="w-full sm:max-w-xs"
        />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading forms…
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(f) => f.id}
          onRowClick={(f) => setOpenId(f.id)}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              <EmptyState
                icon={FileText}
                title={forms.length ? "No forms match your filters" : "No forms yet"}
                description={
                  forms.length
                    ? "Try clearing the search or filters."
                    : "Create a reusable registration form to collect the details you need."
                }
                action={
                  <Button
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => setCreateOpen(true)}
                  >
                    <Plus className="h-4 w-4" /> New form
                  </Button>
                }
              />
            </div>
          }
        />
      )}

      <CreateFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={handleCreate}
      />

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete form</DialogTitle>
            <DialogDescription>
              Delete{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.name}
              </span>
              ? Events using it will fall back to the default fields.
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

export default RegistrationFormsScreen;
