"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Button, Checkbox, Label, LogoLoading, Popover, PopoverContent, PopoverTrigger, Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, Switch,
} from "@geiger/ui";
import { getType } from "@/lib/workspace/schema/types/index.js";
import { liveFieldsOf } from "../state/use_workspace";
import { Muted, OptionChip } from "../ws_ui";
import { useProcess } from "./use_process";

const NEW = "__new__";
const requirable = (field) => getType(field.type)?.editable && getType(field.type)?.cast !== "link";

function FieldsPicker({ fields, value, onChange }) {
  const chosen = new Set(value ?? []);
  const names = fields.filter((field) => chosen.has(field.id)).map((field) => field.name);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-8 max-w-full justify-start font-normal">
          <span className="truncate">{names.length ? names.join(", ") : <Muted>Nothing required</Muted>}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-72 w-64 overflow-y-auto p-1">
        {fields.map((field) => (
          <label key={field.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface-hover">
            <Checkbox checked={chosen.has(field.id)} onCheckedChange={(on) => {
              const next = new Set(chosen);
              if (on) next.add(field.id); else next.delete(field.id);
              onChange([...next]);
            }} />
            <span className="truncate">{field.name}</span>
          </label>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// Which status moves are allowed for a list, and what must be filled in to enter each status.
export function StagesSheet({ open, onOpenChange, eventId, ws, object }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-3xl">
        {open && object ? <StagesBody key={object.id} eventId={eventId} ws={ws} object={object} onOpenChange={onOpenChange} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function StagesBody({ eventId, ws, object, onOpenChange }) {
  const process = useProcess(eventId);
  if (!process.data) {
    return <div className="flex flex-1 items-center justify-center"><LogoLoading size={40} aria-label="Loading stage rules" /></div>;
  }
  return <StagesForm ws={ws} object={object} process={process} onOpenChange={onOpenChange} />;
}

function StagesForm({ ws, object, process, onOpenChange }) {
  const current = process.processes[object.id] ?? { enforce: false, moves: [], requires: {} };
  const [enforce, setEnforce] = useState(current.enforce);
  const [moves, setMoves] = useState(() => new Set(current.moves.map((move) => `${move.from ?? NEW}>${move.to}`)));
  const [requires, setRequires] = useState(current.requires ?? {});
  const [busy, setBusy] = useState(false);
  const statuses = object.statuses ?? [];
  const fields = liveFieldsOf(ws.data, object.id).filter(requirable);
  const rows = [{ key: NEW, label: "A new record" }, ...statuses];

  const toggle = (from, to) => {
    const id = `${from}>${to}`;
    const next = new Set(moves);
    if (next.has(id)) next.delete(id); else next.add(id);
    setMoves(next);
  };
  const allowLinear = () => {
    const next = new Set([`${NEW}>${statuses[0]?.key}`]);
    statuses.forEach((status, index) => { if (statuses[index + 1]) next.add(`${status.key}>${statuses[index + 1].key}`); });
    setMoves(next);
  };

  const save = async () => {
    setBusy(true);
    const config = {
      enforce,
      moves: [...moves].map((id) => { const [from, to] = id.split(">"); return { from: from === NEW ? null : from, to }; }),
      requires,
    };
    const result = await process.run("process.save", { objectId: object.id, config }, { success: "Stage rules saved" });
    setBusy(false);
    if (!result.error) onOpenChange(false);
  };

  return (
    <>
      <SheetHeader className="border-b border-border px-5 py-4">
        <SheetTitle className="text-base">Stage rules · {object.plural}</SheetTitle>
        <SheetDescription>Choose which status changes are allowed, and what must be filled in before a record enters a status. The rules apply to the team, the portal, automations and the API.</SheetDescription>
      </SheetHeader>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
        {!statuses.length ? <p className="text-sm text-text-secondary">Add statuses to {object.plural} in List settings first.</p> : (
          <>
            <label className="flex items-start gap-3 rounded-xl border border-border bg-surface-subtle p-4">
              <Switch checked={enforce} onCheckedChange={setEnforce} />
              <span className="grid gap-0.5">
                <span className="text-sm font-medium text-foreground">Enforce these rules</span>
                <span className="text-xs text-text-secondary">When off, any status change is allowed. People who can set up the workspace can still move a record anyway, and it&apos;s logged.</span>
              </span>
            </label>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label className="text-sm font-medium">Allowed moves</Label>
                <Button type="button" variant="ghost" size="sm" onClick={allowLinear}>Allow each status to move to the next</Button>
              </div>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface-subtle">
                      <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary">From ↓ · To →</th>
                      {statuses.map((status) => <th key={status.key} className="px-2 py-2"><OptionChip option={status} /></th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.key} className="border-b border-border last:border-0">
                        <td className="px-3 py-2">{row.key === NEW ? <span className="text-text-secondary">{row.label}</span> : <OptionChip option={row} />}</td>
                        {statuses.map((status) => (
                          <td key={status.key} className="px-2 py-2 text-center">
                            {row.key === status.key ? <span className="text-text-tertiary">—</span> : (
                              <Checkbox aria-label={`${row.label} to ${status.label}`} checked={moves.has(`${row.key}>${status.key}`)} onCheckedChange={() => toggle(row.key, status.key)} />
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-text-tertiary">If nothing is ticked for “A new record”, new records start in the first status.</p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Required to enter</Label>
              <div className="divide-y divide-border rounded-xl border border-border">
                {statuses.map((status) => (
                  <div key={status.key} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <OptionChip option={status} />
                    <FieldsPicker fields={fields} value={requires[status.key]} onChange={(ids) => setRequires({ ...requires, [status.key]: ids })} />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
      <SheetFooter className="flex-row items-center justify-end gap-2 border-t border-border px-5 py-3">
        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button onClick={save} disabled={busy || !statuses.length}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Save rules</Button>
      </SheetFooter>
    </>
  );
}
