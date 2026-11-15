"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, Eye, Loader2, User } from "lucide-react";
import { Button, Input, LucideIcon, Popover, PopoverContent, PopoverTrigger } from "@geiger/ui";
import { cn } from "@/lib/utils";
import { BUILTIN_ROLES } from "@/lib/workspace/portal/contracts.js";

// Who the builder previews as: a role, one person from the people list, or the team (team pages).
export function defaultAs(page, roles) {
  const audience = page?.audience ?? {};
  const custom = roles.filter((role) => !role.builtin);
  const chosen = roles.find((role) => (audience.roles ?? []).includes(role.id) && !role.builtin)
    ?? roles.find((role) => (audience.roles ?? []).includes(role.id))
    ?? (audience.public ? roles.find((role) => role.key === BUILTIN_ROLES.public) : null)
    ?? custom[0] ?? roles[0];
  if (!chosen && audience.team) return { mode: "team", draft: true };
  return chosen ? { mode: "preview", roleIds: [chosen.id] } : { mode: "team", draft: true };
}

export function asLabel(as, roles, personLabel) {
  if (as.mode === "team") return "The team";
  if (as.personId) return personLabel ?? "One person";
  return roles.find((role) => role.id === as.roleIds?.[0])?.name ?? "A role";
}

export function PreviewAs({ portal, value, onChange, allowTeam }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [people, setPeople] = useState(null);
  const [personLabel, setPersonLabel] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    const timer = setTimeout(async () => {
      const { data } = await portal.api.view({ what: "preview_people", q });
      if (alive) setPeople(data?.items ?? []);
    }, 200);
    return () => { alive = false; clearTimeout(timer); };
  }, [open, q, portal.api]);

  const pickRole = (role) => { onChange({ mode: "preview", roleIds: [role.id] }); setOpen(false); };
  const item = (active, onClick, children) => (
    <button type="button" onClick={onClick} className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-subtle", active && "font-medium")}>
      {children}{active ? <Check className="ml-auto h-3.5 w-3.5" /> : null}
    </button>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="max-w-56 font-normal">
          <Eye className="text-text-secondary" />
          <span className="truncate"><span className="text-text-secondary">As </span>{asLabel(value, portal.roles, personLabel)}</span>
          <ChevronDown className="text-text-tertiary" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-1">
        <p className="px-2 pb-1 pt-1.5 text-xs text-text-tertiary">Roles</p>
        {portal.roles.map((role) => (
          <div key={role.id}>{item(value.mode === "preview" && !value.personId && value.roleIds?.[0] === role.id, () => pickRole(role),
            <><LucideIcon name={role.icon || "user"} className="h-3.5 w-3.5 text-text-secondary" />{role.name}</>)}</div>
        ))}
        {allowTeam ? item(value.mode === "team", () => { onChange({ mode: "team", draft: true }); setOpen(false); }, <><User className="h-3.5 w-3.5 text-text-secondary" />The team</>) : null}
        <div className="mt-1 border-t border-border pt-1">
          <p className="px-2 pb-1 pt-1.5 text-xs text-text-tertiary">A person from the people list</p>
          <div className="px-1 pb-1"><Input className="h-8" placeholder="Search people…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="max-h-48 overflow-y-auto">
            {people === null ? <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-text-tertiary" /></div>
              : people.length ? people.map((person) => (
                <div key={person.id}>{item(value.personId === person.id, () => { setPersonLabel(person.label); onChange({ mode: "preview", personId: person.id }); setOpen(false); },
                  <span className="min-w-0"><span className="block truncate">{person.label}</span>{person.email ? <span className="block truncate text-xs text-text-tertiary">{person.email}</span> : null}</span>)}</div>
              )) : <p className="px-2 py-3 text-center text-xs text-text-tertiary">Nobody found.</p>}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
