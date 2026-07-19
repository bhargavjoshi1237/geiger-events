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
} from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  ScreenHeader,
  StatsBar,
  SectionCard,
  SettingsList,
  SettingRow,
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
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { getUser } from "@/lib/supabase/user";
import {
  listRoles,
  createRole,
  updateRole,
  softDeleteRole,
  ensureSystemRoles,
} from "@/lib/supabase/roles";
import { listMembers, logActivity } from "@/lib/supabase/team";
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

export function RolesPermissionsScreen() {
  const { projectId } = useProject();
  const { recordId, openRecord, setTab } = useWorkspaceUrl();

  const [roles, setRoles] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [userName, setUserName] = useState("");

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
      let rows = await listRoles(projectId);
      // First visit for this project — seed the system roles, then re-read.
      if (rows && rows.length === 0) {
        const seeded = await ensureSystemRoles(projectId, null);
        if (seeded.length) rows = await listRoles(projectId);
      }
      if (!alive) return;
      setRoles(rows ?? []);
      setLoading(false);
    })();
    listMembers(projectId).then((rows) => alive && setMembers(rows ?? []));
    return () => {
      alive = false;
    };
  }, [projectId]);

  const memberCountByRole = useMemo(() => {
    const map = {};
    for (const m of members) {
      if (m.roleId && m.status !== "invited") {
        map[m.roleId] = (map[m.roleId] || 0) + 1;
      }
    }
    return map;
  }, [members]);

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
      { label: "Members assigned", value: String(assigned) },
      { label: "Permissions", value: String(ALL_PERMISSION_KEYS.length) },
    ];
  }, [roles, memberCountByRole]);

  // --- Permission toggles (optimistic + persist) ---------------------------

  const persistPermissions = async (role, permissions) => {
    setRoles((prev) =>
      prev.map((r) => (r.id === role.id ? { ...r, permissions } : r)),
    );
    const saved = await updateRole(role.id, { permissions });
    if (!saved) {
      setRoles((prev) =>
        prev.map((r) => (r.id === role.id ? { ...r, permissions: role.permissions } : r)),
      );
      toast.error("Couldn't update permissions.");
    }
  };

  const togglePermission = (role, key) => {
    if (role.isSystem) return;
    const has = role.permissions.includes(key);
    const next = has
      ? role.permissions.filter((k) => k !== key)
      : [...role.permissions, key];
    persistPermissions(role, next);
  };

  const toggleGroup = (role, keys, enable) => {
    if (role.isSystem) return;
    const set = new Set(role.permissions);
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
      permissions: source ? [...source.permissions] : [],
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
      permissions: [...role.permissions],
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

  const createAction = (
    <Button onClick={openCreate} className="bg-primary text-primary-foreground">
      <Plus className="h-4 w-4" /> Create role
    </Button>
  );

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Roles & Permissions"
        description="Define roles and control what each can access across the workspace."
        actions={createAction}
      />

      <StatsBar stats={stats} />

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
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <RoleList
            roles={roles}
            selectedId={selectedRole?.id}
            counts={memberCountByRole}
            onSelect={(r) => openRecord(r.id)}
          />
          {selectedRole ? (
            <RoleDetail
              role={selectedRole}
              memberCount={memberCountByRole[selectedRole.id] || 0}
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
                ? `Remove “${deleteTarget.name}”? Members with this role keep access until reassigned.`
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

// --- Left rail: role list ----------------------------------------------------

function RoleList({ roles, selectedId, counts, onSelect }) {
  return (
    <SectionCard bodyPadding={false} contentClassName="p-2">
      <div className="space-y-1">
        {roles.map((role) => {
          const active = role.id === selectedId;
          const color = roleColor(role.color);
          return (
            <button
              key={role.id}
              type="button"
              onClick={() => onSelect(role)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                active ? "bg-surface-active" : "hover:bg-surface-hover",
              )}
            >
              <span className={cn("h-2 w-2 shrink-0 rounded-full", color.dot)} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium text-foreground">
                    {role.name}
                  </span>
                  {role.isSystem ? (
                    <Lock className="h-3 w-3 shrink-0 text-text-tertiary" />
                  ) : null}
                </span>
                <span className="text-[11px] text-text-tertiary">
                  {counts[role.id] || 0} member{(counts[role.id] || 0) === 1 ? "" : "s"}
                </span>
              </span>
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
  memberCount,
  onToggle,
  onToggleGroup,
  onEdit,
  onDuplicate,
  onDelete,
  onViewMembers,
}) {
  const color = roleColor(role.color);
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
            <button
              type="button"
              onClick={() => onViewMembers(role)}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-foreground"
            >
              <Users className="h-3.5 w-3.5" />
              {memberCount} member{memberCount === 1 ? "" : "s"} · view in Team
            </button>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onDuplicate(role)}>
              <Copy className="h-3.5 w-3.5" /> Duplicate
            </Button>
            {!role.isSystem ? (
              <>
                <Button variant="outline" size="sm" onClick={() => onEdit(role)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-400 hover:text-red-300"
                  onClick={() => onDelete(role)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </SectionCard>

      {role.isSystem ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-card px-3 py-2 text-xs text-text-secondary">
          <Lock className="h-3.5 w-3.5" />
          System role — permissions are fixed. Duplicate it to make an editable copy.
        </div>
      ) : null}

      {PERMISSION_GROUPS.map(({ group, permissions }) => {
        const keys = permissions.map((p) => p.key);
        const enabledCount = keys.filter((k) => role.permissions.includes(k)).length;
        const allOn = enabledCount === keys.length;
        return (
          <SectionCard
            key={group}
            title={group}
            action={
              !role.isSystem ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-text-secondary"
                  onClick={() => onToggleGroup(role, keys, !allOn)}
                >
                  {allOn ? "Clear all" : "Select all"}
                </Button>
              ) : (
                <span className="text-xs text-text-tertiary">
                  {enabledCount}/{keys.length}
                </span>
              )
            }
          >
            <SettingsList>
              {permissions.map((perm) => {
                const checked = role.permissions.includes(perm.key);
                return (
                  <SettingRow
                    key={perm.key}
                    title={perm.label}
                    description={perm.key}
                    control={
                      <Switch
                        checked={checked}
                        disabled={role.isSystem}
                        onCheckedChange={() => onToggle(role, perm.key)}
                      />
                    }
                  />
                );
              })}
            </SettingsList>
          </SectionCard>
        );
      })}
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
            {editing ? "Save changes" : "Create role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default RolesPermissionsScreen;
