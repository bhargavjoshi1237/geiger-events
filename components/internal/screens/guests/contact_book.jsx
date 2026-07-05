"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  Contact,
  Download,
  Loader2,
  Merge,
  MoreHorizontal,
  Pencil,
  ShieldBan,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
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
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { useProject } from "@/context/project-context";
import { listEvents } from "@/lib/supabase/events";
import { listRegistrations } from "@/lib/supabase/registrations";
import {
  listContacts,
  createContact,
  updateContact,
  softDeleteContact,
} from "@/lib/supabase/contacts";
import { getUser } from "@/lib/supabase/user";
import { downloadCsv } from "@/components/internal/screens/registrations/csv";
import {
  BLOCK_FILTER_OPTIONS,
  CONTACT_STATUS_MAP,
  CONTACT_STATUS_VALUES,
  CONSENT_FILTER_OPTIONS,
  STATUS_FILTER_OPTIONS,
  formatDateTime,
  initials,
} from "./constants";
import { ContactDrawer } from "./contact_drawer";
import { GuestImportScreen } from "./guest_import";
import { DedupeMergeScreen } from "./dedupe_merge";

const EMPTY_DRAFT = {
  name: "",
  email: "",
  phone: "",
  company: "",
  status: "Active",
  tags: "",
};

export function ContactBookScreen() {
  const [contacts, setContacts] = useState([]);
  const [events, setEvents] = useState([]);
  const [regs, setRegs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [consentFilter, setConsentFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [blockFilter, setBlockFilter] = useState("all");
  const [openId, setOpenId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [blockEmailOpen, setBlockEmailOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [userId, setUserId] = useState(null);
  // "list" | "import" | "dedupe" — Import and Dedupe fold in as full sub-views.
  const [view, setView] = useState("list");
  const { projectId } = useProject();

  // Refetch just the contacts (used after an import/merge sub-view returns).
  const reloadContacts = useCallback(() => {
    listContacts(projectId).then((cs) => setContacts(cs ?? []));
  }, [projectId]);

  useEffect(() => {
    let alive = true;
    Promise.all([
      listContacts(projectId),
      listEvents(projectId),
      listRegistrations(projectId),
    ]).then(([cs, evs, rs]) => {
      if (!alive) return;
      setContacts(cs ?? []);
      setEvents(evs ?? []);
      setRegs(rs ?? []);
      setLoading(false);
    });
    getUser().then((u) => alive && setUserId(u?.id || null));
    return () => {
      alive = false;
    };
  }, [projectId]);

  // email -> [{ eventId, status, createdAt }] for the attending badge + drawer.
  const regsByEmail = useMemo(() => {
    const m = new Map();
    for (const r of regs) {
      const key = String(r.email || "").toLowerCase();
      if (!key) continue;
      (m.get(key) || m.set(key, []).get(key)).push(r);
    }
    return m;
  }, [regs]);

  const eventNames = useMemo(() => {
    const m = {};
    for (const e of events) m[e.id] = e;
    return m;
  }, [events]);

  const tagOptions = useMemo(() => {
    const set = new Set();
    for (const c of contacts) for (const t of c.tags || []) set.add(t);
    return [
      { value: "all", label: "All tags" },
      ...Array.from(set)
        .sort()
        .map((t) => ({ value: t, label: t })),
    ];
  }, [contacts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (consentFilter === "email" && !c.consentEmail) return false;
      if (consentFilter === "sms" && !c.consentSms) return false;
      if (consentFilter === "none" && (c.consentEmail || c.consentSms)) return false;
      if (tagFilter !== "all" && !(c.tags || []).includes(tagFilter)) return false;
      if (blockFilter === "blocked" && !c.blocked) return false;
      if (blockFilter === "active" && c.blocked) return false;
      if (q) {
        const hay = `${c.name} ${c.email} ${c.company}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [contacts, search, statusFilter, consentFilter, tagFilter, blockFilter]);

  const stats = useMemo(() => {
    const total = contacts.length;
    const active = contacts.filter((c) => c.status === "Active").length;
    const vip = contacts.filter((c) => c.status === "VIP").length;
    const consented = contacts.filter((c) => c.consentEmail).length;
    const pct = total ? Math.round((consented / total) * 100) : 0;
    return [
      { label: "Contacts", value: total.toLocaleString(), footer: "Across all events" },
      { label: "Active", value: active.toLocaleString(), footer: "Currently engaged" },
      { label: "VIP", value: vip.toLocaleString(), footer: "Priority guests" },
      {
        label: "Email consent",
        value: consented.toLocaleString(),
        footer: `Opted in to marketing email · ${pct}%`,
      },
    ];
  }, [contacts]);

  const filtersActive =
    statusFilter !== "all" ||
    consentFilter !== "all" ||
    tagFilter !== "all" ||
    blockFilter !== "all" ||
    Boolean(search.trim());

  const clearFilters = () => {
    setStatusFilter("all");
    setConsentFilter("all");
    setTagFilter("all");
    setBlockFilter("all");
    setSearch("");
  };

  // --- Mutations (optimistic + persisted) ---
  const handleCreate = (draft) => {
    const tags = String(draft.tags || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const contact = {
      id: crypto.randomUUID(),
      projectId,
      name: draft.name.trim(),
      email: (draft.email || "").trim(),
      phone: (draft.phone || "").trim(),
      company: (draft.company || "").trim(),
      title: "",
      location: "",
      status: draft.status || "Active",
      tags,
      consentEmail: false,
      consentSms: false,
      blocked: false,
      blockedReason: "",
      notes: [],
      metadata: {},
      createdBy: userId,
      createdAt: new Date().toISOString(),
    };
    setContacts((prev) => [contact, ...prev]);
    toast.success(`Added ${contact.name}.`);
    createContact(contact).then((saved) => {
      if (saved === null) return;
      if (!saved) toast.error("Couldn't save the contact to the server.");
      else setContacts((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
    });
  };

  const handlePatch = (id, patch) => {
    if (!patch || Object.keys(patch).length === 0) return;
    setContacts((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const next = { ...c, ...patch };
        // Keep the derived notes field in sync when metadata is patched.
        if (patch.metadata) {
          next.notes = Array.isArray(patch.metadata.notes)
            ? patch.metadata.notes
            : [];
        }
        return next;
      }),
    );
    updateContact(id, patch).then((saved) => {
      if (saved === null) return;
      if (!saved) toast.error("Couldn't save the change.");
      else setContacts((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
    });
  };

  const handleDelete = (contact) => {
    setContacts((prev) => prev.filter((c) => c.id !== contact.id));
    setOpenId((id) => (id === contact.id ? null : id));
    toast.success(`Removed ${contact.name || "contact"}.`);
    softDeleteContact(contact.id).then((ok) => {
      if (ok === false) toast.error("Couldn't delete on the server.");
    });
  };

  const handleExport = () => {
    if (!filtered.length) {
      toast.error("No contacts to export.");
      return;
    }
    downloadCsv(
      [
        { header: "Name", value: (c) => c.name },
        { header: "Email", value: (c) => c.email },
        { header: "Phone", value: (c) => c.phone },
        { header: "Company", value: (c) => c.company },
        { header: "Status", value: (c) => c.status },
        { header: "Tags", value: (c) => (c.tags || []).join("; ") },
        { header: "Email consent", value: (c) => (c.consentEmail ? "Yes" : "No") },
        { header: "SMS consent", value: (c) => (c.consentSms ? "Yes" : "No") },
        { header: "Added", value: (c) => formatDateTime(c.createdAt) },
      ],
      filtered,
      "contacts.csv",
    );
    toast.success(`Exported ${filtered.length} contacts.`);
  };

  // Block an email that may not be a contact yet (folds in the old Blocklist
  // "Block someone" flow): flag an existing record, or mint a minimal blocked one.
  const handleBlockEmail = async ({ email, reason }) => {
    const trimmed = email.trim().toLowerCase();
    const existing = contacts.find((c) => c.email.toLowerCase() === trimmed);
    if (existing) {
      if (existing.blocked) {
        toast.message("That contact is already blocked.");
        return;
      }
      handlePatch(existing.id, { blocked: true, blockedReason: reason });
      toast.success(`Blocked ${existing.name || existing.email}.`);
      return;
    }
    const contact = {
      id: crypto.randomUUID(),
      projectId,
      name: "",
      email: email.trim(),
      phone: "",
      company: "",
      title: "",
      location: "",
      status: "Archived",
      tags: [],
      consentEmail: false,
      consentSms: false,
      blocked: true,
      blockedReason: reason,
      notes: [],
      metadata: {},
      createdBy: userId,
      createdAt: new Date().toISOString(),
    };
    setContacts((prev) => [contact, ...prev]);
    toast.success(`Blocked ${email.trim()}.`);
    const saved = await createContact(contact);
    if (saved) {
      setContacts((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
    } else if (saved === false) {
      toast.error("Couldn't save the block on the server.");
    }
  };

  const openContact = contacts.find((c) => c.id === openId) || null;
  const attendedEvents = useMemo(() => {
    if (!openContact) return [];
    const list = regsByEmail.get(String(openContact.email || "").toLowerCase()) || [];
    return list.map((r) => ({
      id: r.eventId,
      name: eventNames[r.eventId]?.name || "Event",
      date: eventNames[r.eventId]?.date || "",
      status: r.status,
    }));
  }, [openContact, regsByEmail, eventNames]);

  const columns = [
    {
      key: "contact",
      header: "Contact",
      render: (c) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface-card text-xs font-semibold text-foreground">
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
      ),
    },
    {
      key: "company",
      header: "Company",
      render: (c) => (
        <span className="text-sm text-text-secondary">{c.company || "—"}</span>
      ),
    },
    {
      key: "tags",
      header: "Tags",
      render: (c) =>
        (c.tags || []).length ? (
          <div className="flex flex-wrap gap-1">
            {c.tags.slice(0, 3).map((t) => (
              <Badge key={t} variant="neutral">
                {t}
              </Badge>
            ))}
            {c.tags.length > 3 ? (
              <span className="text-xs text-text-tertiary">
                +{c.tags.length - 3}
              </span>
            ) : null}
          </div>
        ) : (
          <span className="text-xs text-text-tertiary">—</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      render: (c) => (
        <div className="flex items-center gap-2">
          <StatusPill status={c.status} map={CONTACT_STATUS_MAP} />
          {regsByEmail.has(String(c.email || "").toLowerCase()) ? (
            <Badge variant="info">Attending</Badge>
          ) : null}
          {c.blocked ? <Badge variant="outline">Blocked</Badge> : null}
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (c) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-text-secondary hover:text-foreground"
                aria-label="Contact actions"
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
                onClick={() => setOpenId(c.id)}
              >
                <Pencil className="h-4 w-4" /> Open
              </DropdownMenuItem>
              <DropdownMenuItem
                className="focus:bg-surface-hover"
                onClick={() => handlePatch(c.id, { blocked: !c.blocked })}
              >
                {c.blocked ? (
                  <>
                    <ShieldCheck className="h-4 w-4" /> Unblock
                  </>
                ) : (
                  <>
                    <ShieldBan className="h-4 w-4" /> Block
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem
                className="text-red-400 focus:bg-red-500/10 focus:text-red-400"
                onClick={() => setDeleteTarget(c)}
              >
                <Trash2 className="h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  // Import and Dedupe fold in as full sub-views; refetch contacts on return.
  if (view === "import") {
    return (
      <GuestImportScreen
        onBack={() => {
          setView("list");
          reloadContacts();
        }}
        onImported={reloadContacts}
      />
    );
  }
  if (view === "dedupe") {
    return (
      <DedupeMergeScreen
        onBack={() => {
          setView("list");
          reloadContacts();
        }}
      />
    );
  }

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Contact Book"
        description="Every person across your events — one CRM record each, with tags, notes, consent, and history."
        actions={
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                >
                  Actions <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="border-border bg-surface-subtle text-foreground"
              >
                <DropdownMenuItem
                  className="focus:bg-surface-hover"
                  onClick={() => setView("import")}
                >
                  <Upload className="h-4 w-4" /> Import CSV
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="focus:bg-surface-hover"
                  onClick={() => setView("dedupe")}
                >
                  <Merge className="h-4 w-4" /> Find duplicates
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="focus:bg-surface-hover"
                  onClick={() => setBlockEmailOpen(true)}
                >
                  <ShieldBan className="h-4 w-4" /> Block an email
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem
                  className="focus:bg-surface-hover"
                  onClick={handleExport}
                >
                  <Download className="h-4 w-4" /> Export CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => setCreateOpen(true)}
            >
              <UserPlus className="h-4 w-4" /> Add contact
            </Button>
          </div>
        }
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={STATUS_FILTER_OPTIONS}
          />
          <FilterDropdown
            value={consentFilter}
            onValueChange={setConsentFilter}
            options={CONSENT_FILTER_OPTIONS}
          />
          <FilterDropdown
            value={tagFilter}
            onValueChange={setTagFilter}
            options={tagOptions}
          />
          <FilterDropdown
            value={blockFilter}
            onValueChange={setBlockFilter}
            options={BLOCK_FILTER_OPTIONS}
          />
        </div>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search name, email, company…"
          className="w-full sm:max-w-xs"
        />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading contacts…
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(c) => c.id}
          onRowClick={(c) => setOpenId(c.id)}
          empty={
            <EmptyState
              icon={Contact}
              title={
                filtersActive ? "No contacts match your filters" : "No contacts yet"
              }
              description={
                filtersActive
                  ? "Try adjusting or clearing your filters."
                  : "Add people by hand, import a CSV, or they'll appear as guests register."
              }
              action={
                filtersActive ? (
                  <Button
                    variant="outline"
                    className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                    onClick={clearFilters}
                  >
                    Clear filters
                  </Button>
                ) : (
                  <Button
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => setCreateOpen(true)}
                  >
                    <UserPlus className="h-4 w-4" /> Add contact
                  </Button>
                )
              }
            />
          }
        />
      )}

      <CreateContactDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={handleCreate}
      />

      <BlockEmailDialog
        open={blockEmailOpen}
        onOpenChange={setBlockEmailOpen}
        onBlock={handleBlockEmail}
      />

      <ContactDrawer
        contact={openContact}
        projectId={projectId}
        userId={userId}
        attendedEvents={attendedEvents}
        onPatch={handlePatch}
        onDelete={(c) => setDeleteTarget(c)}
        onClose={() => setOpenId(null)}
      />

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete contact</DialogTitle>
            <DialogDescription>
              Remove{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.name || "this contact"}
              </span>{" "}
              from the contact book? This can&apos;t be undone.
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

function CreateContactDialog({ open, onOpenChange, onCreate }) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const submit = () => {
    if (!draft.name.trim()) {
      toast.error("Add the contact's name first.");
      return;
    }
    onCreate(draft);
    setDraft(EMPTY_DRAFT);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-background">
        <DialogHeader>
          <DialogTitle>Add contact</DialogTitle>
          <DialogDescription>
            Create a contact-book record. You can add tags, notes, and consent
            after saving.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <Field label="Full name" htmlFor="contact-name">
            <Input
              id="contact-name"
              value={draft.name}
              onChange={(e) => set("name")(e.target.value)}
              placeholder="e.g. Jordan Lee"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Email">
              <Input
                type="email"
                value={draft.email}
                onChange={(e) => set("email")(e.target.value)}
                placeholder="jordan@example.com"
              />
            </Field>
            <Field label="Phone">
              <Input
                value={draft.phone}
                onChange={(e) => set("phone")(e.target.value)}
                placeholder="Optional"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Company">
              <Input
                value={draft.company}
                onChange={(e) => set("company")(e.target.value)}
                placeholder="Optional"
              />
            </Field>
            <Field label="Status">
              <Select value={draft.status} onValueChange={set("status")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTACT_STATUS_VALUES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Tags" hint="Comma-separated, e.g. VIP, Speaker">
            <Input
              value={draft.tags}
              onChange={(e) => set("tags")(e.target.value)}
              placeholder="Optional"
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
            Add contact
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BlockEmailDialog({ open, onOpenChange, onBlock }) {
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");

  const submit = () => {
    if (!email.trim()) {
      toast.error("Enter an email to block.");
      return;
    }
    onBlock({ email, reason });
    setEmail("");
    setReason("");
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setEmail("");
          setReason("");
        }
      }}
    >
      <DialogContent className="max-w-md bg-background">
        <DialogHeader>
          <DialogTitle>Block an email</DialogTitle>
          <DialogDescription>
            Blocked emails can&apos;t register. If they&apos;re already a contact,
            we&apos;ll flag that record; otherwise a blocked record is created.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Email" htmlFor="block-email">
            <Input
              id="block-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="person@example.com"
            />
          </Field>
          <Field label="Reason" hint="Optional — only visible to your team">
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Chargeback fraud"
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
            className="bg-red-500/90 text-white hover:bg-red-500"
            onClick={submit}
          >
            <ShieldBan className="h-4 w-4" /> Block
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ContactBookScreen;
