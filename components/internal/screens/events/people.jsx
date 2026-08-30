"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Crown,
  ShieldCheck,
  Users,
  ScanLine,
  Eye,
  Loader2,
  UserPlus,
  Check,
  Pencil,
  ImagePlus,
  X,
} from "lucide-react";

import {
  DataTable,
  Field,
  EditorSectionHeader,
  EmptyState,
  Toolbar,
  SearchInput,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { Input } from "@geiger/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@geiger/ui/avatar";
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
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import {
  EVENT_TEAM_ROLES,
  EVENT_TEAM_ROLE_MAP,
  EVENT_TEAM_ROLE_FILTER_OPTIONS,
  initials,
} from "./sample_data";
import { getUser } from "@/lib/supabase/user";
import { listMembers } from "@/lib/supabase/team";
import {
  listEventTeam,
  addEventTeamMember,
  updateEventTeamMember,
  softDeleteEventTeamMember,
} from "@/lib/supabase/event_team";
import { uploadEventImage } from "@/lib/supabase/storage";

const ROLE_ICONS = { Crown, ShieldCheck, Users, ScanLine, Eye };
const FALLBACK_ROLE = EVENT_TEAM_ROLE_MAP.Viewer;

function roleStyle(role) {
  return EVENT_TEAM_ROLE_MAP[role] || FALLBACK_ROLE;
}

function RoleBadge({ role }) {
  const style = roleStyle(role);
  const Icon = ROLE_ICONS[style.icon] || Eye;
  return (
    <Badge variant={style.variant}>
      <Icon className="h-3 w-3" />
      {role}
    </Badge>
  );
}

function displayName(m) {
  return m.name || (m.email || "").split("@")[0] || "Teammate";
}

const EMPTY_FORM = { name: "", email: "", avatarUrl: "", role: "Co-host" };

export function CoHostsAdminsSection({ event, headerItem }) {
  const eventId = event?.id;
  const projectId = event?.projectId || null;

  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roster, setRoster] = useState([]);
  const [user, setUser] = useState(null);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [rosterOpen, setRosterOpen] = useState(false);
  const [rosterRole, setRosterRole] = useState("Co-host");
  const [rosterPicked, setRosterPicked] = useState([]);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [rows, me] = await Promise.all([listEventTeam(eventId), getUser()]);
      if (!alive) return;
      setUser(me);
      let next = rows ?? [];
      if (!next.length && me) {
        const owner = await addEventTeamMember({
          id: crypto.randomUUID(),
          eventId,
          projectId,
          userId: me.id,
          role: "Owner",
          status: "active",
          name: me.name,
          email: me.email,
          avatarUrl: me.avatar || "",
          createdBy: me.id,
        });
        if (!alive) return;
        if (owner) next = [owner];
      }
      setTeam(next);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [eventId, projectId]);

  useEffect(() => {
    let alive = true;
    listMembers(projectId).then((rows) => {
      if (alive) setRoster(rows ?? []);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const members = team;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      if (roleFilter !== "all" && m.role !== roleFilter) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
      );
    });
  }, [members, search, roleFilter]);

  const available = useMemo(() => {
    const takenIds = new Set(team.map((m) => m.memberId).filter(Boolean));
    const takenEmails = new Set(
      team.map((m) => m.email.toLowerCase()).filter(Boolean),
    );
    return roster.filter(
      (r) => !takenIds.has(r.id) && !takenEmails.has((r.email || "").toLowerCase()),
    );
  }, [roster, team]);

  const addFromRoster = async () => {
    if (!rosterPicked.length) {
      toast.error("Pick at least one person to add.");
      return;
    }
    setAdding(true);
    const picks = available.filter((r) => rosterPicked.includes(r.id));
    const optimistic = picks.map((r) => ({
      id: crypto.randomUUID(),
      eventId,
      projectId,
      memberId: r.id,
      userId: r.userId,
      role: rosterRole,
      status: "active",
      name: r.name,
      email: r.email,
      avatarUrl: r.avatarUrl || "",
    }));
    setTeam((prev) => [...prev, ...optimistic]);
    setRosterOpen(false);
    setRosterPicked([]);

    const saved = await Promise.all(
      optimistic.map((row) =>
        addEventTeamMember({ ...row, createdBy: user?.id ?? null }),
      ),
    );
    setAdding(false);
    const failed = optimistic.filter((row, i) => !saved[i]);
    setTeam((prev) => {
      const byId = new Map(saved.filter(Boolean).map((r) => [r.id, r]));
      return prev
        .filter((m) => !failed.some((f) => f.id === m.id))
        .map((m) => byId.get(m.id) || m);
    });
    if (failed.length) {
      toast.error("Couldn't add everyone — please try again.");
    } else {
      toast.success(
        picks.length === 1 ? "Teammate added." : `${picks.length} teammates added.`,
      );
    }
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (m) => {
    setEditingId(m.id);
    setForm({
      name: m.name || "",
      email: m.email || "",
      avatarUrl: m.avatarUrl || "",
      role: m.role,
    });
    setFormOpen(true);
  };

  const pickAvatar = async (file) => {
    if (!file) return;
    setUploading(true);
    const url = await uploadEventImage(eventId, file);
    setUploading(false);
    if (url) {
      setForm((f) => ({ ...f, avatarUrl: url }));
    } else {
      toast.error("Couldn't upload that photo.");
    }
  };

  const saveMember = async () => {
    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    if (!name && !email) {
      toast.error("Enter a name or an email address.");
      return;
    }
    if (email && !email.includes("@")) {
      toast.error("Enter a valid email address.");
      return;
    }
    if (
      email &&
      team.some(
        (m) => m.id !== editingId && (m.email || "").toLowerCase() === email,
      )
    ) {
      toast.error("That person already has access to this event.");
      return;
    }
    const patch = { name, email, avatarUrl: form.avatarUrl, role: form.role };

    if (editingId) {
      const before = team;
      setTeam((prev) =>
        prev.map((m) => (m.id === editingId ? { ...m, ...patch } : m)),
      );
      setFormOpen(false);
      const saved = await updateEventTeamMember(editingId, patch);
      if (saved) {
        setTeam((prev) => prev.map((m) => (m.id === saved.id ? saved : m)));
        toast.success("Details updated.");
      } else {
        setTeam(before);
        toast.error("Couldn't save those details.");
      }
      return;
    }

    const optimistic = {
      ...patch,
      id: crypto.randomUUID(),
      eventId,
      projectId,
      status: "active",
      joinedAt: new Date().toISOString(),
    };
    setTeam((prev) => [...prev, optimistic]);
    setFormOpen(false);
    setSaving(true);
    const saved = await addEventTeamMember({
      ...optimistic,
      createdBy: user?.id ?? null,
    });
    setSaving(false);
    if (saved) {
      setTeam((prev) => prev.map((m) => (m.id === saved.id ? saved : m)));
      toast.success(`${displayName(saved)} added.`);
    } else {
      setTeam((prev) => prev.filter((m) => m.id !== optimistic.id));
      toast.error("Couldn't add them — please try again.");
    }
  };

  const changeRole = async (id, role) => {
    const before = team;
    setTeam((prev) => prev.map((m) => (m.id === id ? { ...m, role } : m)));
    const saved = await updateEventTeamMember(id, { role });
    if (saved) {
      toast.success("Role updated.");
    } else {
      setTeam(before);
      toast.error("Couldn't update the role.");
    }
  };

  const removeMember = async (id, msg) => {
    const before = team;
    setTeam((prev) => prev.filter((m) => m.id !== id));
    const ok = await softDeleteEventTeamMember(id);
    if (ok) {
      toast.success(msg);
    } else {
      setTeam(before);
      toast.error("Couldn't remove them — please try again.");
    }
  };

  const [removeTarget, setRemoveTarget] = useState(null);

  const confirmRemove = async () => {
    if (!removeTarget) return;
    await removeMember(removeTarget.id, `${displayName(removeTarget)} removed.`);
    setRemoveTarget(null);
  };

  const columns = [
    {
      key: "name",
      header: "Member",
      render: (m) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            {m.avatarUrl ? <AvatarImage src={m.avatarUrl} alt="" /> : null}
            <AvatarFallback
              className={`border text-xs font-medium ${roleStyle(m.role).avatar}`}
            >
              {initials(displayName(m))}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {displayName(m)}
              {m.userId && m.userId === user?.id ? (
                <span className="ml-1.5 text-xs font-normal text-text-tertiary">
                  You
                </span>
              ) : null}
            </p>
            <p className="truncate text-xs text-text-secondary">{m.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (m) => <RoleBadge role={m.role} />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (m) => (
        <ActionMenu
          label="Member actions"
          items={[
            { icon: Pencil, label: "Edit details", onSelect: () => openEdit(m) },
            { separator: true },
            ...(m.role === "Owner"
              ? []
              : EVENT_TEAM_ROLES.filter(
                  (r) => r.value !== "Owner" && r.value !== m.role,
                ).map((r) => ({
                  key: r.value,
                  label: `Make ${r.value}`,
                  onSelect: () => changeRole(m.id, r.value),
                }))),
            { separator: true },
            m.role !== "Owner" && {
              label: "Remove from event",
              variant: "destructive",
              onSelect: () => setRemoveTarget(m),
            },
          ]}
        />
      ),
    },
  ];

  const filtering = search.trim() || roleFilter !== "all";

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Co-hosts & Admins"}
        description={
          loading
            ? "Loading who has access to this event…"
            : `${members.length} ${members.length === 1 ? "person has" : "people have"} access to this event.`
        }
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={() => setRosterOpen(true)}
            >
              <UserPlus className="h-4 w-4" /> Add from team
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={openAdd}
            >
              <Plus className="h-4 w-4" /> Add member
            </Button>
          </div>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-10 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading team…
        </div>
      ) : members.length ? (
        <div className="space-y-3">
          <Toolbar>
            <FilterDropdown
              value={roleFilter}
              onValueChange={setRoleFilter}
              options={EVENT_TEAM_ROLE_FILTER_OPTIONS}
            />
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search people…"
            />
          </Toolbar>
          <DataTable
            columns={columns}
            data={filtered}
            getRowKey={(m) => m.id}
            empty={
              <EmptyState
                icon={Users}
                title="No people match"
                description="Try a different role or search term."
                action={
                  <Button
                    variant="outline"
                    className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                    onClick={() => {
                      setSearch("");
                      setRoleFilter("all");
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            }
          />
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={Users}
            title="No one has access yet"
            description="Add a teammate from your project roster, or add a co-host directly."
            action={
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={openAdd}
              >
                <Plus className="h-4 w-4" /> Add member
              </Button>
            }
          />
        </div>
      )}

      <Dialog open={rosterOpen} onOpenChange={setRosterOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add from team</DialogTitle>
            <DialogDescription>
              Give people already on this project access to this event.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Field label="Role">
              <Select value={rosterRole} onValueChange={setRosterRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TEAM_ROLES.filter((r) => r.value !== "Owner").map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="People">
              {available.length ? (
                <div className="scrollbar-subtle max-h-64 space-y-1 overflow-y-auto pr-1">
                  {available.map((r) => {
                    const picked = rosterPicked.includes(r.id);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() =>
                          setRosterPicked((prev) =>
                            picked
                              ? prev.filter((x) => x !== r.id)
                              : [...prev, r.id],
                          )
                        }
                        className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                          picked
                            ? "border-border-strong bg-surface-active"
                            : "border-border bg-surface-card hover:bg-surface-hover"
                        }`}
                      >
                        <Avatar className="h-7 w-7">
                          {r.avatarUrl ? <AvatarImage src={r.avatarUrl} alt="" /> : null}
                          <AvatarFallback className="border border-border bg-surface-subtle text-[10px] font-medium text-muted-foreground">
                            {initials(r.name || r.email || "?")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-foreground">
                            {r.name || r.email}
                          </p>
                          <p className="truncate text-xs text-text-secondary">
                            {r.email}
                          </p>
                        </div>
                        {picked ? (
                          <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-lg border border-border bg-surface-card px-3 py-3 text-xs text-text-secondary">
                  Everyone on this project already has access. Use Add member to
                  bring in someone from outside it.
                </p>
              )}
            </Field>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={() => setRosterOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={adding || !rosterPicked.length}
              onClick={addFromRoster}
            >
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Add
              {rosterPicked.length ? ` ${rosterPicked.length}` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit member" : "Add member"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update how this person appears on the event team."
                : "Give someone access to help run this event. They get it straight away — there's nothing to accept."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Field
              label="Photo"
              hint="Optional — their initials are used when there's no photo."
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-14 w-14">
                  {form.avatarUrl ? (
                    <AvatarImage src={form.avatarUrl} alt="" />
                  ) : null}
                  <AvatarFallback
                    className={`border text-sm font-medium ${roleStyle(form.role).avatar}`}
                  >
                    {initials(form.name || form.email || "?")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploading}
                    className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                    onClick={() =>
                      document.getElementById("cohost-avatar-input")?.click()
                    }
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ImagePlus className="h-4 w-4" />
                    )}
                    {form.avatarUrl ? "Replace" : "Upload"}
                  </Button>
                  {form.avatarUrl ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-text-secondary hover:bg-red-500/10 hover:text-red-400"
                      onClick={() => setForm((f) => ({ ...f, avatarUrl: "" }))}
                    >
                      <X className="h-4 w-4" /> Remove
                    </Button>
                  ) : null}
                </div>
                <input
                  id="cohost-avatar-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    pickAvatar(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </div>
            </Field>
            <Field label="Name">
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    saveMember();
                  }
                }}
                placeholder="Alex Morgan"
              />
            </Field>
            <Field label="Email address" hint="Optional.">
              <Input
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                placeholder="teammate@example.com"
              />
            </Field>
            {editingId && form.role === "Owner" ? null : (
              <Field label="Role">
                <Select
                  value={form.role}
                  onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_TEAM_ROLES.filter((r) => r.value !== "Owner").map(
                      (r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.value}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <p className="rounded-lg border border-border bg-surface-card px-3 py-2 text-xs text-text-secondary">
              {roleStyle(form.role).description}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={() => setFormOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={saving || uploading}
              onClick={saveMember}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editingId ? "Save changes" : "Add member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove from event</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove{" "}
              <span className="font-medium text-foreground">
                {removeTarget ? displayName(removeTarget) : ""}
              </span>{" "}
              from this event? They will lose access immediately. This action
              can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRemoveTarget(null)}>
              Cancel
            </Button>
            <Button
              className="bg-red-500/90 text-white hover:bg-red-500"
              onClick={confirmRemove}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
