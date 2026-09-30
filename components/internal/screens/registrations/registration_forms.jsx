"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  Copy,
  FileText,
  ListChecks,
  Loader2,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { EditorShell } from "@/components/internal/shared/editor_shell";
import {
  DataTable,
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
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Textarea } from "@geiger/ui/textarea";
import { ActionMenu } from "@geiger/ui/action-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { FormFieldsEditor } from "@/components/internal/shared/form_fields_editor";
import {
  listForms,
  createForm,
  updateForm,
  softDeleteForm,
} from "@/lib/supabase/registration_forms";
import { getUser } from "@/lib/supabase/user";
import { useProject } from "@/context/project-context";
import {
  FORM_STATUS_MAP,
  FORM_STATUS_FILTER_OPTIONS,
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

const BUILDER_NAV = [
  {
    key: "fields",
    label: "Fields",
    icon: ListChecks,
    desc: "The questions this form asks, in the order they're answered.",
  },
  {
    key: "access",
    label: "Access",
    icon: ShieldCheck,
    desc: "Who can use this form and when it's open.",
  },
  {
    key: "confirmation",
    label: "Confirmation",
    icon: CheckCircle2,
    desc: "The message and follow-up actions shown after a successful sign-up.",
  },
];

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

  const save = async () => {
    setSaving(true);
    const ok = await onSave({ fields, settings });
    setSaving(false);
    if (ok !== false) toast.success("Form saved.");
    else toast.error("Couldn't save the form.");
  };

  return (
    <EditorShell
      back={{ label: "All forms", onClick: onBack }}
      title={form.name}
      status={form.status}
      statusMap={FORM_STATUS_MAP}
      meta={
        form.description ||
        "Build the fields, access rules, and confirmation for this form."
      }
      actions={
        <>
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
        </>
      }
      nav={BUILDER_NAV}
      defaultSection="fields"
    >
      {({ active: tab }) => (
        <>
          {tab === "fields" ? (
            <FormFieldsEditor fields={fields} setFields={setFields} />
          ) : null}

          {tab === "access" ? (
            <AccessSection settings={settings} setSetting={setSetting} />
          ) : null}

          {tab === "confirmation" ? (
            <ConfirmationSection
              settings={settings}
              setConfirmation={setConfirmation}
            />
          ) : null}
        </>
      )}
    </EditorShell>
  );
}

function AccessSection({ settings, setSetting }) {
  return (
    <div className="space-y-4">
      <SectionCard
        title="Who can register"
        description="Gate who's allowed to use this form."
      >
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

      <SectionCard
        title="Registration window"
        description="Open and close the form automatically."
      >
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
    </div>
  );
}

function ConfirmationSection({ settings, setConfirmation }) {
  return (
    <div className="space-y-4">
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
    </div>
  );
}

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

export function RegistrationFormsScreen() {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [userId, setUserId] = useState(null);
  const { projectId } = useProject();

  useEffect(() => {
    let alive = true;
    listForms(projectId).then((rows) => {
      if (!alive) return;
      setForms(rows ?? []);
      setLoading(false);
    });
    getUser().then((u) => alive && setUserId(u?.id || null));
    return () => {
      alive = false;
    };
  }, [projectId]);

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
      projectId,
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
      projectId,
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
        <ActionMenu
          label={`Actions for ${f.name}`}
          items={[
            { icon: FileText, label: "Edit", onSelect: () => setOpenId(f.id) },
            { icon: Copy, label: "Duplicate", onSelect: () => handleDuplicate(f) },
            { separator: true },
            {
              icon: Trash2,
              label: "Delete",
              variant: "destructive",
              onSelect: () => setDeleteTarget(f),
            },
          ]}
        />
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
