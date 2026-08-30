"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Copy,
  Loader2,
  Monitor,
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
import { EditorHeader } from "@/components/internal/shared/editor_shell";
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
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Badge } from "@geiger/ui/badge";
import {
  ActionMenu,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@geiger/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
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

const ROLE_TYPES = [
  { value: "staff", label: "Staff", icon: Users },
  { value: "kiosk", label: "Kiosk", icon: Monitor },
];

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

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Code copied.");
    } catch {
      toast.error("Couldn't copy — select and copy manually.");
    }
  };

  return (
    <SecondaryScreenWrapper>
      <EditorHeader
        back={{ label: "Back", onClick: onBack }}
        title={
          <>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label="Role name"
              className="w-full max-w-md rounded-sm bg-transparent text-2xl font-semibold tracking-tight text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40 md:text-3xl"
            />
            <Badge variant="neutral" className="shrink-0 capitalize">
              {role.type === "kiosk" ? "Kiosk" : "Staff"}
            </Badge>
          </>
        }
        actions={
          <Button
            className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={saving}
            onClick={save}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? "Saving…" : "Save"}
          </Button>
        }
      />

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

        <SectionCard
          title="Access code"
          description={
            role.type === "kiosk"
              ? "Enter this PIN on the kiosk device to unlock it."
              : "Staff enter this PIN to open the check-in routes for their shift."
          }
        >
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
            <Button
              variant="outline"
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={copyCode}
            >
              <Copy className="h-4 w-4" /> Copy code
            </Button>
          </div>
        </SectionCard>
      </div>
    </SecondaryScreenWrapper>
  );
}

function RoleList({ type, icon: Icon, roles, loading, search, onOpen, onDelete, onCreate }) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return roles.filter(
      (r) => r.type === type && (q ? r.name.toLowerCase().includes(q) : true),
    );
  }, [roles, search, type]);
  const typeTotal = roles.filter((r) => r.type === type).length;
  const label = type === "kiosk" ? "kiosk" : "staff";

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading roles…
      </div>
    );
  }

  if (!filtered.length) {
    return (
      <div className="rounded-xl border border-border bg-surface-subtle">
        <EmptyState
          icon={Icon}
          title={typeTotal ? "No matches" : `No ${label} roles yet`}
          description={
            typeTotal
              ? "Try a different search."
              : type === "kiosk"
                ? "Create a kiosk role to hand a self-service tablet its own access code, separate from staff codes."
                : "Create a role to control what door staff can do and hand them an access code."
          }
          action={
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={onCreate}>
              <Plus className="h-4 w-4" /> New {label} role
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {filtered.map((role) => (
        <div
          key={role.id}
          role="button"
          tabIndex={0}
          onClick={() => onOpen(role.id)}
          onKeyDown={(e) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            e.preventDefault();
            onOpen(role.id);
          }}
          className="group flex items-center gap-3 rounded-xl border border-border bg-surface-subtle p-4 text-left transition-colors hover:border-border-strong hover:bg-surface-hover"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-muted-foreground">
            <Icon className="h-4 w-4" />
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
          <ActionMenu
            label={`Actions for ${role.name}`}
            items={[
              { icon: Pencil, label: "Edit", onSelect: () => onOpen(role.id) },
              { separator: true },
              {
                icon: Trash2,
                label: "Delete",
                variant: "destructive",
                onSelect: () => onDelete(role),
              },
            ]}
          />
        </div>
      ))}
    </div>
  );
}

export function StaffScanningRolesScreen() {
  const { projectId } = useProject();
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("staff");
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

  const activeType = ROLE_TYPES.find((t) => t.value === tab) || ROLE_TYPES[0];

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
      type: tab,
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
      if (!saved) {
        toast.error("Couldn't save the role to the server.");
      } else {
        setRoles((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
      }
    });
  };

  const handleSave = async (id, patch) => {
    setRoles((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    const saved = await updateStaffRole(id, patch);
    if (!saved) {
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
        description="Define what door staff and kiosk devices can do, and the access codes they use to unlock their routes — staff and kiosk codes are managed and validated separately."
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4" /> New {activeType.label.toLowerCase()} role
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {ROLE_TYPES.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="gap-1.5">
              <t.icon className="h-4 w-4" /> {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {ROLE_TYPES.map((t) => (
          <TabsContent key={t.value} value={t.value} className="space-y-4">
            <Toolbar>
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder={`Search ${t.label.toLowerCase()} roles…`}
              />
            </Toolbar>

            <RoleList
              type={t.value}
              icon={t.icon}
              roles={roles}
              loading={loading}
              search={search}
              onOpen={setOpenId}
              onDelete={setDeleteTarget}
              onCreate={() => setCreateOpen(true)}
            />
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md bg-background">
          <DialogHeader>
            <DialogTitle>New {activeType.label.toLowerCase()} role</DialogTitle>
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
              placeholder={tab === "kiosk" ? "e.g. Front lobby kiosk" : "e.g. Door staff"}
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
