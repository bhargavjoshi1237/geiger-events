"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  ShieldCheck,
  Copy,
  Trash2,
  Pencil,
  Users,
  Lock,
  Check,
  Search,
  ChevronRight,
  Crown,
  Info,
} from "lucide-react";
import { expandPatterns, matchesAny } from "@geiger/rbac";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  ScreenHeader,
  StatsBar,
  SectionCard,
  EmptyState,
  Field,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { cn } from "@/lib/utils";
import { ALL_PERMISSION_KEYS } from "@/lib/rbac";
import { useProject } from "@/context/project-context";
import { useRbac } from "@/context/rbac-context";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { getUser } from "@/lib/supabase/user";
import {
  createRole,
  updateRole,
  softDeleteRole,
  ensureSystemRoles,
  listGrants,
} from "@/lib/supabase/rbac";
import { logActivity } from "@/lib/supabase/team";
import {
  PERMISSION_GROUPS,
  ROLE_COLORS,
  ROLE_COLOR_OPTIONS,
  roleColor,
} from "./constants";

const EMPTY_DRAFT = {
  name: "",
  description: "",
  color: "blue",
  cloneFrom: "none",
};

// Owner is the one role the screen refuses to touch: its "*" is what keeps a
// project administrable, and it is the only permission list that keeps granting
// new keys as the catalog grows. Every other seeded role is a starting point the
// project owner is free to rewrite.
function isOwnerRole(role) {
  return role?.key === "owner" || (role?.permissions || []).includes("*");
}

// Does this role actually grant `key`? Roles store PATTERNS, so a literal
// includes() reports Owner as holding nothing at all.
function grantsKey(role, key) {
  return matchesAny(role?.permissions || [], key);
}

export function RolesPermissionsScreen() {
  const { projectId } = useProject();
  const { recordId, openRecord, setTab } = useWorkspaceUrl();
  const { can, refresh: refreshRbac } = useRbac();

  const canManage = can("events.role.manage");

  const [roles, setRoles] = useState([]);
  const [grants, setGrants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [userName, setUserName] = useState("");
  const [query, setQuery] = useState("");

  // One dialog serves create + edit; `editing` holds the role being edited.
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    let alive = true;
    getUser().then((u) => {
      if (!alive) return;
      setUserId(u?.id || null);
      setUserName(u?.name || "");
    });
    (async () => {
      // Fill in whichever system roles this project is missing. The adopt_rbac
      // migration seeds only Owner (its "*" is stable); the rest are defined in
      // geiger-rbac.config.js, so seeding them here keeps the catalog their
      // single source of truth. Idempotent per key, so this is a no-op once the
      // project has them all.
      const rows = await ensureSystemRoles(projectId, null);
      if (!alive) return;
      setRoles(rows ?? []);
      setLoading(false);
    })();
    listGrants(projectId).then((rows) => alive && setGrants(rows ?? []));
    return () => {
      alive = false;
    };
  }, [projectId]);

  // Counted off grants, not the roster overlay — a grant is what authorizes, so
  // it is the only honest answer to "how many people hold this role".
  const memberCountByRole = useMemo(() => {
    const map = {};
    for (const g of grants) {
      if (g.roleId && g.status === "active") {
        map[g.roleId] = (map[g.roleId] || 0) + 1;
      }
    }
    return map;
  }, [grants]);

  const selectedRole = useMemo(
    () => roles.find((r) => r.id === recordId) || roles[0] || null,
    [roles, recordId],
  );

  const stats = useMemo(() => {
    const custom = roles.filter((r) => !r.isSystem).length;
    const assigned = Object.values(memberCountByRole).reduce((a, b) => a + b, 0);
    return [
      { label: "Roles", value: String(roles.length) },
      { label: "Custom roles", value: String(custom) },
      { label: "People assigned", value: String(assigned) },
      { label: "Permissions", value: String(ALL_PERMISSION_KEYS.length) },
    ];
  }, [roles, memberCountByRole]);

  // --- Permission toggles (optimistic + persist) ---------------------------

  const persistPermissions = async (role, permissions) => {
    setRoles((prev) =>
      prev.map((r) => (r.id === role.id ? { ...r, permissions } : r)),
    );
    const saved = await updateRole(role.id, { permissions });
    if (saved) {
      // The editor may be editing their own role; re-resolve so the nav and the
      // gates on this very screen reflect the change without a reload.
      refreshRbac();
    } else {
      setRoles((prev) =>
        prev.map((r) =>
          r.id === role.id ? { ...r, permissions: role.permissions } : r,
        ),
      );
      toast.error("Couldn't update permissions.");
    }
  };

  // Turning one key off inside a wildcard can't be expressed by removing a key,
  // so a role holding any pattern is first expanded to the concrete set it
  // currently reaches. What the user saw ticked is exactly what stays ticked.
  const concreteKeys = (role) =>
    (role.permissions || []).some((p) => p.includes("*"))
      ? expandPatterns(role.permissions, ALL_PERMISSION_KEYS)
      : [...(role.permissions || [])];

  const togglePermission = (role, key) => {
    if (!canManage || isOwnerRole(role)) return;
    const base = concreteKeys(role);
    const next = grantsKey(role, key)
      ? base.filter((k) => k !== key)
      : [...new Set([...base, key])];
    persistPermissions(role, next);
  };

  const toggleGroup = (role, keys, enable) => {
    if (!canManage || isOwnerRole(role)) return;
    const set = new Set(concreteKeys(role));
    keys.forEach((k) => (enable ? set.add(k) : set.delete(k)));
    persistPermissions(role, Array.from(set));
  };

  // --- Role CRUD -----------------------------------------------------------

  const openCreate = () => {
    setEditing(null);
    setDraft(EMPTY_DRAFT);
    setDialogOpen(true);
  };

  const openEdit = (role) => {
    setEditing(role);
    setDraft({
      name: role.name,
      description: role.description,
      color: role.color,
      cloneFrom: "none",
    });
    setDialogOpen(true);
  };

  const submitDialog = async () => {
    const name = draft.name.trim();
    if (!name) {
      toast.error("Give the role a name.");
      return;
    }

    if (editing) {
      const patch = { name, description: draft.description, color: draft.color };
      setRoles((prev) =>
        prev.map((r) => (r.id === editing.id ? { ...r, ...patch } : r)),
      );
      setDialogOpen(false);
      const saved = await updateRole(editing.id, patch);
      if (saved) {
        logActivity({
          projectId,
          actorUserId: userId,
          actorName: userName,
          action: "role_updated",
          targetName: name,
        });
      } else {
        toast.error("Couldn't save the role.");
      }
      return;
    }

    const source = roles.find((r) => r.id === draft.cloneFrom);
    const id = crypto.randomUUID();
    const optimistic = {
      id,
      projectId,
      name,
      description: draft.description,
      color: draft.color,
      // Cloning Owner would copy "*" into a custom role, quietly minting a
      // second unrestricted role. Expand it to the concrete catalog instead.
      permissions: source ? expandPatterns(source.permissions, ALL_PERMISSION_KEYS) : [],
      isSystem: false,
      sort: roles.length,
      createdBy: userId,
    };
    setRoles((prev) => [...prev, optimistic]);
    setDialogOpen(false);
    openRecord(id);
    const saved = await createRole(optimistic);
    if (saved) {
      setRoles((prev) => prev.map((r) => (r.id === id ? saved : r)));
      logActivity({
        projectId,
        actorUserId: userId,
        actorName: userName,
        action: "role_created",
        targetName: name,
      });
      toast.success("Role created");
    } else {
      setRoles((prev) => prev.filter((r) => r.id !== id));
      toast.error("Couldn't create the role.");
    }
  };

  const duplicateRole = async (role) => {
    const id = crypto.randomUUID();
    const optimistic = {
      id,
      projectId,
      name: `${role.name} copy`,
      description: role.description,
      color: role.color,
      permissions: expandPatterns(role.permissions, ALL_PERMISSION_KEYS),
      isSystem: false,
      sort: roles.length,
      createdBy: userId,
    };
    setRoles((prev) => [...prev, optimistic]);
    openRecord(id);
    const saved = await createRole(optimistic);
    if (saved) {
      setRoles((prev) => prev.map((r) => (r.id === id ? saved : r)));
      toast.success("Role duplicated");
    } else {
      setRoles((prev) => prev.filter((r) => r.id !== id));
      toast.error("Couldn't duplicate the role.");
    }
  };

  const confirmDelete = async () => {
    const role = deleteTarget;
    setDeleteTarget(null);
    if (!role) return;
    setRoles((prev) => prev.filter((r) => r.id !== role.id));
    if (selectedRole?.id === role.id) openRecord(roles[0]?.id ?? null);
    const ok = await softDeleteRole(role.id);
    if (ok) {
      logActivity({
        projectId,
        actorUserId: userId,
        actorName: userName,
        action: "role_deleted",
        targetName: role.name,
      });
      toast.success("Role deleted");
    } else {
      setRoles((prev) => [...prev, role]);
      toast.error("Couldn't delete the role.");
    }
  };

  const goToTeam = (role) => {
    try {
      window.sessionStorage.setItem("team:roleFilter", role.id);
    } catch {
      // ignore storage failures
    }
    setTab("Team & Members");
  };

  const createAction = canManage ? (
    <Button onClick={openCreate} className="bg-primary text-primary-foreground">
      <Plus className="h-4 w-4" /> Create role
    </Button>
  ) : null;

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Roles & Permissions"
        description="Define roles and control what each can access across the workspace."
        actions={createAction}
      />

      <StatsBar stats={stats} />

      {!canManage ? (
        <Notice icon={Lock}>
          You can see how access is set up here, but only someone with
          <span className="text-foreground"> Create and edit roles </span>
          can change it.
        </Notice>
      ) : null}

      {loading ? (
        <SectionCard>
          <div className="py-16 text-center text-sm text-text-secondary">
            Loading roles…
          </div>
        </SectionCard>
      ) : roles.length === 0 ? (
        <SectionCard>
          <EmptyState
            icon={ShieldCheck}
            title="No roles yet"
            description="Create your first role to start controlling access."
            action={createAction}
          />
        </SectionCard>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[264px_1fr]">
          <RoleList
            roles={roles}
            selectedId={selectedRole?.id}
            counts={memberCountByRole}
            onSelect={(r) => openRecord(r.id)}
          />
          {selectedRole ? (
            <RoleDetail
              role={selectedRole}
              canManage={canManage}
              memberCount={memberCountByRole[selectedRole.id] || 0}
              query={query}
              setQuery={setQuery}
              onToggle={togglePermission}
              onToggleGroup={toggleGroup}
              onEdit={openEdit}
              onDuplicate={duplicateRole}
              onDelete={setDeleteTarget}
              onViewMembers={goToTeam}
            />
          ) : null}
        </div>
      )}

      <RoleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        draft={draft}
        setDraft={setDraft}
        roles={roles}
        onSubmit={submitDialog}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete role</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `Remove “${deleteTarget.name}”? Anyone holding it loses the access it granted.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              className="bg-red-500/90 text-white hover:bg-red-500"
              onClick={confirmDelete}
            >
              Delete role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainScreenWrapper>
  );
}

// --- Shared notice strip -----------------------------------------------------

function Notice({ icon: Icon = Info, children }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-border bg-surface-card px-3.5 py-2.5 text-xs leading-relaxed text-text-secondary">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-tertiary" />
      <p>{children}</p>
    </div>
  );
}

// --- Left rail: role list ----------------------------------------------------

function RoleList({ roles, selectedId, counts, onSelect }) {
  return (
    <SectionCard bodyPadding={false} contentClassName="p-2">
      <div className="space-y-0.5">
        {roles.map((role) => {
          const active = role.id === selectedId;
          const color = roleColor(role.color);
          const count = counts[role.id] || 0;
          return (
            <button
              key={role.id}
              type="button"
              onClick={() => onSelect(role)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors",
                active ? "bg-surface-active" : "hover:bg-surface-hover",
              )}
            >
              <span className={cn("h-2 w-2 shrink-0 rounded-full", color.dot)} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium text-foreground">
                    {role.name}
                  </span>
                  {isOwnerRole(role) ? (
                    <Crown className="h-3 w-3 shrink-0 text-amber-400" />
                  ) : null}
                </span>
                <span className="text-[11px] text-text-tertiary">
                  {count} {count === 1 ? "person" : "people"}
                </span>
              </span>
              {active ? (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
              ) : null}
            </button>
          );
        })}
      </div>
    </SectionCard>
  );
}

// --- Right pane: role detail + permission matrix ----------------------------

function RoleDetail({
  role,
  canManage,
  memberCount,
  query,
  setQuery,
  onToggle,
  onToggleGroup,
  onEdit,
  onDuplicate,
  onDelete,
  onViewMembers,
}) {
  const color = roleColor(role.color);
  const owner = isOwnerRole(role);
  const locked = owner || !canManage;

  const q = query.trim().toLowerCase();
  const groups = useMemo(
    () =>
      PERMISSION_GROUPS.map(({ group, permissions }) => ({
        group,
        permissions: q
          ? permissions.filter(
              (p) =>
                p.label.toLowerCase().includes(q) ||
                p.key.toLowerCase().includes(q),
            )
          : permissions,
      })).filter((g) => g.permissions.length),
    [q],
  );

  const totalGranted = useMemo(
    () => ALL_PERMISSION_KEYS.filter((k) => grantsKey(role, k)).length,
    [role],
  );

  return (
    <div className="space-y-4">
      <SectionCard>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={cn("h-2.5 w-2.5 rounded-full", color.dot)} />
              <h2 className="text-lg font-semibold text-foreground">{role.name}</h2>
              <Badge variant={role.isSystem ? "neutral" : "info"}>
                {role.isSystem ? "System" : "Custom"}
              </Badge>
            </div>
            {role.description ? (
              <p className="mt-1 text-sm text-text-secondary">{role.description}</p>
            ) : null}
            <div className="mt-2 flex items-center gap-3 text-xs">
              <button
                type="button"
                onClick={() => onViewMembers(role)}
                className="inline-flex items-center gap-1.5 font-medium text-text-secondary hover:text-foreground"
              >
                <Users className="h-3.5 w-3.5" />
                {memberCount} {memberCount === 1 ? "person" : "people"} · view in Team
              </button>
              <span className="text-text-tertiary">
                {owner ? "Every permission" : `${totalGranted} of ${ALL_PERMISSION_KEYS.length} permissions`}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {canManage ? (
              <Button variant="outline" size="sm" onClick={() => onDuplicate(role)}>
                <Copy className="h-3.5 w-3.5" /> Duplicate
              </Button>
            ) : null}
            {canManage && !owner ? (
              <Button variant="outline" size="sm" onClick={() => onEdit(role)}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            ) : null}
            {canManage && !owner && !role.isSystem ? (
              <Button
                variant="outline"
                size="sm"
                aria-label="Delete role"
                className="text-red-400 hover:text-red-300"
                onClick={() => onDelete(role)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            ) : null}
          </div>
        </div>
      </SectionCard>

      {owner ? (
        <Notice icon={Crown}>
          Owner holds every permission — including ones added to the product
          later. It is deliberately not editable, so a workspace always keeps at
          least one role that can administer it.
        </Notice>
      ) : null}

      <SectionCard
        title="Permissions"
        action={
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter permissions…"
              className="h-8 w-48 bg-surface-card pl-8 text-xs"
            />
          </div>
        }
        bodyPadding={false}
        contentClassName="p-2"
      >
        {groups.length === 0 ? (
          <p className="py-10 text-center text-sm text-text-tertiary">
            No permission matches “{query}”.
          </p>
        ) : (
          <div className="space-y-1">
            {groups.map(({ group, permissions }) => (
              <PermissionGroup
                key={group}
                group={group}
                permissions={permissions}
                role={role}
                locked={locked}
                onToggle={onToggle}
                onToggleGroup={onToggleGroup}
              />
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function PermissionGroup({ group, permissions, role, locked, onToggle, onToggleGroup }) {
  const keys = permissions.map((p) => p.key);
  const enabled = keys.filter((k) => grantsKey(role, k));
  const allOn = enabled.length === keys.length;

  // Collapsed by default unless something is on — "Workspace views" alone is two
  // dozen rows, and an open accordion of every group buries the operations that
  // matter under a wall of switches.
  const [open, setOpen] = useState(enabled.length > 0);

  return (
    <div className="rounded-lg border border-border/60">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={open}
        >
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-text-tertiary transition-transform",
              open && "rotate-90",
            )}
          />
          <span className="truncate text-sm font-medium text-foreground">{group}</span>
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
              enabled.length
                ? "bg-primary/15 text-primary"
                : "bg-surface-card text-text-tertiary",
            )}
          >
            {enabled.length}/{keys.length}
          </span>
        </button>
        {!locked ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 text-xs text-text-secondary"
            onClick={() => onToggleGroup(role, keys, !allOn)}
          >
            {allOn ? "Clear all" : "Select all"}
          </Button>
        ) : null}
      </div>

      {open ? (
        <div className="grid gap-px border-t border-border/60 bg-border/40 sm:grid-cols-2">
          {permissions.map((perm) => {
            const checked = grantsKey(role, perm.key);
            return (
              <label
                key={perm.key}
                className={cn(
                  "flex items-center justify-between gap-3 bg-surface-subtle px-3 py-2.5",
                  !locked && "cursor-pointer hover:bg-surface-hover",
                )}
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm text-foreground">{perm.label}</span>
                    {perm.scopeBy ? (
                      <span className="shrink-0 rounded border border-border bg-surface-card px-1 py-px text-[10px] text-text-tertiary">
                        per {perm.scopeBy}
                      </span>
                    ) : null}
                  </span>
                  <span className="block truncate font-mono text-[10px] text-text-tertiary">
                    {perm.key}
                  </span>
                </span>
                <Switch
                  checked={checked}
                  disabled={locked}
                  onCheckedChange={() => onToggle(role, perm.key)}
                />
              </label>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

// --- Create / edit dialog ----------------------------------------------------

function RoleDialog({ open, onOpenChange, editing, draft, setDraft, roles, onSubmit }) {
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit role" : "Create role"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update this role's details. Permissions are edited in the matrix."
              : "Name the role and optionally start from an existing one."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Name" htmlFor="role-name">
            <Input
              id="role-name"
              value={draft.name}
              onChange={(e) => set("name")(e.target.value)}
              placeholder="e.g. Event Coordinator"
            />
          </Field>
          <Field label="Description" htmlFor="role-desc">
            <Textarea
              id="role-desc"
              value={draft.description}
              onChange={(e) => set("description")(e.target.value)}
              placeholder="What this role is for"
              rows={2}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Color">
              <div className="flex flex-wrap gap-2 pt-1">
                {ROLE_COLOR_OPTIONS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    aria-label={key}
                    onClick={() => set("color")(key)}
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full",
                      ROLE_COLORS[key].dot,
                      draft.color === key
                        ? "ring-2 ring-offset-2 ring-offset-background ring-white/60"
                        : "",
                    )}
                  >
                    {draft.color === key ? (
                      <Check className="h-3 w-3 text-black/70" />
                    ) : null}
                  </button>
                ))}
              </div>
            </Field>
            {!editing ? (
              <Field label="Start from">
                <Select value={draft.cloneFrom} onValueChange={set("cloneFrom")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Blank" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Blank (no permissions)</SelectItem>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        Copy from {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="bg-primary text-primary-foreground" onClick={onSubmit}>
            {editing ? "Save Changes" : "Create role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default RolesPermissionsScreen;
