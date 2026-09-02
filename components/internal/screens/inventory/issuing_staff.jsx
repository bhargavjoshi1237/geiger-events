"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Copy,
  Crosshair,
  HandHeart,
  KeyRound,
  Link2,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { EditorShell } from "@/components/internal/shared/editor_shell";
import {
  EmptyState,
  Field,
  InlineTitleInput,
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
import { cn } from "@/lib/utils";
import { ListPagination, usePagination } from "@/components/internal/shared/pagination";
import { useProject } from "@/context/project-context";
import { getUser } from "@/lib/supabase/user";
import { listEvents } from "@/lib/supabase/events";
import { listAllocations, listItems } from "@/lib/supabase/inventory";
import {
  listStaffRoles,
  createStaffRole,
  updateStaffRole,
  softDeleteStaffRole,
} from "@/lib/supabase/checkin";
import { formatDateTime, itemLabel } from "./constants";

const genCode = () => String(Math.floor(100000 + Math.random() * 900000));

const defaultPermissions = () => ({
  canIssue: true,
  canReturn: false,
  canOverride: false,
  allocationIds: [],
});

function permSummary(p) {
  const abilities = [
    p.canIssue && "Issue",
    p.canReturn && "Undo",
    p.canOverride && "Override",
  ].filter(Boolean);
  const scope = p.allocationIds?.length || 0;
  return [
    abilities.length ? abilities.join(" · ") : "No abilities",
    scope ? `${scope} allocation${scope > 1 ? "s" : ""}` : "all allocations",
  ].join(" · ");
}

function issueLink(eventId, code) {
  if (!eventId) return "";
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/issue/${eventId}${code ? `?code=${encodeURIComponent(code)}` : ""}`;
}

// --- Edit sections ----------------------------------------------------------
// EditorShell renders each one as an element, never calls it.

function AbilitiesSection({ perms, setPerm }) {
  return (
    <SectionCard bare>
      <SettingsList>
        <SettingRow
          title="Issue items"
          description="Look up an attendee and hand over what they're entitled to."
          checked={perms.canIssue}
          onCheckedChange={(v) => setPerm({ canIssue: v })}
        />
        <SettingRow
          title="Undo a hand-out"
          description="Reverse a mistake — writes a return movement back into stock."
          checked={perms.canReturn}
          onCheckedChange={(v) => setPerm({ canReturn: v })}
        />
        <SettingRow
          title="Override & walk-up"
          description="Issue again after it's already collected, outside a window, or with no attendee attached. Every override is logged."
          checked={perms.canOverride}
          onCheckedChange={(v) => setPerm({ canOverride: v })}
        />
      </SettingsList>
    </SectionCard>
  );
}

function ScopeSection({ grouped, perms, toggleAllocation }) {
  return (
    <SectionCard bare>
      {!grouped.length ? (
        <p className="text-xs text-text-tertiary">
          No allocations yet — create them under Event Allocations.
        </p>
      ) : (
        <div className="space-y-4">
          {grouped.map((g) => (
            <div key={g.eventId} className="space-y-2">
              <p className="text-sm font-medium text-foreground">{g.eventName}</p>
              <div className="flex flex-wrap gap-2">
                {g.rows.map((a) => {
                  const on = perms.allocationIds?.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => toggleAllocation(a.id)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-sm transition-colors",
                        on
                          ? "border-primary bg-primary/15 text-foreground"
                          : "border-border bg-surface-card text-text-secondary hover:text-foreground",
                      )}
                    >
                      {a.itemName || "Item"}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function AccessCodeSection({ code, setCode, copy }) {
  return (
    <SectionCard bare>
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
          onClick={() => copy(code, "Code")}
        >
          <Copy className="h-4 w-4" /> Copy code
        </Button>
      </div>
    </SectionCard>
  );
}

function ShareSection({ events, eventId, setEventId, link, copy }) {
  return (
    <SectionCard bare>
      <div className="grid gap-4">
        <Field
          label="Event"
          hint="The desk route runs per event — staff land straight in this event's queue."
        >
          <Select value={eventId} onValueChange={setEventId}>
            <SelectTrigger className="w-full bg-surface-card">
              <SelectValue placeholder="Pick an event" />
            </SelectTrigger>
            <SelectContent>
              {events.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {link ? (
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg border border-border bg-surface-card px-3 py-2 text-xs text-text-secondary">
              {link}
            </code>
            <Button
              variant="outline"
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={() => copy(link, "Link")}
            >
              <Link2 className="h-4 w-4" /> Copy link
            </Button>
          </div>
        ) : (
          <p className="text-xs text-text-tertiary">
            No events yet — create one to share the desk.
          </p>
        )}
      </div>
    </SectionCard>
  );
}

const SECTIONS = [
  {
    key: "abilities",
    label: "Abilities",
    icon: ShieldCheck,
    desc: "What a device unlocked with this code can do at the issuing desk.",
    render: AbilitiesSection,
  },
  {
    key: "scope",
    label: "Scope",
    icon: Crosshair,
    desc: "Which allocations this code may issue. With none selected it can issue any of them.",
    render: ScopeSection,
  },
  {
    key: "access",
    label: "Access Code",
    icon: KeyRound,
    desc: "The PIN staff enter to open the desk. It only opens /issue — scanning and kiosk codes are separate.",
    render: AccessCodeSection,
  },
  {
    key: "share",
    label: "Share the Desk",
    icon: Link2,
    desc: "Send staff a link that unlocks straight into the desk for one event.",
    render: ShareSection,
  },
];

function RoleEditPage({ role, events, allocations, onBack, onSave }) {
  const [name, setName] = useState(role.name);
  const [perms, setPerms] = useState({ ...defaultPermissions(), ...role.permissions });
  const [code, setCode] = useState(role.accessCode || genCode());
  const [eventId, setEventId] = useState(events[0]?.id || "");
  const [saving, setSaving] = useState(false);

  const setPerm = (patch) => setPerms((p) => ({ ...p, ...patch }));

  const toggleAllocation = (id) =>
    setPerms((p) => ({
      ...p,
      allocationIds: p.allocationIds?.includes(id)
        ? p.allocationIds.filter((x) => x !== id)
        : [...(p.allocationIds || []), id],
    }));

  const grouped = useMemo(() => {
    const byEvent = new Map();
    for (const a of allocations) {
      const bucket = byEvent.get(a.eventId) || [];
      bucket.push(a);
      byEvent.set(a.eventId, bucket);
    }
    return [...byEvent.entries()].map(([id, rows]) => ({
      eventId: id,
      eventName: events.find((e) => e.id === id)?.name || "Unknown event",
      rows,
    }));
  }, [allocations, events]);

  const link = issueLink(eventId, code);

  const copy = async (text, what) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${what} copied.`);
    } catch {
      toast.error("Couldn't copy — select and copy manually.");
    }
  };

  const save = async () => {
    if (!name.trim()) {
      toast.error("Give the role a name.");
      return;
    }
    setSaving(true);
    await onSave(role.id, { name: name.trim(), permissions: perms, accessCode: code });
    setSaving(false);
  };

  // Shared by every section: each one only pulls the slice it needs.
  const formProps = {
    events,
    grouped,
    perms,
    setPerm,
    toggleAllocation,
    code,
    setCode,
    eventId,
    setEventId,
    copy,
    link,
  };

  return (
    <EditorShell
      back={{ label: "Issuing Staff", onClick: onBack }}
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
          <Badge variant="neutral">Issuing</Badge>
          <Badge variant="neutral" className="font-mono">
            {code}
          </Badge>
        </>
      }
      meta={`${permSummary(perms)}${
        role.createdAt ? ` · Created ${formatDateTime(role.createdAt)}` : ""
      }`}
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
      nav={SECTIONS}
      defaultSection={SECTIONS[0].key}
    >
      {({ activeItem }) => {
        const Body = activeItem.render;
        return <Body {...formProps} />;
      }}
    </EditorShell>
  );
}

export function IssuingStaffScreen() {
  const { projectId } = useProject();
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [openId, setOpenId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [userId, setUserId] = useState(null);
  const [events, setEvents] = useState([]);
  const [allocations, setAllocations] = useState([]);

  useEffect(() => {
    let alive = true;
    listStaffRoles(projectId).then((rows) => {
      if (!alive) return;
      setRoles((rows ?? []).filter((r) => r.type === "issue"));
      setLoading(false);
    });
    getUser().then((u) => alive && setUserId(u?.id || null));
    listEvents().then((rows) => alive && setEvents(rows ?? []));
    return () => {
      alive = false;
    };
  }, [projectId]);

  useEffect(() => {
    let alive = true;
    Promise.all([listAllocations(projectId), listItems(projectId)]).then(
      ([allocs, items]) => {
        if (!alive) return;
        const byId = new Map((items ?? []).map((i) => [i.id, i]));
        setAllocations(
          (allocs ?? []).map((a) => ({ ...a, itemName: itemLabel(byId.get(a.itemId)) })),
        );
      },
    );
    return () => {
      alive = false;
    };
  }, [projectId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? roles.filter((r) => r.name.toLowerCase().includes(q)) : roles;
  }, [roles, search]);

  const pager = usePagination(filtered, { resetKey: search });

  const handleCreate = () => {
    const name = draftName.trim();
    if (!name) {
      toast.error("Give the role a name.");
      return;
    }
    const role = {
      id: crypto.randomUUID(),
      projectId,
      name,
      type: "issue",
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
        setRoles((prev) => prev.filter((r) => r.id !== role.id));
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
        events={events}
        allocations={allocations}
        onBack={() => setOpenId(null)}
        onSave={handleSave}
      />
    );
  }

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Issuing Staff"
        description="Codes for the people handing items out. An issuing code opens the /issue desk only — it can't unlock check-in scanning or a kiosk, and they can't unlock it."
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4" /> New issuing role
          </Button>
        }
      />

      <Toolbar>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search issuing roles…"
        />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading roles…
        </div>
      ) : !filtered.length ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={HandHeart}
            title={roles.length ? "No matches" : "No issuing roles yet"}
            description={
              roles.length
                ? "Try a different search."
                : "Create a role to give your hand-out desk an access code, and control what it can issue."
            }
            action={
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="h-4 w-4" /> New issuing role
              </Button>
            }
          />
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-3">
            {pager.pageItems.map((role) => (
              <div
                key={role.id}
                role="button"
                tabIndex={0}
                onClick={() => setOpenId(role.id)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" && e.key !== " ") return;
                  e.preventDefault();
                  setOpenId(role.id);
                }}
                className="group flex items-center gap-3 rounded-xl border border-border bg-surface-subtle p-4 text-left transition-colors hover:border-border-strong hover:bg-surface-hover"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-muted-foreground">
                  <HandHeart className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{role.name}</span>
                    <Badge variant="neutral" className="font-mono">
                      {role.accessCode}
                    </Badge>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-text-secondary">
                    {permSummary({ ...defaultPermissions(), ...role.permissions })}
                  </p>
                </div>
                <ActionMenu
                  label="Role actions"
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
              </div>
            ))}
          </div>
          <ListPagination {...pager} itemLabel="roles" />
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md bg-background">
          <DialogHeader>
            <DialogTitle>New issuing role</DialogTitle>
            <DialogDescription>
              Name it — you&apos;ll set abilities, scope and the access code on its
              edit page.
            </DialogDescription>
          </DialogHeader>
          <Field label="Role name" htmlFor="issue-role-name">
            <Input
              id="issue-role-name"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="e.g. Merch desk"
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
              Any desk using its code will lose access immediately. This can&apos;t be
              undone.
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

export default IssuingStaffScreen;
