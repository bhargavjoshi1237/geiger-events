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

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { EditorShell } from "@/components/internal/shared/editor_shell";
import {
  DataTable,
  EmptyState,
  Field,
  InlineTitleInput,
  ScreenHeader,
  SearchInput,
  SectionCard,
  SettingsList,
  SettingRow,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import { ListPagination, usePagination } from "@/components/internal/shared/pagination";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Badge } from "@geiger/ui/badge";
import { ActionMenu } from "@geiger/ui";
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

const ROLE_TYPE_MAP = {
  staff: { label: "Staff", variant: "info", dotClass: "bg-sky-400" },
  kiosk: { label: "Kiosk", variant: "warning", dotClass: "bg-amber-400" },
};

const ROLE_TYPE_FILTER_OPTIONS = [
  { value: "all", label: "All types" },
  { value: "staff", label: "Staff" },
  { value: "kiosk", label: "Kiosk" },
];

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

// Single-section body: abilities, scope, and the access code all together —
// this role editor doesn't have enough content to earn its own section nav.
function RoleSettingsSection({ role, perms, setPerm, gates, zones, toggleIn, code, setCode, copyCode }) {
  return (
    <div className="space-y-6">
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
  );
}

const ROLE_EDIT_SECTIONS = [
  {
    key: "settings",
    label: "Role settings",
    icon: Users,
    desc: "Abilities, scope, and the access code for this role.",
    ownHeader: true,
  },
];

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
    <EditorShell
      back={{ label: "Staff Scanning Roles", onClick: onBack }}
      title={
        <InlineTitleInput
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Role name"
          placeholder="Untitled role"
          className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl"
        />
      }
      badges={
        <>
          <StatusPill status={role.type} map={ROLE_TYPE_MAP} />
          <Badge variant="neutral" className="font-mono">{code}</Badge>
        </>
      }
      meta={permSummary(perms)}
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
      nav={ROLE_EDIT_SECTIONS}
      defaultSection={ROLE_EDIT_SECTIONS[0].key}
    >
      <RoleSettingsSection
        role={role}
        perms={perms}
        setPerm={setPerm}
        gates={gates}
        zones={zones}
        toggleIn={toggleIn}
        code={code}
        setCode={setCode}
        copyCode={copyCode}
      />
    </EditorShell>
  );
}

export function StaffScanningRolesScreen() {
  const { projectId } = useProject();
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftType, setDraftType] = useState("staff");
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
    return roles.filter(
      (r) =>
        (type === "all" ? true : r.type === type) &&
        (q ? r.name.toLowerCase().includes(q) : true),
    );
  }, [roles, search, type]);

  // Every active filter joins the reset key, so changing one drops back to page 1.
  const pager = usePagination(filtered, { resetKey: `${search}|${type}` });

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
      type: draftType,
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

  const columns = [
    {
      key: "name",
      header: "Role",
      className: "w-full",
      headClassName: "w-full",
      render: (role) => {
        const Icon = ROLE_TYPES.find((t) => t.value === role.type)?.icon || Users;
        return (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-muted-foreground">
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <span className="font-medium text-foreground">{role.name}</span>
              <p className="mt-0.5 truncate text-xs text-text-secondary">
                {permSummary({ ...defaultPermissions(), ...role.permissions })}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      key: "type",
      header: "Type",
      className: "whitespace-nowrap",
      headClassName: "whitespace-nowrap",
      render: (role) => <StatusPill status={role.type} map={ROLE_TYPE_MAP} />,
    },
    {
      key: "code",
      header: "Access code",
      className: "whitespace-nowrap",
      headClassName: "whitespace-nowrap",
      render: (role) => (
        <Badge variant="neutral" className="font-mono">{role.accessCode}</Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "whitespace-nowrap text-right",
      headClassName: "whitespace-nowrap",
      render: (role) => (
        <ActionMenu
          label={`Actions for ${role.name}`}
          items={[
            { icon: Pencil, label: "Edit", onSelect: () => setOpenId(role.id) },
            { separator: true },
            {
              icon: Trash2,
              label: "Delete",
              variant: "destructive",
              onSelect: () => setDeleteTarget(role),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Staff Scanning Roles"
        description="Define what door staff and kiosk devices can do, and the access codes they use to unlock their routes — staff and kiosk codes are managed and validated separately."
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => {
              setDraftType(type === "kiosk" ? "kiosk" : "staff");
              setCreateOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> New role
          </Button>
        }
      />

      <Toolbar>
        <FilterDropdown
          value={type}
          onValueChange={setType}
          options={ROLE_TYPE_FILTER_OPTIONS}
          height="h-9"
        />
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search roles…"
        />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading roles…
        </div>
      ) : (
        <div className="space-y-5">
          <DataTable
            columns={columns}
            data={pager.pageItems}
            getRowKey={(role) => role.id}
            onRowClick={(role) => setOpenId(role.id)}
            empty={
              <div className="rounded-xl border border-border bg-surface-subtle">
                <EmptyState
                  icon={Users}
                  title={roles.length ? "No matches" : "No roles yet"}
                  description={
                    roles.length
                      ? "Try clearing the search or type filter."
                      : "Create a role to control what door staff or a kiosk device can do, and hand them an access code."
                  }
                  action={
                    roles.length ? (
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setSearch("");
                          setType("all");
                        }}
                      >
                        Clear filters
                      </Button>
                    ) : (
                      <Button
                        className="bg-primary text-primary-foreground hover:bg-primary/90"
                        onClick={() => setCreateOpen(true)}
                      >
                        <Plus className="h-4 w-4" /> New role
                      </Button>
                    )
                  }
                />
              </div>
            }
          />
          <ListPagination {...pager} itemLabel="roles" />
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md bg-background">
          <DialogHeader>
            <DialogTitle>New role</DialogTitle>
            <DialogDescription>
              Name it and pick a type — you&apos;ll set abilities, scope, and the
              access code on its edit page.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Field label="Role name" htmlFor="role-name">
              <Input
                id="role-name"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder={draftType === "kiosk" ? "e.g. Front lobby kiosk" : "e.g. Door staff"}
                autoFocus
              />
            </Field>
            <Field label="Type">
              <div className="flex gap-2">
                {ROLE_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setDraftType(t.value)}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors",
                      draftType === t.value
                        ? "border-primary bg-primary/15 text-foreground"
                        : "border-border bg-surface-card text-text-secondary hover:text-foreground",
                    )}
                  >
                    <t.icon className="h-4 w-4" /> {t.label}
                  </button>
                ))}
              </div>
            </Field>
          </div>
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
