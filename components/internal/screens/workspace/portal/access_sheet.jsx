"use client";

import { useEffect, useState } from "react";
import { Eye, Loader2, Lock, Pencil } from "lucide-react";
import { Button, Label, Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, Switch } from "@geiger/ui";
import { SegmentedTabs } from "@/components/internal/shared/screen_kit";
import { cn } from "@/lib/utils";
import { getType } from "@/lib/workspace/schema/types/index.js";
import { typeIcon } from "../state/format";
import { liveFieldsOf } from "../state/use_workspace";
import { cleanRule, RuleBuilder } from "./rule_builder";

const MODES = [{ label: "Nothing", value: "none" }, { label: "Some", value: "where" }, { label: "All", value: "all" }];
const LEVELS = [
  { value: "hidden", label: "Hidden", icon: Lock },
  { value: "read", label: "Read", icon: Eye },
  { value: "edit", label: "Edit", icon: Pencil },
];

const blankAccess = () => ({ view: { mode: "none" }, create: { mode: "none" }, edit: { mode: "none" }, delete: { mode: "none" }, comment: false, status: false, fields: {} });

// A one-line summary of a role's access to a list, for the matrix.
export function accessSummary(access) {
  if (!access || access.view?.mode === "none" || !access.view) return null;
  const part = (rule, word) => (rule?.mode === "all" ? `${word} all` : rule?.mode === "where" ? `${word} some` : null);
  const hidden = Object.values(access.fields ?? {}).filter((level) => level === "hidden").length;
  return [part(access.view, "Sees"), access.create?.mode === "all" ? "adds" : null, part(access.edit, "edits"), part(access.delete, "deletes"),
    hidden ? `${hidden} hidden` : null].filter(Boolean).join(" · ");
}

function ActionRule({ title, hint, rule, onChange, data, objectId, tokens, eventId, modes = MODES }) {
  return (
    <section className="grid gap-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="grid gap-0.5">
          <Label className="text-sm font-medium">{title}</Label>
          {hint ? <p className="text-xs text-text-secondary">{hint}</p> : null}
        </div>
        <SegmentedTabs className="w-auto" value={rule.mode} tabs={modes}
          onChange={(mode) => onChange(mode === "where" ? { mode, filter: rule.filter ?? null } : { mode })} />
      </div>
      {rule.mode === "where" ? (
        <div className="rounded-lg border border-border p-3">
          <RuleBuilder data={data} objectId={objectId} value={rule.filter ?? null} tokens={tokens} eventId={eventId}
            onChange={(filter) => onChange({ mode: "where", filter })} emptyText="Add a condition, like “Reviewer is me”." />
        </div>
      ) : null}
    </section>
  );
}

// What one role may do with one list: see, add, edit, delete, comment, change status, and each field's visibility.
export function AccessSheet({ open, onOpenChange, eventId, ws, portal, role, objectId }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl">
        {open && role && objectId ? <AccessBody key={`${role.id}:${objectId}`} eventId={eventId} ws={ws} portal={portal} role={role} objectId={objectId} onOpenChange={onOpenChange} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function AccessBody({ eventId, ws, portal, role, objectId, onOpenChange }) {
  const object = ws.objects.find((item) => item.id === objectId);
  const fields = liveFieldsOf(ws.data, objectId);
  const [access, setAccess] = useState(() => ({ ...blankAccess(), ...(role.access?.[objectId] ?? {}) }));
  const [busy, setBusy] = useState(false);
  const [reach, setReach] = useState(null);
  const tokens = { me: portal.portal?.peopleObjectId ?? null };
  const set = (patch) => setAccess((current) => ({ ...current, ...patch }));
  const sees = access.view.mode !== "none";

  useEffect(() => {
    let alive = true;
    portal.api.view({ what: "reach", objectId, as: { mode: "preview", roleIds: [role.id] } }).then(({ data }) => { if (alive) setReach(data); });
    return () => { alive = false; };
  }, [portal.api, objectId, role.id]);

  const save = async () => {
    setBusy(true);
    const clean = (rule) => (rule.mode === "where" ? { mode: "where", filter: cleanRule(rule.filter) } : { mode: rule.mode });
    const next = { ...access, view: clean(access.view), edit: clean(access.edit), delete: clean(access.delete), create: { mode: access.create.mode } };
    const result = await portal.run("role.save", { role: { id: role.id, access: { ...role.access, [objectId]: next } }, expectedRevision: role.revision }, { success: "Access saved" });
    setBusy(false);
    if (!result.error) onOpenChange(false);
  };

  if (!object) return null;
  return (
    <>
      <SheetHeader className="border-b border-border px-5 py-4">
        <SheetTitle className="text-base">{role.name} · {object.plural}</SheetTitle>
        <SheetDescription>
          {reach ? `Right now this role can see ${reach.visible.toLocaleString()} of ${reach.total.toLocaleString()} ${object.plural.toLowerCase()}.` : "What people with this role can do with this list."}
        </SheetDescription>
      </SheetHeader>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
        <ActionRule title={`Which ${object.plural.toLowerCase()} they see`} hint="“Some” uses conditions, like records linked to them." rule={access.view}
          onChange={(view) => set({ view })} data={ws.data} objectId={objectId} tokens={tokens} eventId={eventId} />
        {sees ? (
          <>
            <ActionRule title="Which they can edit" hint="Only among the ones they see. Editable fields are set below." rule={access.edit}
              onChange={(edit) => set({ edit })} data={ws.data} objectId={objectId} tokens={tokens} eventId={eventId} />
            <ActionRule title="Which they can delete" rule={access.delete}
              onChange={(rule) => set({ delete: rule })} data={ws.data} objectId={objectId} tokens={tokens} eventId={eventId} />
          </>
        ) : null}
        <section className="grid gap-3">
          <label className="flex items-center justify-between gap-3">
            <span className="grid gap-0.5"><span className="text-sm font-medium text-foreground">Can add new {object.plural.toLowerCase()}</span>
              <span className="text-xs text-text-secondary">Through forms on pages they can open.</span></span>
            <Switch checked={access.create.mode === "all"} onCheckedChange={(checked) => set({ create: { mode: checked ? "all" : "none" } })} />
          </label>
          {sees ? (
            <>
              <label className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-foreground">Can comment</span>
                <Switch checked={access.comment} onCheckedChange={(comment) => set({ comment })} />
              </label>
              {object.statuses?.length ? (
                <label className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-foreground">Can change the status</span>
                  <Switch checked={access.status} onCheckedChange={(status) => set({ status })} />
                </label>
              ) : null}
            </>
          ) : null}
        </section>
        {sees || access.create.mode === "all" ? (
          <section className="grid gap-2">
            <div className="grid gap-0.5">
              <Label className="text-sm font-medium">Fields</Label>
              <p className="text-xs text-text-secondary">Hidden fields never leave the server. Calculated fields that use a hidden field are hidden too.</p>
            </div>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {fields.map((field) => {
                const Icon = typeIcon(field.type);
                const level = access.fields?.[field.id] ?? "read";
                const isTitle = field.id === object.titleFieldId;
                const editable = getType(field.type).editable && field.type !== "link_event";
                return (
                  <li key={field.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="flex min-w-0 items-center gap-2 text-sm text-foreground">
                      <Icon className="h-3.5 w-3.5 shrink-0 text-text-tertiary" /><span className="truncate">{field.name}</span>
                      {isTitle ? <span className="shrink-0 text-xs text-text-tertiary">· names each record</span> : null}
                    </span>
                    <span className="flex shrink-0 rounded-md border border-border p-0.5">
                      {LEVELS.map((option) => {
                        const disabled = (option.value === "hidden" && isTitle) || (option.value === "edit" && !editable);
                        const OptionIcon = option.icon;
                        return (
                          <button key={option.value} type="button" disabled={disabled} title={option.label}
                            onClick={() => set({ fields: { ...access.fields, [field.id]: option.value } })}
                            className={cn("inline-flex h-7 items-center gap-1 rounded px-2 text-xs disabled:cursor-not-allowed disabled:opacity-30",
                              level === option.value ? "bg-surface-active font-medium text-foreground" : "text-text-secondary hover:text-foreground")}>
                            <OptionIcon className="h-3 w-3" /><span className="max-sm:hidden">{option.label}</span>
                          </button>
                        );
                      })}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </div>
      <SheetFooter className="flex-row items-center justify-end gap-2 border-t border-border px-5 py-3">
        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button onClick={save} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Save access</Button>
      </SheetFooter>
    </>
  );
}
