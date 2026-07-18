"use client";

import React, { useState } from "react";
import { Plus, Trash2, Pencil, KeyRound, Ticket } from "lucide-react";
import { toast } from "sonner";

import {
  EditorSectionHeader,
  EmptyState,
  Field,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useEventConfig } from "@/lib/events/use-event-config";
import { EMPTY_ACCESS_CODE } from "@/lib/events/access_codes";

// Access-code (hidden) ticket editor. Codes live in the event metadata bag
// (metadata.accessCodes) — each entry maps a code to the event ticket ids it
// unlocks; those tickets stay hidden on the public page until a buyer enters a
// matching code. See lib/events/access_codes.js for the shape + helpers.

function AccessCodeDialog({ open, onOpenChange, ticketTypes, initial, onSave }) {
  const [draft, setDraft] = useState(EMPTY_ACCESS_CODE);

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setDraft(initial ? { ...EMPTY_ACCESS_CODE, ...initial } : { ...EMPTY_ACCESS_CODE });
  }

  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const toggleTicket = (id) =>
    setDraft((d) => {
      const cur = Array.isArray(d.ticketIds) ? d.ticketIds : [];
      const next = cur.includes(id) ? cur.filter((t) => t !== id) : [...cur, id];
      return { ...d, ticketIds: next };
    });

  const submit = () => {
    if (!draft.code.trim()) {
      toast.error("Give the code a value.");
      return;
    }
    onSave({
      code: draft.code.trim(),
      label: draft.label.trim(),
      ticketIds: Array.isArray(draft.ticketIds) ? draft.ticketIds.map(String) : [],
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto bg-background">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit access code" : "Add access code"}</DialogTitle>
          <DialogDescription>
            A secret code that unlocks hidden tickets. The tickets you pick stay
            off the public page until a buyer enters this code.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5">
          <Field label="Code" htmlFor="code-value">
            <Input
              id="code-value"
              value={draft.code}
              onChange={(e) => set("code")(e.target.value)}
              placeholder="e.g. VIP2026"
              className="font-mono"
              autoFocus
            />
          </Field>
          <Field label="Label" hint="Optional — a note for your own reference" htmlFor="code-label">
            <Input
              id="code-label"
              value={draft.label}
              onChange={(e) => set("label")(e.target.value)}
              placeholder="e.g. VIP guest list"
            />
          </Field>

          <Field label="Unlocks these tickets">
            <p className="-mt-0.5 text-xs text-text-secondary">
              These tickets are hidden until someone enters this code.
            </p>
            {ticketTypes.length ? (
              <div className="flex flex-wrap gap-2">
                {ticketTypes.map((t) => {
                  const active =
                    Array.isArray(draft.ticketIds) && draft.ticketIds.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleTicket(t.id)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                        active
                          ? "border-white bg-white text-[#161616]"
                          : "border-border bg-surface-card text-muted-foreground hover:bg-surface-active",
                      )}
                    >
                      {t.name}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-text-tertiary">
                Add some tickets to this event first, then choose which ones this code unlocks.
              </p>
            )}
          </Field>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={submit}
          >
            {initial ? "Save code" : "Add code"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EventAccessCodesSection({ event, headerItem }) {
  const [codes, , save] = useEventConfig(event, "accessCodes", []);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState(null); // { index, entry } | null

  const list = Array.isArray(codes) ? codes : [];

  // Ticket tiers (id + name) so the "unlocks" chips key on the stable id.
  const ticketTypes = (Array.isArray(event.tickets) ? event.tickets : [])
    .filter((t) => t && t.id)
    .map((t) => ({ id: String(t.id), name: t.name || "Untitled" }));
  const ticketName = (id) => {
    const t = ticketTypes.find((x) => x.id === String(id));
    return t ? t.name : "Removed ticket";
  };

  const openAdd = () => setAddOpen(true);

  const addCode = (entry) =>
    save([...list, { ...entry, id: crypto.randomUUID() }], { successMsg: "Access code saved." });
  const updateCode = (index, entry) =>
    save(
      list.map((c, i) => (i === index ? { ...c, ...entry } : c)),
      { successMsg: "Access code saved." },
    );
  const removeCode = (index) =>
    save(list.filter((_, i) => i !== index), { successMsg: "Access code removed." });

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Access Codes"}
        description={
          headerItem?.desc ||
          "Hide tickets behind a secret code — buyers only see them once they enter a matching code at checkout."
        }
        action={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={openAdd}
          >
            <Plus className="h-4 w-4" /> Add code
          </Button>
        }
      />

      {list.length ? (
        <div className="space-y-3">
          {list.map((raw, i) => {
            const entry = { ...EMPTY_ACCESS_CODE, ...raw };
            const ids = Array.isArray(entry.ticketIds) ? entry.ticketIds : [];
            const count = ids.length;
            return (
              <div
                key={entry.id || i}
                className="rounded-xl border border-border bg-surface-card p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-subtle text-muted-foreground">
                    <KeyRound className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-semibold text-foreground">{entry.code}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary">
                      {entry.label ? <span>{entry.label}</span> : null}
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Ticket className="h-3 w-3" />
                        {count === 1 ? "1 ticket" : `${count} tickets`}
                      </span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setEditing({ index: i, entry })}
                      aria-label="Edit access code"
                      className="text-text-secondary hover:bg-surface-active hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeCode(i)}
                      aria-label="Delete access code"
                      className="text-text-secondary hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {count ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                    {ids.map((id) => (
                      <span
                        key={id}
                        className="rounded-full border border-border bg-surface-subtle px-2.5 py-1 text-xs text-text-secondary"
                      >
                        {ticketName(id)}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={KeyRound}
          title="No access codes yet"
          description="Create a code to hide select tickets until a buyer enters it — perfect for VIP or invite-only tickets."
          action={
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={openAdd}
            >
              <Plus className="h-4 w-4" /> Add code
            </Button>
          }
        />
      )}

      <AccessCodeDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        ticketTypes={ticketTypes}
        onSave={addCode}
      />
      <AccessCodeDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        ticketTypes={ticketTypes}
        initial={editing?.entry}
        onSave={(entry) => {
          updateCode(editing.index, entry);
          setEditing(null);
        }}
      />
    </div>
  );
}

export default EventAccessCodesSection;
