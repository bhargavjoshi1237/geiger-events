"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Mail,
  MoreHorizontal,
  Crown,
  ShieldCheck,
  Users,
  ScanLine,
  Eye,
  Loader2,
  UserPlus,
  Check,
} from "lucide-react";

import {
  DataTable,
  Field,
  SectionCard,
  EditorSectionHeader,
  EmptyState,
  Toolbar,
  SearchInput,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  EVENT_TEAM_ROLES,
  EVENT_TEAM_ROLE_MAP,
  EVENT_TEAM_ROLE_FILTER_OPTIONS,
  initials,
} from "./sample_data";
import { formatRelativeTime } from "@/components/internal/screens/settings/constants";
import { getUser } from "@/lib/supabase/user";
import { listMembers } from "@/lib/supabase/team";
import {
  listEventTeam,
  addEventTeamMember,
  updateEventTeamMember,
  resendEventTeamInvite,
  softDeleteEventTeamMember,
} from "@/lib/supabase/event_team";

// Lucide components for the icon names carried by EVENT_TEAM_ROLES.
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

// Display name for a grant — invited outsiders only have an email until they join.
function displayName(m) {
  return m.name || m.email.split("@")[0] || "Teammate";
}

export function CoHostsAdminsSection({ event, headerItem }) {
  const eventId = event?.id;
  const projectId = event?.projectId || null;

  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roster, setRoster] = useState([]);
  const [user, setUser] = useState(null);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState({ email: "", role: "Co-host" });
  const [rosterOpen, setRosterOpen] = useState(false);
  const [rosterRole, setRosterRole] = useState("Co-host");
  const [rosterPicked, setRosterPicked] = useState([]);
  const [adding, setAdding] = useState(false);

  // Load the grants, the project roster (for the picker) and the signed-in user.
  // A brand-new event has no grants yet — bootstrap the viewer as Owner so the
  // event always has one, matching the "creator owns it" rule.
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

  const members = useMemo(
    () => team.filter((m) => m.status !== "invited"),
    [team],
  );
  const pending = useMemo(
    () => team.filter((m) => m.status === "invited"),
    [team],
  );

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

  // Roster people who don't already hold a grant on this event.
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

  const sendInvite = async () => {
    const email = invite.email.trim().toLowerCase();
    if (!email.includes("@")) {
      toast.error("Enter a valid email address.");
      return;
    }
    if (team.some((m) => m.email.toLowerCase() === email)) {
      toast.error("That person already has access to this event.");
      return;
    }
    const optimistic = {
      id: crypto.randomUUID(),
      eventId,
      projectId,
      role: invite.role,
      status: "invited",
      name: "",
      email,
      invitedAt: new Date().toISOString(),
    };
    setTeam((prev) => [...prev, optimistic]);
    setInvite({ email: "", role: "Co-host" });
    setInviteOpen(false);

    const saved = await addEventTeamMember({
      ...optimistic,
      invitedBy: user?.id ?? null,
      createdBy: user?.id ?? null,
    });
    if (saved) {
      setTeam((prev) => prev.map((m) => (m.id === saved.id ? saved : m)));
      toast.success("Invitation sent.");
    } else {
      setTeam((prev) => prev.filter((m) => m.id !== optimistic.id));
      toast.error("Couldn't send the invitation.");
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

  const resend = async (id) => {
    const saved = await resendEventTeamInvite(id);
    if (saved) {
      setTeam((prev) => prev.map((m) => (m.id === saved.id ? saved : m)));
      toast.success("Invitation re-sent.");
    } else {
      toast.error("Couldn't re-send the invitation.");
    }
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Member actions"
              disabled={m.role === "Owner"}
              className="text-muted-foreground hover:bg-surface-active hover:text-foreground disabled:opacity-30"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="border-border bg-surface-subtle text-foreground"
          >
            {EVENT_TEAM_ROLES.filter(
              (r) => r.value !== "Owner" && r.value !== m.role,
            ).map((r) => (
              <DropdownMenuItem
                key={r.value}
                className="focus:bg-surface-hover"
                onClick={() => changeRole(m.id, r.value)}
              >
                Make {r.value}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator className="bg-surface-hover" />
            <DropdownMenuItem
              variant="destructive"
              className="text-red-400 focus:bg-red-500/10 focus:text-red-400"
              onClick={() => removeMember(m.id, "Member removed.")}
            >
              Remove from event
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
              onClick={() => setInviteOpen(true)}
            >
              <Plus className="h-4 w-4" /> Invite member
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
            description="Add a teammate from your project roster, or invite someone by email."
            action={
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => setInviteOpen(true)}
              >
                <Plus className="h-4 w-4" /> Invite member
              </Button>
            }
          />
        </div>
      )}

      {pending.length ? (
        <SectionCard title="Pending invitations">
          <div className="space-y-2">
            {pending.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-surface-card px-3 py-3"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface-subtle text-muted-foreground">
                  <Mail className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {p.email}
                  </p>
                  <p className="text-xs text-text-secondary">
                    Invited {formatRelativeTime(p.invitedAt)}
                  </p>
                </div>
                <RoleBadge role={p.role} />
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-text-secondary hover:bg-surface-active hover:text-foreground"
                  onClick={() => resend(p.id)}
                >
                  Resend
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-text-secondary hover:bg-red-500/10 hover:text-red-400"
                  onClick={() => removeMember(p.id, "Invitation revoked.")}
                >
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}

      {/* Add existing project members ---------------------------------------- */}
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
                  Everyone on this project already has access. Invite someone new
                  by email instead.
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

      {/* Invite by email ------------------------------------------------------ */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite member</DialogTitle>
            <DialogDescription>
              They&apos;ll get an email to help run this event with the role you pick.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Field label="Email address">
              <Input
                type="email"
                value={invite.email}
                onChange={(e) =>
                  setInvite((i) => ({ ...i, email: e.target.value }))
                }
                placeholder="teammate@example.com"
              />
            </Field>
            <Field label="Role">
              <Select
                value={invite.role}
                onValueChange={(v) => setInvite((i) => ({ ...i, role: v }))}
              >
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
            <p className="rounded-lg border border-border bg-surface-card px-3 py-2 text-xs text-text-secondary">
              {roleStyle(invite.role).description}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={() => setInviteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={sendInvite}
            >
              Send invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
