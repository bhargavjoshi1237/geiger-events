"use client";

import { useEffect, useState } from "react";
import { Loader2, MoreHorizontal, Pencil, Plus, Trash2, Users } from "lucide-react";
import {
  Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, IconPicker, Input, Label, LucideIcon,
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle,
} from "@geiger/ui";
import { toast } from "sonner";
import { EmptyState } from "@/components/internal/shared/screen_kit";
import { cn } from "@/lib/utils";
import { BUILTIN_ROLES } from "@/lib/workspace/portal/contracts.js";
import { COLOR_NAMES, COLOR_SWATCH } from "../state/format";
import { ObjectIcon } from "../ws_ui";
import { accessSummary, AccessSheet } from "./access_sheet";
import { cleanRule, RuleBuilder } from "./rule_builder";

const BUILTIN_HINT = {
  [BUILTIN_ROLES.public]: "Everyone, signed in or not.",
  [BUILTIN_ROLES.signedIn]: "Anyone signed in who is in the people list.",
};

function MatchCount({ portal, membership }) {
  const [state, setState] = useState(null);
  const key = JSON.stringify(cleanRule(membership));
  useEffect(() => {
    const rule = JSON.parse(key);
    if (!rule) return undefined;
    const timer = setTimeout(async () => {
      const { data } = await portal.api.view({ what: "role_matches", membership: rule });
      setState({ key, data });
    }, 400);
    return () => clearTimeout(timer);
  }, [portal.api, key]);
  if (!JSON.parse(key)) return <span className="text-text-tertiary">Add a condition to choose who has this role.</span>;
  if (state?.key !== key) return <span className="inline-flex items-center gap-1.5 text-text-tertiary"><Loader2 className="h-3 w-3 animate-spin" />Counting…</span>;
  if (state.data?.error) return <span className="text-red-600 dark:text-red-400">{state.data.error}</span>;
  return <span className="text-text-secondary">{(state.data?.total ?? 0).toLocaleString()} {state.data?.total === 1 ? "person matches" : "people match"} right now.</span>;
}

// A role's name, look and who has it (a rule on the people list).
function RoleSheet({ open, onOpenChange, eventId, ws, portal, role }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl">
        {open ? <RoleBody key={role?.id ?? "new"} eventId={eventId} ws={ws} portal={portal} role={role} onOpenChange={onOpenChange} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function RoleBody({ eventId, ws, portal, role, onOpenChange }) {
  const [name, setName] = useState(role?.name ?? "");
  const [icon, setIcon] = useState(role?.icon ?? "user");
  const [color, setColor] = useState(role?.color ?? "blue");
  const [membership, setMembership] = useState(role?.membership ?? null);
  const [busy, setBusy] = useState(false);
  const peopleId = portal.portal?.peopleObjectId;
  const people = ws.objects.find((object) => object.id === peopleId);
  const builtin = Boolean(role?.builtin);

  const save = async () => {
    setBusy(true);
    const result = await portal.run("role.save", {
      role: { ...(role ? { id: role.id } : {}), name, icon, color, ...(builtin ? {} : { membership: cleanRule(membership) }) },
      ...(role ? { expectedRevision: role.revision } : {}),
    }, { success: role ? "Role saved" : "Role added" });
    setBusy(false);
    if (!result.error) onOpenChange(false);
  };

  return (
    <>
      <SheetHeader className="border-b border-border px-5 py-4">
        <SheetTitle className="text-base">{role ? role.name : "New role"}</SheetTitle>
        <SheetDescription>{builtin ? BUILTIN_HINT[role.key] : "People get this role when their record in the people list matches the rule."}</SheetDescription>
      </SheetHeader>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="grid gap-1.5">
            <Label htmlFor="wp-role-name">Name</Label>
            <Input id="wp-role-name" autoFocus={!role} maxLength={60} value={name} placeholder="Reviewer" onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Icon</Label>
            <IconPicker value={icon} onValueChange={setIcon} />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label>Colour</Label>
          <div className="flex flex-wrap gap-2">
            {COLOR_NAMES.map((name) => (
              <button key={name} type="button" aria-label={name} onClick={() => setColor(name)}
                className={cn("h-7 w-7 rounded-full border-2", COLOR_SWATCH[name], color === name ? "border-foreground" : "border-transparent")} />
            ))}
          </div>
        </div>
        {!builtin ? (
          <div className="grid gap-2">
            <div className="grid gap-0.5">
              <Label className="text-sm font-medium">Who has this role</Label>
              <p className="text-xs text-text-secondary">A rule on {people?.plural ?? "the people list"}, like “Roles has Reviewer”.</p>
            </div>
            {peopleId ? (
              <div className="grid gap-3 rounded-lg border border-border p-3">
                <RuleBuilder data={ws.data} objectId={peopleId} value={membership} onChange={setMembership} eventId={eventId} tokens={{}}
                  emptyText="No conditions yet, so nobody has this role." />
                <p className="text-xs"><MatchCount portal={portal} membership={membership} /></p>
              </div>
            ) : <p className="text-sm text-text-secondary">Choose the people list on the Sign-in &amp; people tab first.</p>}
          </div>
        ) : null}
      </div>
      <SheetFooter className="flex-row items-center justify-end gap-2 border-t border-border px-5 py-3">
        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button onClick={save} disabled={busy || !name.trim()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{role ? "Save role" : "Add role"}</Button>
      </SheetFooter>
    </>
  );
}

// Roles across the top, lists down the side: each cell is what that role can do with that list.
export function RolesTab({ eventId, ws, portal }) {
  const [editing, setEditing] = useState(null);
  const [access, setAccess] = useState(null);
  const objects = [...ws.objects].sort((a, b) => a.position - b.position);
  const roles = portal.roles;

  const remove = async (role) => {
    const result = await portal.run("role.delete", { roleId: role.id });
    if (!result.error) {
      toast.success(`Role “${role.name}” removed`, { action: { label: "Undo", onClick: () => portal.run("role.restore", { roleId: role.id }, { success: "Restored" }) } });
    }
  };

  if (!roles.length) {
    return <EmptyState icon={Users} title="No roles yet" description="Turn the portal on from Sign-in & people to get the built-in roles, then add your own." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-text-secondary">A person can have several roles; they get everything each one allows. Click a cell to choose what a role can do with a list.</p>
        <Button onClick={() => setEditing({ role: null })}><Plus className="h-4 w-4" />New role</Button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-surface-subtle">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="sticky left-0 z-10 min-w-44 bg-surface-subtle px-3 py-2.5 text-left text-xs font-medium text-text-secondary">List</th>
              {roles.map((role) => (
                <th key={role.id} className="min-w-52 px-3 py-2.5 text-left align-top font-medium">
                  <div className="flex items-start gap-2">
                    <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-white", COLOR_SWATCH[role.color] ?? COLOR_SWATCH.gray)}>
                      <LucideIcon name={role.icon || "user"} className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-foreground">{role.name}</span>
                      <span className="block truncate text-xs font-normal text-text-tertiary">
                        {role.builtin ? BUILTIN_HINT[role.key] : role.membership ? "Has a rule" : "Nobody yet — add a rule"}
                      </span>
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button type="button" aria-label={`${role.name} options`} className="rounded p-1 text-text-tertiary hover:bg-surface-active hover:text-foreground"><MoreHorizontal className="h-4 w-4" /></button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setEditing({ role })}><Pencil className="h-4 w-4" />{role.builtin ? "Rename" : "Edit role"}</DropdownMenuItem>
                        {!role.builtin ? <DropdownMenuItem className="text-red-600 dark:text-red-400" onSelect={() => remove(role)}><Trash2 className="h-4 w-4" />Delete role</DropdownMenuItem> : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {objects.map((object) => (
              <tr key={object.id} className="border-b border-border last:border-0">
                <td className="sticky left-0 z-10 bg-surface-subtle px-3 py-2">
                  <span className="flex items-center gap-2 font-medium text-foreground"><ObjectIcon icon={object.icon} className="h-4 w-4 text-text-secondary" />{object.plural}</span>
                </td>
                {roles.map((role) => {
                  const summary = accessSummary(role.access?.[object.id]);
                  return (
                    <td key={role.id} className="px-2 py-1.5">
                      <button type="button" onClick={() => setAccess({ roleId: role.id, objectId: object.id })}
                        className={cn("w-full rounded-md border px-2.5 py-2 text-left text-xs hover:border-foreground/30",
                          summary ? "border-border bg-surface-card text-foreground" : "border-dashed border-border text-text-tertiary")}>
                        {summary || "No access"}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <RoleSheet open={Boolean(editing)} onOpenChange={(open) => { if (!open) setEditing(null); }} eventId={eventId} ws={ws} portal={portal} role={editing?.role ?? null} />
      <AccessSheet open={Boolean(access)} onOpenChange={(open) => { if (!open) setAccess(null); }} eventId={eventId} ws={ws} portal={portal}
        role={roles.find((role) => role.id === access?.roleId)} objectId={access?.objectId} />
    </div>
  );
}
