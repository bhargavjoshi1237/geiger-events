"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  UserPlus,
  MoreHorizontal,
  Trash2,
  Ban,
  CircleCheck,
  Users,
  Plus,
  ShieldCheck,
  Clock,
  ChevronDown,
  Globe,
} from "lucide-react";
import { matchesAny } from "@geiger/rbac";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  ScreenHeader,
  StatsBar,
  SectionCard,
  DataTable,
  StatusPill,
  EmptyState,
  Toolbar,
  SearchInput,
  Field,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useProject } from "@/context/project-context";
import { useRbac } from "@/context/rbac-context";
import { getUser } from "@/lib/supabase/user";
import {
  ensureSystemRoles,
  listGrants,
  revokeGrant,
  setMemberRole,
  updateGrantScope,
} from "@/lib/supabase/rbac";
import { listEvents } from "@/lib/supabase/events";
import {
  listMembers,
  inviteMember,
  updateMember,
  softDeleteMember,
  listGroups,
  createGroup,
  listActivity,
  logActivity,
  syncTeam,
} from "@/lib/supabase/team";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import {
  MEMBER_STATUS_MAP,
  MEMBER_STATUS_FILTER_OPTIONS,
  ACTIVITY_ACTION_MAP,
  PERMISSION_GROUPS,
  DEFAULT_SEAT_LIMIT,
  formatDate,
  formatRelativeTime,
  initialsOf,
} from "./constants";

const TABS = [
  { key: "members", label: "Members" },
  { key: "invitations", label: "Invitations" },
  { key: "groups", label: "Groups" },
  { key: "activity", label: "Activity" },
];

export function TeamMembersScreen() {
  const { projectId } = useProject();
  const { can, userId: myUserId, refresh: refreshRbac } = useRbac();

  const canInvite = can("events.team.invite");
  const canAssign = can("events.team.assign");

  const [members, setMembers] = useState([]);
  const [roles, setRoles] = useState([]);
  // What @geiger/rbac actually reads. The roster above is display; these are the
  // rows that decide access.
  const [grants, setGrants] = useState([]);
  // Scope targets. A grant may be narrowed to specific events, so the drawer
  // needs the project's events to offer them.
  const [events, setEvents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [userName, setUserName] = useState("");

  const [tab, setTab] = useState("members");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  // Deep-link from Roles & Permissions stashes a role id to pre-filter on. Read
  // it once as the initial value (client-only) and clear it so it doesn't stick.
  const [roleFilter, setRoleFilter] = useState(() => {
    if (typeof window === "undefined") return "all";
    try {
      const stashed = window.sessionStorage.getItem("team:roleFilter");
      if (stashed) {
        window.sessionStorage.removeItem("team:roleFilter");
        return stashed;
      }
    } catch {
      // ignore storage failures
    }
    return "all";
  });
  const [groupFilter, setGroupFilter] = useState("all");

  const [inviteOpen, setInviteOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [openMemberId, setOpenMemberId] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);

  const seatLimit = DEFAULT_SEAT_LIMIT;

  useEffect(() => {
    let alive = true;
    getUser().then((u) => {
      if (!alive) return;
      setUserId(u?.id || null);
      setUserName(u?.name || "");
    });
    (async () => {
      // Fills any missing system role from geiger-rbac.config.js; a no-op once
      // the project has them all.
      const rolesList = (await ensureSystemRoles(projectId, null)) ?? [];
      const defaultRole =
        rolesList.find((r) => r.key === "member") ||
        rolesList[rolesList.length - 1] ||
        null;
      // Project real org members into the overlay, then read the roster.
      await syncTeam(projectId, defaultRole?.id ?? null);
      const memberRows = await listMembers(projectId);
      if (!alive) return;
      setRoles(rolesList);
      setMembers(memberRows ?? []);
      setLoading(false);
    })();
    listGroups(projectId).then((rows) => alive && setGroups(rows ?? []));
    listActivity(projectId).then((rows) => alive && setActivity(rows ?? []));
    listGrants(projectId).then((rows) => alive && setGrants(rows ?? []));
    listEvents(projectId).then((rows) => alive && setEvents(rows ?? []));
    return () => {
      alive = false;
    };
  }, [projectId]);

  const roleById = useMemo(() => {
    const map = {};
    roles.forEach((r) => (map[r.id] = r));
    return map;
  }, [roles]);

  // A member's ACTIVE grant is the authority on what they can do; the roster's
  // own role_id is only a display fallback for an invited person who has no
  // account yet and so has nothing to grant to.
  const grantByUser = useMemo(() => {
    const map = {};
    for (const g of grants) {
      if (g.userId && g.status === "active" && !g.deletedAt) map[g.userId] = g;
    }
    return map;
  }, [grants]);

  const roleIdOf = React.useCallback(
    (member) =>
      (member.userId && grantByUser[member.userId]?.roleId) || member.roleId || null,
    [grantByUser],
  );

  // Owner is whichever role holds the wildcard. Demoting or removing the last
  // one would leave the workspace with nobody able to administer it.
  const ownerRoleIds = useMemo(
    () =>
      new Set(
        roles.filter((r) => (r.permissions || []).includes("*")).map((r) => r.id),
      ),
    [roles],
  );

  const ownerCount = useMemo(
    () =>
      Object.values(grantByUser).filter((g) => ownerRoleIds.has(g.roleId)).length,
    [grantByUser, ownerRoleIds],
  );

  const isLastOwner = React.useCallback(
    (member) => ownerRoleIds.has(roleIdOf(member)) && ownerCount <= 1,
    [ownerRoleIds, roleIdOf, ownerCount],
  );

  const groupById = useMemo(() => {
    const map = {};
    groups.forEach((g) => (map[g.id] = g));
    return map;
  }, [groups]);

  const memberCountByGroup = useMemo(() => {
    const map = {};
    members.forEach((m) =>
      (m.groupIds || []).forEach((id) => (map[id] = (map[id] || 0) + 1)),
    );
    return map;
  }, [members]);

  const activeMembers = useMemo(
    () => members.filter((m) => m.status !== "invited"),
    [members],
  );
  const invites = useMemo(
    () => members.filter((m) => m.status === "invited"),
    [members],
  );

  const seatsUsed = members.filter((m) => m.status !== "suspended").length;
  const seatsFull = seatsUsed >= seatLimit;

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activeMembers.filter((m) => {
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      if (roleFilter !== "all" && roleIdOf(m) !== roleFilter) return false;
      if (groupFilter !== "all" && !(m.groupIds || []).includes(groupFilter))
        return false;
      if (q && !`${m.name} ${m.email}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [activeMembers, search, statusFilter, roleFilter, groupFilter, roleIdOf]);

  const stats = useMemo(
    () => [
      { label: "Active members", value: String(activeMembers.length) },
      { label: "Pending invites", value: String(invites.length) },
      { label: "Seats used", value: `${seatsUsed} / ${seatLimit}` },
      { label: "Groups", value: String(groups.length) },
    ],
    [activeMembers.length, invites.length, seatsUsed, seatLimit, groups.length],
  );

  const openMember = useMemo(
    () => members.find((m) => m.id === openMemberId) || null,
    [members, openMemberId],
  );

  // --- Mutations -----------------------------------------------------------

  const audit = (action, target, detail) =>
    logActivity({
      projectId,
      actorUserId: userId,
      actorName: userName,
      targetMemberId: target?.id ?? null,
      targetName: target?.name || target?.email || "",
      action,
      detail: detail ?? {},
    }).then((row) => row && setActivity((prev) => [row, ...prev]));

  const patchMember = (id, patch) =>
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  // The grant is the write that matters — it is what @geiger/rbac and every RLS
  // policy read. project_members is updated alongside it purely so the roster
  // keeps showing the right role for an invited person who has no account yet
  // (and therefore nothing to grant to).
  const changeRole = async (member, roleId) => {
    if (!canAssign) {
      toast.error("You don't have permission to assign roles.");
      return;
    }
    const prevRole = roleIdOf(member);
    if (prevRole === roleId) return;
    if (isLastOwner(member) && !ownerRoleIds.has(roleId)) {
      toast.error(
        "This is the workspace's last owner — give someone else the Owner role first.",
      );
      return;
    }

    patchMember(member.id, { roleId });
    const saved = await updateMember(member.id, { roleId });
    if (!saved) {
      patchMember(member.id, { roleId: prevRole });
      toast.error("Couldn't change the role.");
      return;
    }

    if (member.userId) {
      const granted = await setMemberRole({
        projectId,
        userId: member.userId,
        roleId,
        grantedBy: userId,
        currentGrants: grants,
      });
      if (granted) {
        setGrants((prev) => [
          ...prev.filter((g) => g.userId !== member.userId),
          granted,
        ]);
        // Changing your own role changes your own nav.
        if (member.userId === myUserId) refreshRbac();
      } else {
        patchMember(member.id, { roleId: prevRole });
        await updateMember(member.id, { roleId: prevRole });
        toast.error("Couldn't change their access — the role is unchanged.");
        return;
      }
    }
    audit("role_changed", member, { role: roleById[roleId]?.name });
  };

  // Scope is the half of authorization customers own: the catalog says a
  // permission is scopeBy "event", and this narrows one person's grant to the
  // events they actually work on. An empty list means the whole project.
  const setMemberScope = async (member, eventIds) => {
    if (!canAssign) {
      toast.error("You don't have permission to change access.");
      return;
    }
    const grant = member.userId ? grantByUser[member.userId] : null;
    if (!grant) {
      toast.error("They need to sign in once before their access can be narrowed.");
      return;
    }
    const scope = eventIds.length ? { event: eventIds } : {};
    const previous = grant.scope;
    setGrants((prev) =>
      prev.map((g) => (g.id === grant.id ? { ...g, scope } : g)),
    );
    const saved = await updateGrantScope(grant.id, scope);
    if (saved) {
      if (member.userId === myUserId) refreshRbac();
      audit("role_changed", member, {
        role: eventIds.length ? `${eventIds.length} event(s)` : "all events",
      });
    } else {
      setGrants((prev) =>
        prev.map((g) => (g.id === grant.id ? { ...g, scope: previous } : g)),
      );
      toast.error("Couldn't update their event access.");
    }
  };

  const toggleSuspend = async (member) => {
    const next = member.status === "suspended" ? "active" : "suspended";
    patchMember(member.id, { status: next });
    const saved = await updateMember(member.id, { status: next });
    if (saved) {
      audit(next === "suspended" ? "suspended" : "status_changed", member, {
        status: next,
      });
    } else {
      patchMember(member.id, { status: member.status });
      toast.error("Couldn't update the member.");
    }
  };

  const setMemberGroups = async (member, groupIds) => {
    patchMember(member.id, { groupIds });
    const saved = await updateMember(member.id, { groupIds });
    if (saved) audit("group_changed", member);
    else {
      patchMember(member.id, { groupIds: member.groupIds });
      toast.error("Couldn't update groups.");
    }
  };

  const confirmRemove = async () => {
    const member = removeTarget;
    setRemoveTarget(null);
    if (!member) return;
    if (isLastOwner(member)) {
      toast.error(
        "This is the workspace's last owner — give someone else the Owner role first.",
      );
      return;
    }
    setMembers((prev) => prev.filter((m) => m.id !== member.id));
    if (openMemberId === member.id) setOpenMemberId(null);

    // Revoking the grant is the part that actually removes access; dropping the
    // roster row alone would leave them fully authorized but invisible. The
    // revoked row is also what stops the join bootstrap handing the role back.
    const grant = member.userId ? grantByUser[member.userId] : null;
    if (grant) {
      if (await revokeGrant(grant.id)) {
        setGrants((prev) => prev.filter((g) => g.id !== grant.id));
      } else {
        setMembers((prev) => [...prev, member]);
        toast.error("Couldn't revoke their access — nothing was removed.");
        return;
      }
    }

    const ok = await softDeleteMember(member.id);
    if (ok) {
      audit("removed", member);
      toast.success("Member removed");
    } else {
      setMembers((prev) => [...prev, member]);
      toast.error("Couldn't remove the member.");
    }
  };

  const handleInvite = async (emails, roleId, groupId, message) => {
    const list = emails
      .split(/[\s,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (!list.length) {
      toast.error("Enter at least one email.");
      return;
    }
    if (seatsUsed + list.length > seatLimit) {
      toast.error("Not enough seats for that many invites.");
      return;
    }
    setInviteOpen(false);
    for (const email of list) {
      const id = crypto.randomUUID();
      const optimistic = {
        id,
        projectId,
        userId: null,
        roleId,
        status: "invited",
        email,
        name: "",
        avatarUrl: "",
        groupIds: groupId && groupId !== "none" ? [groupId] : [],
        invitedBy: userId,
        invitedAt: new Date().toISOString(),
        metadata: message ? { message } : {},
      };
      setMembers((prev) => [...prev, optimistic]);
      const saved = await inviteMember(optimistic);
      if (saved) {
        setMembers((prev) => prev.map((m) => (m.id === id ? saved : m)));
        audit("invited", optimistic, { email });
      } else {
        setMembers((prev) => prev.filter((m) => m.id !== id));
        toast.error(`Couldn't invite ${email}.`);
      }
    }
    toast.success(list.length === 1 ? "Invitation sent" : `${list.length} invitations sent`);
  };

  const revokeInvite = async (member) => {
    setMembers((prev) => prev.filter((m) => m.id !== member.id));
    const ok = await softDeleteMember(member.id);
    if (!ok) {
      setMembers((prev) => [...prev, member]);
      toast.error("Couldn't revoke the invite.");
    } else {
      toast.success("Invitation revoked");
    }
  };

  const handleCreateGroup = async (name, description) => {
    if (!name.trim()) {
      toast.error("Name the group.");
      return;
    }
    setGroupOpen(false);
    const id = crypto.randomUUID();
    const optimistic = {
      id,
      projectId,
      name: name.trim(),
      description,
      createdBy: userId,
    };
    setGroups((prev) => [...prev, optimistic]);
    const saved = await createGroup(optimistic);
    if (saved) {
      setGroups((prev) => prev.map((g) => (g.id === id ? saved : g)));
      audit("group_created", { name: optimistic.name });
      toast.success("Group created");
    } else {
      setGroups((prev) => prev.filter((g) => g.id !== id));
      toast.error("Couldn't create the group.");
    }
  };

  // --- Render --------------------------------------------------------------

  const inviteAction = canInvite ? (
    <Button
      onClick={() => (seatsFull ? toast.error("All seats are in use.") : setInviteOpen(true))}
      className="bg-primary text-primary-foreground"
      disabled={seatsFull}
    >
      <UserPlus className="h-4 w-4" /> Invite people
    </Button>
  ) : null;

  const roleFilterOptions = [
    { value: "all", label: "All Roles" },
    ...roles.map((r) => ({ value: r.id, label: r.name })),
  ];
  const groupFilterOptions = [
    { value: "all", label: "All Groups" },
    ...groups.map((g) => ({ value: g.id, label: g.name })),
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Team & Members"
        description="Manage who has access to this workspace and what they can do."
        actions={inviteAction}
      />

      <StatsBar stats={stats} />

      {!canAssign ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-border bg-surface-card px-3.5 py-2.5 text-xs leading-relaxed text-text-secondary">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-tertiary" />
          <p>
            You can see who is on the team, but changing roles or access needs the
            <span className="text-foreground"> Assign roles </span>
            permission.
          </p>
        </div>
      ) : null}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map((t) => {
          const count =
            t.key === "invitations"
              ? invites.length
              : t.key === "groups"
                ? groups.length
                : null;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "relative px-3 py-2 text-sm font-medium transition-colors",
                tab === t.key
                  ? "text-foreground"
                  : "text-text-secondary hover:text-foreground",
              )}
            >
              {t.label}
              {count ? (
                <span className="ml-1.5 text-xs text-text-tertiary">{count}</span>
              ) : null}
              {tab === t.key ? (
                <span className="absolute inset-x-0 -bottom-px h-0.5 bg-primary" />
              ) : null}
            </button>
          );
        })}
      </div>

      {loading ? (
        <SectionCard>
          <div className="py-16 text-center text-sm text-text-secondary">
            Loading team…
          </div>
        </SectionCard>
      ) : tab === "members" ? (
        <MembersTab
          members={filteredMembers}
          total={activeMembers.length}
          roleById={roleById}
          roleIdOf={roleIdOf}
          grantByUser={grantByUser}
          canAssign={canAssign}
          groupById={groupById}
          roles={roles}
          search={search}
          setSearch={setSearch}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          roleFilter={roleFilter}
          setRoleFilter={setRoleFilter}
          groupFilter={groupFilter}
          setGroupFilter={setGroupFilter}
          roleFilterOptions={roleFilterOptions}
          groupFilterOptions={groupFilterOptions}
          onOpen={(m) => setOpenMemberId(m.id)}
          onChangeRole={changeRole}
          onToggleSuspend={toggleSuspend}
          onRemove={setRemoveTarget}
          onInvite={() => setInviteOpen(true)}
        />
      ) : tab === "invitations" ? (
        <InvitationsTab
          invites={invites}
          roleById={roleById}
          onRevoke={revokeInvite}
          onInvite={() => (seatsFull ? toast.error("All seats are in use.") : setInviteOpen(true))}
        />
      ) : tab === "groups" ? (
        <GroupsTab
          groups={groups}
          counts={memberCountByGroup}
          onCreate={() => setGroupOpen(true)}
        />
      ) : (
        <ActivityTab activity={activity} />
      )}

      <InviteDialog
        key={inviteOpen ? "invite-open" : "invite-closed"}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        roles={roles}
        groups={groups}
        onSubmit={handleInvite}
      />

      <GroupDialog
        key={groupOpen ? "group-open" : "group-closed"}
        open={groupOpen}
        onOpenChange={setGroupOpen}
        onSubmit={handleCreateGroup}
      />

      <MemberDrawer
        member={openMember}
        role={openMember ? roleById[roleIdOf(openMember)] : null}
        grant={openMember?.userId ? grantByUser[openMember.userId] : null}
        roles={roles}
        groups={groups}
        events={events}
        canAssign={canAssign}
        isLastOwner={openMember ? isLastOwner(openMember) : false}
        onOpenChange={(o) => !o && setOpenMemberId(null)}
        onChangeRole={changeRole}
        onSetGroups={setMemberGroups}
        onSetScope={setMemberScope}
        onToggleSuspend={toggleSuspend}
        onRemove={setRemoveTarget}
      />

      <Dialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove member</DialogTitle>
            <DialogDescription>
              {removeTarget
                ? `Remove ${removeTarget.name || removeTarget.email} from this workspace? They lose access immediately.`
                : ""}
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
              Remove member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainScreenWrapper>
  );
}

// --- Role pill (inline picker) ----------------------------------------------

function RolePill({ role, roles, onChange, disabled }) {
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={disabled}>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-card px-2 py-1 text-xs font-medium text-foreground hover:bg-surface-hover disabled:opacity-60"
          >
            {role?.name || "No role"}
            {!disabled ? <ChevronDown className="h-3 w-3 text-text-tertiary" /> : null}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="border-border bg-surface-subtle">
          <DropdownMenuLabel className="text-xs text-text-tertiary">
            Assign role
          </DropdownMenuLabel>
          {roles.map((r) => (
            <DropdownMenuItem
              key={r.id}
              onClick={() => onChange(r.id)}
              className="cursor-pointer gap-2 focus:bg-surface-hover"
            >
              {r.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function GroupChips({ ids, groupById }) {
  if (!ids?.length) return <span className="text-xs text-text-tertiary">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {ids.map((id) => {
        const g = groupById[id];
        if (!g) return null;
        return (
          <Badge key={id} variant="neutral">
            {g.name}
          </Badge>
        );
      })}
    </div>
  );
}

function MemberCell({ member }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar className="h-8 w-8">
        {member.avatarUrl ? <AvatarImage src={member.avatarUrl} alt={member.name} /> : null}
        <AvatarFallback className="bg-surface-card text-xs text-text-secondary">
          {initialsOf(member.name, member.email)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">
          {member.name || member.email.split("@")[0]}
        </p>
        <p className="truncate text-xs text-text-tertiary">{member.email}</p>
      </div>
    </div>
  );
}

// --- Members tab ------------------------------------------------------------

function MembersTab({
  members,
  total,
  roleById,
  roleIdOf,
  grantByUser,
  canAssign,
  groupById,
  roles,
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  roleFilter,
  setRoleFilter,
  groupFilter,
  setGroupFilter,
  roleFilterOptions,
  groupFilterOptions,
  onOpen,
  onChangeRole,
  onToggleSuspend,
  onRemove,
  onInvite,
}) {
  const columns = [
    {
      key: "member",
      header: "Member",
      render: (m) => <MemberCell member={m} />,
    },
    {
      key: "role",
      header: "Role",
      render: (m) => (
        <RolePill
          role={roleById[roleIdOf(m)]}
          roles={roles}
          disabled={!canAssign}
          onChange={(roleId) => onChangeRole(m, roleId)}
        />
      ),
    },
    {
      key: "access",
      header: "Access",
      render: (m) => {
        const scoped = m.userId ? grantByUser[m.userId]?.scope?.event : null;
        return (
          <span className="text-xs text-text-secondary">
            {scoped?.length
              ? `${scoped.length} event${scoped.length === 1 ? "" : "s"}`
              : "All Events"}
          </span>
        );
      },
    },
    {
      key: "groups",
      header: "Groups",
      render: (m) => <GroupChips ids={m.groupIds} groupById={groupById} />,
    },
    {
      key: "status",
      header: "Status",
      render: (m) => <StatusPill status={m.status} map={MEMBER_STATUS_MAP} />,
    },
    {
      key: "lastActive",
      header: "Last active",
      render: (m) => (
        <span className="text-xs text-text-secondary">
          {formatRelativeTime(m.lastActiveAt)}
        </span>
      ),
    },
    {
      key: "joined",
      header: "Joined",
      render: (m) => (
        <span className="text-xs text-text-secondary">{formatDate(m.joinedAt)}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (m) => (
        <div onClick={(e) => e.stopPropagation()} className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Member actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="border-border bg-surface-subtle">
              <DropdownMenuItem onClick={() => onOpen(m)} className="cursor-pointer focus:bg-surface-hover">
                <Users className="h-4 w-4" /> Manage
              </DropdownMenuItem>
              {canAssign ? (
                <>
                  <DropdownMenuItem onClick={() => onToggleSuspend(m)} className="cursor-pointer focus:bg-surface-hover">
                    {m.status === "suspended" ? (
                      <>
                        <CircleCheck className="h-4 w-4" /> Reactivate
                      </>
                    ) : (
                      <>
                        <Ban className="h-4 w-4" /> Suspend
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onRemove(m)}
                    className="cursor-pointer text-red-400 focus:bg-red-500/10 focus:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" /> Remove
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  const filtersActive =
    statusFilter !== "all" || roleFilter !== "all" || groupFilter !== "all" || !!search;

  return (
    <div className="space-y-4">
      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown
            value={roleFilter}
            onValueChange={setRoleFilter}
            options={roleFilterOptions}
            placeholder="All Roles"
            height="h-9"
          />
          <FilterDropdown
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={MEMBER_STATUS_FILTER_OPTIONS}
            placeholder="All Statuses"
            height="h-9"
          />
          <FilterDropdown
            value={groupFilter}
            onValueChange={setGroupFilter}
            options={groupFilterOptions}
            placeholder="All Groups"
            height="h-9"
          />
        </div>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search name or email…"
        />
      </Toolbar>

      <DataTable
        columns={columns}
        data={members}
        getRowKey={(m) => m.id}
        onRowClick={onOpen}
        empty={
          total === 0 ? (
            <EmptyState
              icon={Users}
              title="No members yet"
              description="Invite teammates to collaborate on this workspace."
              action={
                <Button onClick={onInvite} className="bg-primary text-primary-foreground">
                  <UserPlus className="h-4 w-4" /> Invite people
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Users}
              title="No matching members"
              description={filtersActive ? "Try clearing your filters." : "Nothing here."}
            />
          )
        }
      />
    </div>
  );
}

// --- Invitations tab --------------------------------------------------------

function InvitationsTab({ invites, roleById, onRevoke, onInvite }) {
  if (!invites.length) {
    return (
      <SectionCard>
        <EmptyState
          icon={Clock}
          title="No pending invitations"
          description="Invited people who haven't joined yet appear here."
          action={
            <Button onClick={onInvite} className="bg-primary text-primary-foreground">
              <UserPlus className="h-4 w-4" /> Invite people
            </Button>
          }
        />
      </SectionCard>
    );
  }
  return (
    <SectionCard bodyPadding={false} contentClassName="p-2">
      <SettingsList className="px-3">
        {invites.map((m) => {
          const role = roleById[m.roleId];
          return (
            <div key={m.id} className="flex items-center justify-between gap-4 py-3.5">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-surface-card text-xs text-text-secondary">
                    {initialsOf("", m.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{m.email}</p>
                  <p className="text-xs text-text-tertiary">
                    Invited {formatRelativeTime(m.invitedAt)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="neutral">{role?.name || "No role"}</Badge>
                <Button variant="outline" size="sm" onClick={() => onRevoke(m)}>
                  Revoke
                </Button>
              </div>
            </div>
          );
        })}
      </SettingsList>
    </SectionCard>
  );
}

// --- Groups tab -------------------------------------------------------------

function GroupsTab({ groups, counts, onCreate }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={onCreate}>
          <Plus className="h-4 w-4" /> New Group
        </Button>
      </div>
      {groups.length === 0 ? (
        <SectionCard>
          <EmptyState
            icon={Users}
            title="No groups yet"
            description="Group members into sub-teams like Check-in staff or Marketing."
            action={
              <Button onClick={onCreate} className="bg-primary text-primary-foreground">
                <Plus className="h-4 w-4" /> New Group
              </Button>
            }
          />
        </SectionCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <SectionCard key={g.id}>
              <p className="truncate text-sm font-semibold text-foreground">{g.name}</p>
              {g.description ? (
                <p className="mt-0.5 text-xs text-text-secondary">{g.description}</p>
              ) : null}
              <p className="mt-2 text-xs text-text-tertiary">
                {counts[g.id] || 0} member{(counts[g.id] || 0) === 1 ? "" : "s"}
              </p>
            </SectionCard>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Activity tab -----------------------------------------------------------

function ActivityTab({ activity }) {
  if (!activity.length) {
    return (
      <SectionCard>
        <EmptyState
          icon={Clock}
          title="No activity yet"
          description="Invites, role changes and removals will show up here."
        />
      </SectionCard>
    );
  }
  return (
    <SectionCard bodyPadding={false} contentClassName="p-4">
      <ol className="space-y-4">
        {activity.map((a) => {
          const meta = ACTIVITY_ACTION_MAP[a.action] || {
            label: a.action,
            icon: Clock,
            tone: "text-text-secondary",
          };
          const Icon = meta.icon;
          return (
            <li key={a.id} className="flex gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-surface-card">
                <Icon className={cn("h-3.5 w-3.5", meta.tone)} />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-foreground">
                  <span className="font-medium">{a.actorName || "Someone"}</span>{" "}
                  <span className="text-text-secondary">{meta.label}</span>{" "}
                  <span className="font-medium">
                    {a.targetName || a.detail?.role || a.detail?.email || ""}
                  </span>
                </p>
                <p className="text-xs text-text-tertiary">{formatRelativeTime(a.createdAt)}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </SectionCard>
  );
}

// --- Scope: which events a grant reaches ------------------------------------

// The customer-owned half of authorization. A permission declares scopeBy
// "event" in the catalog; this narrows one person's grant to the events they
// actually work on. Absence is "no restriction", so an empty selection means
// the whole project — the same rule scope.js and rbac_allows() both apply.
function ScopeSection({ member, grant, events, canAssign, onSetScope }) {
  const selected = grant?.scope?.event || [];
  const scoped = selected.length > 0;

  if (!member.userId) {
    return (
      <Field label="Event access">
        <p className="text-xs text-text-tertiary">
          Available once they have signed in and hold a role.
        </p>
      </Field>
    );
  }

  const toggle = (id, on) =>
    onSetScope(member, on ? [...selected, id] : selected.filter((e) => e !== id));

  return (
    <Field
      label="Event access"
      hint={
        scoped
          ? "Limited to the events ticked below."
          : "Everything in this workspace."
      }
    >
      <div className="rounded-lg border border-border bg-surface-card">
        <label
          className={cn(
            "flex items-center justify-between gap-3 px-3 py-2.5",
            canAssign && "cursor-pointer",
          )}
        >
          <span className="flex items-center gap-2 text-sm text-foreground">
            <Globe className="h-3.5 w-3.5 text-text-tertiary" />
            All Events
          </span>
          <Checkbox
            checked={!scoped}
            disabled={!canAssign || !scoped}
            onCheckedChange={() => onSetScope(member, [])}
          />
        </label>

        {events.length ? (
          <div className="max-h-52 overflow-y-auto border-t border-border">
            {events.map((e) => (
              <label
                key={e.id}
                className={cn(
                  "flex items-center justify-between gap-3 px-3 py-2",
                  canAssign && "cursor-pointer hover:bg-surface-hover",
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm text-foreground">
                    {e.name || "Untitled event"}
                  </span>
                  <span className="block truncate text-[11px] text-text-tertiary">
                    {formatDate(e.date)}
                  </span>
                </span>
                <Checkbox
                  checked={selected.includes(e.id)}
                  disabled={!canAssign}
                  onCheckedChange={(v) => toggle(e.id, !!v)}
                />
              </label>
            ))}
          </div>
        ) : (
          <p className="border-t border-border px-3 py-3 text-xs text-text-tertiary">
            This workspace has no events to narrow access to yet.
          </p>
        )}
      </div>
    </Field>
  );
}

// --- Member drawer ----------------------------------------------------------

function MemberDrawer({
  member,
  role,
  grant,
  roles,
  groups,
  events,
  canAssign,
  isLastOwner,
  onOpenChange,
  onChangeRole,
  onSetGroups,
  onSetScope,
  onToggleSuspend,
  onRemove,
}) {
  if (!member) return null;
  // Roles store PATTERNS — Owner's "*" grants everything, so a literal
  // includes() would report the most powerful role as granting nothing.
  const grantedGroups = PERMISSION_GROUPS.map(({ group, permissions }) => ({
    group,
    granted: permissions.filter((p) => matchesAny(role?.permissions || [], p.key)),
  })).filter((g) => g.granted.length);

  const memberGroupIds = member.groupIds || [];
  const toggleGroup = (id, on) => {
    const next = on ? [...memberGroupIds, id] : memberGroupIds.filter((g) => g !== id);
    onSetGroups(member, next);
  };

  return (
    <Sheet open={!!member} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <Avatar className="h-11 w-11">
              {member.avatarUrl ? <AvatarImage src={member.avatarUrl} alt={member.name} /> : null}
              <AvatarFallback className="bg-surface-card text-sm text-text-secondary">
                {initialsOf(member.name, member.email)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <SheetTitle className="truncate">
                {member.name || member.email.split("@")[0]}
              </SheetTitle>
              <SheetDescription className="truncate">{member.email}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6 px-4 pb-6">
          <div className="flex items-center gap-2">
            <StatusPill status={member.status} map={MEMBER_STATUS_MAP} />
          </div>

          <Field
            label="Role"
            hint={
              isLastOwner
                ? "The workspace's last owner — hand Owner to someone else before changing this."
                : undefined
            }
          >
            <Select
              value={role?.id || ""}
              disabled={!canAssign || isLastOwner}
              onValueChange={(v) => onChangeRole(member, v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Assign a role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <ScopeSection
            member={member}
            grant={grant}
            events={events}
            canAssign={canAssign}
            onSetScope={onSetScope}
          />

          {groups.length ? (
            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">Groups</p>
              <SettingsList>
                {groups.map((g) => (
                  <SettingRow
                    key={g.id}
                    title={g.name}
                    description={g.description || undefined}
                    control={
                      <Checkbox
                        checked={memberGroupIds.includes(g.id)}
                        disabled={!canAssign}
                        onCheckedChange={(v) => toggleGroup(g.id, !!v)}
                      />
                    }
                  />
                ))}
              </SettingsList>
            </div>
          ) : null}

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <ShieldCheck className="h-4 w-4" /> What {role?.name || "this role"} can do
            </p>
            {grantedGroups.length ? (
              <div className="space-y-3 rounded-lg border border-border bg-surface-card p-3">
                {grantedGroups.map(({ group, granted }) => (
                  <div key={group}>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-text-tertiary">
                      {group}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {granted.map((p) => (
                        <Badge key={p.key} variant="neutral">
                          {p.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-tertiary">
                This role grants no permissions yet.
              </p>
            )}
          </div>

          {canAssign && !isLastOwner ? (
            <div className="space-y-2 border-t border-border pt-4">
              <p className="text-sm font-medium text-muted-foreground">Danger zone</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => onToggleSuspend(member)}>
                  {member.status === "suspended" ? "Reactivate" : "Suspend"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-400 hover:text-red-300"
                  onClick={() => {
                    onOpenChange(false);
                    onRemove(member);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// --- Invite dialog ----------------------------------------------------------

function InviteDialog({ open, onOpenChange, roles, groups, onSubmit }) {
  // Keyed by `open` in the parent, so this mounts fresh each time it opens —
  // the lazy initializers below reset the form without a set-state effect.
  const [emails, setEmails] = useState("");
  const [message, setMessage] = useState("");
  const [groupId, setGroupId] = useState("none");
  const [roleId, setRoleId] = useState(() => {
    const fallback = roles.find((r) => r.key === "member") || roles[roles.length - 1];
    return fallback?.id || "";
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite people</DialogTitle>
          <DialogDescription>
            Add teammates by email. They will get access with the role you choose.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Email addresses" hint="Separate multiple with commas or new lines.">
            <Textarea
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              placeholder="alex@company.com, sam@company.com"
              rows={3}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Role">
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Group (optional)">
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Message (optional)">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a personal note"
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground"
            onClick={() => onSubmit(emails, roleId, groupId, message)}
          >
            Send invitations
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Group dialog -----------------------------------------------------------

function GroupDialog({ open, onOpenChange, onSubmit }) {
  // Keyed by `open` in the parent, so it mounts fresh (form resets) each open.
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Group</DialogTitle>
          <DialogDescription>Group members into a sub-team.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Check-in staff"
            />
          </Field>
          <Field label="Description">
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this group is for"
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground"
            onClick={() => onSubmit(name, description)}
          >
            Create group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default TeamMembersScreen;
