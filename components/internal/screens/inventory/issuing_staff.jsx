"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Copy,
  HandHeart,
  Link2,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
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
import { itemLabel } from "./constants";

// Issuing roles + their access codes. An 'issue' code is its own space: it
// opens /issue only, and a scanning or kiosk code can never open it.
// Deliberately reuses the checkin_staff_roles table (and its CRUD) rather than
// duplicating the plumbing — the `type` column keeps the spaces apart.

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

// The shareable staff link. Built from the browser origin so it works on
// preview deployments as well as production.
function issueLink(eventId, code) {
  if (!eventId) return "";
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/issue/${eventId}${code ? `?code=${encodeURIComponent(code)}` : ""}`;
}

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

  // Scope chips are grouped by event so a long list stays readable.
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
          <div className="flex items-center gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label="Role name"
              className="w-full max-w-md rounded-sm bg-transparent text-2xl font-semibold tracking-tight text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40 md:text-3xl"
            />
            <Badge variant="neutral" className="shrink-0">
              Issuing
            </Badge>
          </div>
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
        <SectionCard
          title="Abilities"
          description="What a device unlocked with this code can do at the issuing desk."
        >
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

        <SectionCard
          title="Scope"
          description="Which allocations this code may issue. None selected = every allocation."
        >
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

        <SectionCard
          title="Access code"
          description="Staff enter this PIN to open the issuing desk. It only opens /issue — scanning and kiosk codes are separate."
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
              onClick={() => copy(code, "Code")}
            >
              <Copy className="h-4 w-4" /> Copy code
            </Button>
          </div>
        </SectionCard>

        <SectionCard
          title="Share the desk"
          description="The route is per-event. Pick the event and send staff the link — it unlocks straight into the desk."
        >
          <div className="space-y-3">
            <Field label="Event">
              <Select value={eventId} onValueChange={setEventId}>
                <SelectTrigger className="bg-surface-card">
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
      </div>
    </SecondaryScreenWrapper>
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

  // Allocations for the scope picker, labelled with their item's name.
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
          className="w-full sm:max-w-xs"
        />
        <span />
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
              <div onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
                      aria-label="Role actions"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-40 border-border bg-surface-card shadow-xl"
                  >
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
