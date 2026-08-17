"use client";

import { Globe, ShieldCheck, Trash2 } from "lucide-react";
import { matchesAny } from "@geiger/rbac";

import {
  Field,
  SettingsList,
  SettingRow,
  StatusPill,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  MEMBER_STATUS_MAP,
  PERMISSION_GROUPS,
  formatDate,
  initialsOf,
} from "../constants";

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

export default function MemberDrawer({
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
