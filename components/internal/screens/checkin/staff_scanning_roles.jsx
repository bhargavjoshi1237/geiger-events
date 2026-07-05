"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Users,
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
  SectionCard,
  SettingsList,
  SettingRow,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { cn } from "@/lib/utils";
import { useProject } from "@/context/project-context";
import { getUser } from "@/lib/supabase/user";
import { newId } from "@/components/internal/screens/events/sample_data";
import {
  listStaffRoles,
  createStaffRole,
  updateStaffRole,
  softDeleteStaffRole,
  getCheckinSettings,
} from "@/lib/supabase/checkin";
import { withDefaults } from "./constants";

const genCode = () => String(Math.floor(100000 + Math.random() * 900000));

const defaultPermissions = () => ({
  canScan: true,
  canSell: false,
  canOverride: false,
  gates: [],
  zones: [],
});

function permSummary(p) {
  const abilities = [
    p.canScan && "Scan",
    p.canSell && "Sell",
    p.canOverride && "Override",
  ].filter(Boolean);
  const scope = (p.gates?.length || 0) + (p.zones?.length || 0);
  return [
    abilities.length ? abilities.join(" · ") : "No abilities",
    scope ? `${scope} gate/zone${scope > 1 ? "s" : ""}` : "all areas",
  ].join(" · ");
}

// A toggleable chip row for assigning gates / zones from the global lists.
function ChipPicker({ options, selected, onToggle, emptyHint }) {
  if (!options.length) {
    return <p className="text-xs text-text-tertiary">{emptyHint}</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = selected.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onToggle(o.id)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors",
              on
                ? "border-primary bg-primary/15 text-foreground"
                : "border-border bg-surface-card text-text-secondary hover:text-foreground",
            )}
          >
            {o.name}
          </button>
        );
      })}
    </div>
  );
}

function RoleEditPage({ role, gates, zones, onBack, onSave }) {
  const [name, setName] = useState(role.name);
  const [perms, setPerms] = useState({ ...defaultPermissions(), ...role.permissions });
  const [code, setCode] = useState(role.accessCode || genCode());
  const [saving, setSaving] = useState(false);

  const setPerm = (patch) => setPerms((p) => ({ ...p, ...patch }));
  const toggleIn = (key, id) =>
    setPerms((p) => ({
      ...p,
      [key]: p[key]?.includes(id)
        ? p[key].filter((x) => x !== id)
        : [...(p[key] || []), id],
    }));

  const save = async () => {
    if (!name.trim()) {
      toast.error("Give the role a name.");
      return;
    }
    setSaving(true);
    await onSave(role.id, {
      name: name.trim(),
      permissions: perms,
      accessCode: code,
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
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Role name"
            className="w-full max-w-md rounded-sm bg-transparent text-2xl font-semibold tracking-tight text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40 md:text-3xl"
          />
        </div>
        <Button
          className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={saving}
          onClick={save}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>

      <div className="mt-6 space-y-6">
        <SectionCard title="Abilities" description="What staff with this role can do on the check-in routes.">
          <SettingsList>
            <SettingRow
              title="Scan & admit"
              description="Open the scanner and check attendees in."
              checked={perms.canScan}
              onCheckedChange={(v) => setPerm({ canScan: v })}
            />
            <SettingRow
              title="Sell at the door"
              description="Take walk-in door sales (requires Door Sales enabled)."
              checked={perms.canSell}
              onCheckedChange={(v) => setPerm({ canSell: v })}
            />
            <SettingRow
              title="Override warnings"
              description="Admit despite a duplicate or invalid-ticket warning."
              checked={perms.canOverride}
              onCheckedChange={(v) => setPerm({ canOverride: v })}
            />
          </SettingsList>
        </SectionCard>

        <SectionCard title="Scope" description="Which gates and zones this role may work. None selected = all areas.">
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Gates</p>
              <ChipPicker
                options={gates}
                selected={perms.gates || []}
                onToggle={(id) => toggleIn("gates", id)}
                emptyHint="No gates defined yet — add them under Multi-gate & Zones."
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Zones</p>
              <ChipPicker
                options={zones}
                selected={perms.zones || []}
                onToggle={(id) => toggleIn("zones", id)}
                emptyHint="No zones defined yet — add them under Multi-gate & Zones."
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Access code" description="Staff enter this PIN to open the check-in routes for their shift.">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-lg border border-border bg-surface-card px-4 py-2 font-mono text-lg tracking-[0.3em] text-foreground">
              {code}
            </span>
            <Button
              variant="outline"
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={() => setCode(genCode())}
            >
              <RefreshCw className="h-4 w-4" /> Regenerate
            </Button>
          </div>
        </SectionCard>
      </div>
    </SecondaryScreenWrapper>
  );
}

export function StaffScanningRolesScreen() {
  const { projectId } = useProject();
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [openId, setOpenId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [userId, setUserId] = useState(null);
  const [gates, setGates] = useState([]);
  const [zones, setZones] = useState([]);

  useEffect(() => {
    let alive = true;
    listStaffRoles(projectId).then((rows) => {
      if (!alive) return;
      setRoles(rows ?? []);
      setLoading(false);
    });
    getUser().then((u) => alive && setUserId(u?.id || null));
    getCheckinSettings(projectId).then((res) => {
      if (!alive) return;
      const mg = withDefaults(res?.config || {}, "multiGate");
      setGates(mg.gates || []);
      setZones(mg.zones || []);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return roles.filter((r) => (q ? r.name.toLowerCase().includes(q) : true));
  }, [roles, search]);

  const handleCreate = () => {
    const name = draftName.trim();
    if (!name) {
      toast.error("Give the role a name.");
      return;
    }
    const role = {
      id: newId(),
      projectId,
      name,
      permissions: defaultPermissions(),
      accessCode: genCode(),
      active: true,
      createdBy: userId,
      createdAt: new Date().toISOString(),
    };
    setRoles((prev) => [role, ...prev]);
    setCreateOpen(false);
    setDraftName("");
    setOpenId(role.id);
    createStaffRole(role).then((saved) => {
      if (saved === null) return;
      if (!saved) toast.error("Couldn't save the role to the server.");
      else setRoles((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
    });
  };

  const handleSave = async (id, patch) => {
    setRoles((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    const saved = await updateStaffRole(id, patch);
    if (saved === false) {
      toast.error("Couldn't save your changes.");
      return;
    }
    toast.success("Saved.");
    setOpenId(null);
  };

  const handleDelete = (role) => {
    setDeleteTarget(null);
    setRoles((prev) => prev.filter((r) => r.id !== role.id));
    toast.success(`Deleted "${role.name}".`);
    softDeleteStaffRole(role.id).then((ok) => {
      if (ok === false) toast.error("Couldn't delete on the server.");
    });
  };

  const openRole = roles.find((r) => r.id === openId) || null;
  if (openRole) {
    return (
      <RoleEditPage
        role={openRole}
        gates={gates}
        zones={zones}
        onBack={() => setOpenId(null)}
        onSave={handleSave}
      />
    );
  }

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Staff Scanning Roles"
        description="Define what your door staff can do — scan, sell, override — which gates and zones they cover, and the access code they use to open the check-in routes."
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4" /> New role
          </Button>
        }
      />

      <Toolbar>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search roles…"
          className="w-full sm:max-w-xs"
        />
        <span />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading roles…
        </div>
      ) : filtered.length ? (
        <div className="grid gap-3">
          {filtered.map((role) => (
            <div
              key={role.id}
              role="button"
              tabIndex={0}
              onClick={() => setOpenId(role.id)}
              onKeyDown={(e) => e.key === "Enter" && setOpenId(role.id)}
              className="group flex items-center gap-3 rounded-xl border border-border bg-surface-subtle p-4 text-left transition-colors hover:border-border-strong hover:bg-surface-hover"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-muted-foreground">
                <Users className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">{role.name}</span>
                  <Badge variant="neutral" className="font-mono">{role.accessCode}</Badge>
                </div>
                <p className="mt-0.5 truncate text-xs text-text-secondary">
                  {permSummary({ ...defaultPermissions(), ...role.permissions })}
                </p>
              </div>
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
                  <DropdownMenuContent align="end" className="w-40 border-border bg-surface-card shadow-xl">
                    <DropdownMenuItem
                      className="cursor-pointer gap-2 text-muted-foreground focus:bg-surface-hover focus:text-foreground"
                      onClick={() => setOpenId(role.id)}
                    >
                      <Pencil className="h-4 w-4" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-surface-strong" />
                    <DropdownMenuItem
                      className="cursor-pointer gap-2 text-red-300 focus:bg-red-500/10 focus:text-red-300"
                      onClick={() => setDeleteTarget(role)}
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
            icon={Users}
            title={roles.length ? "No matches" : "No roles yet"}
            description={
              roles.length
                ? "Try a different search."
                : "Create a role to control what door staff can do and hand them an access code."
            }
            action={
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="h-4 w-4" /> New role
              </Button>
            }
          />
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md bg-background">
          <DialogHeader>
            <DialogTitle>New scanning role</DialogTitle>
            <DialogDescription>
              Name it — you&apos;ll set abilities, scope, and the access code on
              its edit page.
            </DialogDescription>
          </DialogHeader>
          <Field label="Role name" htmlFor="role-name">
            <Input
              id="role-name"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="e.g. Door staff"
              autoFocus
            />
          </Field>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleCreate}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete role</DialogTitle>
            <DialogDescription>
              Delete{" "}
              <span className="font-medium text-foreground">{deleteTarget?.name}</span>?
              Staff using its access code will lose access. This can&apos;t be undone.
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

export default StaffScanningRolesScreen;
