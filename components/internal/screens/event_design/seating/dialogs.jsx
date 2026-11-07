"use client";

import React, { useMemo, useState } from "react";
import { Check, Loader2, Plus, Printer, Search, Trash2, Wand2, X } from "lucide-react";

import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@geiger/ui";
import { Field } from "@/components/internal/shared/screen_kit";
import { PAPER_SIZES } from "@/lib/event_design/seating_print";
import { SEATING_RULE_KINDS, setupStyleLabel } from "@/lib/event_design";
import { cn } from "@/lib/utils";

// Seating Charts dialogs: attach a plan, auto-seat, seating rules, the menu, hand-added guests and print options.

const PRIMARY = "bg-primary text-primary-foreground hover:bg-primary/90";

function useBusy() {
  const [busy, setBusy] = useState(false);
  const run = async (fn) => {
    setBusy(true);
    try {
      return await fn();
    } finally {
      setBusy(false);
    }
  };
  return [busy, run];
}

function SimpleSelect({ value, onChange, options, label }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// --- Attach a plan to the event --------------------------------------------------

export function AttachPlanDialog({ open, onOpenChange, plans, eventName, onAttach }) {
  const [planId, setPlanId] = useState("");
  const [busy, run] = useBusy();
  const options = plans.map((p) => ({
    value: p.id,
    label: `${p.name || "Untitled plan"} · ${setupStyleLabel(p.setupStyle)}${p.eventId ? " (another event)" : ""}`,
  }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Attach a floor plan</DialogTitle>
          <DialogDescription>
            Seat {eventName || "this event"}&apos;s guests on one of your floor plans. Plans already on another event move over.
          </DialogDescription>
        </DialogHeader>
        {options.length ? (
          <Field label="Floor plan">
            <SimpleSelect value={planId || options[0].value} onChange={setPlanId} options={options} label="Floor plan" />
          </Field>
        ) : (
          <p className="text-sm text-text-secondary">No floor plans yet — draw one under Floor Plans first.</p>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className={PRIMARY}
            disabled={!options.length || busy}
            onClick={() =>
              run(async () => {
                if (await onAttach(planId || options[0].value)) onOpenChange(false);
              })
            }
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Attach
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Auto-seat ----------------------------------------------------------------------

const SORT_OPTIONS = [
  { value: "party", label: "Biggest parties first" },
  { value: "ticket", label: "Group by ticket type" },
  { value: "name", label: "Alphabetical" },
];

export function AutoSeatDialog({ open, onOpenChange, unseated, freeSeats, ruleCount, onRun }) {
  const [sortBy, setSortBy] = useState("party");
  const [reseatAll, setReseatAll] = useState(false);
  const [busy, run] = useBusy();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Auto-seat guests</DialogTitle>
          <DialogDescription>
            Fills tables keeping each order, registration and party together, VIPs at VIP tables, and honouring your{" "}
            {ruleCount} seating rule{ruleCount === 1 ? "" : "s"}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm tabular-nums text-text-secondary">
            {unseated} guest{unseated === 1 ? "" : "s"} waiting · {freeSeats} free seat{freeSeats === 1 ? "" : "s"}
          </p>
          <Field label="Order">
            <SimpleSelect value={sortBy} onChange={setSortBy} options={SORT_OPTIONS} label="Seating order" />
          </Field>
          <label className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>
              Start over
              <span className="block text-xs text-text-tertiary">Clears every seat first, instead of filling around them.</span>
            </span>
            <Switch checked={reseatAll} onCheckedChange={setReseatAll} />
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className={PRIMARY}
            disabled={busy || (!reseatAll && !unseated)}
            onClick={() =>
              run(async () => {
                if (await onRun({ sortBy, reseatAll })) onOpenChange(false);
              })
            }
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Auto-seat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Seating rules ----------------------------------------------------------------------

function PickList({ items, selected, onToggle, placeholder }) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? items.filter((i) => `${i.label} ${i.sub || ""}`.toLowerCase().includes(s)) : items;
  }, [items, q]);
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="relative border-b border-border">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          className="rounded-none border-0 pl-9 shadow-none focus-visible:ring-0"
        />
      </div>
      <div className="scrollbar-subtle max-h-56 overflow-y-auto">
        {shown.map((i) => (
          <label key={i.value} className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-surface-active">
            <Checkbox checked={selected.includes(i.value)} onCheckedChange={() => onToggle(i.value)} />
            <span className="min-w-0 flex-1 truncate text-foreground">{i.label}</span>
            {i.sub ? <span className="shrink-0 truncate text-xs text-text-tertiary">{i.sub}</span> : null}
          </label>
        ))}
        {!shown.length ? <p className="px-3 py-4 text-center text-xs text-text-tertiary">Nothing matches.</p> : null}
      </div>
    </div>
  );
}

const RULE_HELP = {
  together: "These guests are always seated at the same table.",
  apart: "No two of these guests share a table.",
  vip_table: "Only VIP guests and their parties are auto-seated here.",
  reserved_table: "Held back from auto-seating — optionally for the guests you pick.",
};

function RuleBody({ rule, guests, blocks, onSave, onDelete, onClose }) {
  const [kind, setKind] = useState(rule?.kind || "together");
  const [label, setLabel] = useState(rule?.label || "");
  const [picked, setPicked] = useState(rule?.guests || []);
  const [tables, setTables] = useState(rule?.items || []);
  const [busy, run] = useBusy();
  const target = SEATING_RULE_KINDS.find((k) => k.value === kind)?.target;
  const toggle = (setter) => (value) => setter((list) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]));
  const guestItems = useMemo(
    () => guests.filter((g) => !g.stale).map((g) => ({ value: g.key, label: g.name, sub: g.partyLabel || g.tier })),
    [guests],
  );
  const tableItems = useMemo(
    () => blocks.filter((b) => b.kind === "table").map((b) => ({ value: b.itemIds[0], label: b.label, sub: `${b.capacity} seats` })),
    [blocks],
  );
  const valid = target === "guests" ? picked.length >= 2 : tables.length >= 1;
  return (
    <>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Rule">
            <SimpleSelect
              value={kind}
              onChange={setKind}
              options={SEATING_RULE_KINDS.map((k) => ({ value: k.value, label: k.label }))}
              label="Rule kind"
            />
          </Field>
          <Field label="Name (optional)">
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Bride's family" />
          </Field>
        </div>
        <p className="text-xs text-text-secondary">{RULE_HELP[kind]}</p>
        {target === "tables" ? (
          <Field label={`Tables (${tables.length})`}>
            <PickList items={tableItems} selected={tables} onToggle={toggle(setTables)} placeholder="Search tables…" />
          </Field>
        ) : null}
        {target === "guests" || kind === "reserved_table" ? (
          <Field label={`Guests (${picked.length})`} hint={target === "guests" ? "Pick at least two." : undefined}>
            <PickList items={guestItems} selected={picked} onToggle={toggle(setPicked)} placeholder="Search guests…" />
          </Field>
        ) : null}
      </div>
      <DialogFooter className="gap-2 sm:justify-between">
        {rule?.id ? (
          <Button
            variant="ghost"
            className="text-red-600 hover:bg-red-500/10 hover:text-red-600 dark:text-red-400"
            onClick={() => run(async () => (await onDelete(rule)) && onClose())}
          >
            <Trash2 className="h-4 w-4" /> Delete rule
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className={PRIMARY}
            disabled={!valid || busy}
            onClick={() =>
              run(async () => {
                const input = {
                  kind,
                  label,
                  guests: target === "guests" || kind === "reserved_table" ? picked : [],
                  items: target === "tables" ? tables : [],
                };
                if (await onSave(input, rule?.id ? rule : null)) onClose();
              })
            }
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Save rule
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}

export function RuleDialog({ rule, onOpenChange, guests, blocks, onSave, onDelete }) {
  return (
    <Dialog open={Boolean(rule)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{rule?.id ? "Edit seating rule" : "New seating rule"}</DialogTitle>
          <DialogDescription>Auto-seat follows these, and the chart flags anything that breaks them.</DialogDescription>
        </DialogHeader>
        {rule ? (
          <RuleBody
            key={rule.id || "new"}
            rule={rule}
            guests={guests}
            blocks={blocks}
            onSave={onSave}
            onDelete={onDelete}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// --- Menu --------------------------------------------------------------------------------

function MenuBody({ meals, onSave, onClose }) {
  const [list, setList] = useState(meals.length ? meals : []);
  const [draft, setDraft] = useState("");
  const [busy, run] = useBusy();
  const add = () => {
    const m = draft.trim();
    if (m && !list.some((x) => x.toLowerCase() === m.toLowerCase())) setList([...list, m]);
    setDraft("");
  };
  return (
    <>
      <div className="space-y-3">
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder="e.g. Beef, Salmon, Wild mushroom risotto"
          />
          <Button variant="outline" className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground" onClick={add} disabled={!draft.trim()}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
        {list.length ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {list.map((m) => (
              <li key={m} className="flex items-center justify-between gap-2 px-3 py-2 text-sm text-foreground">
                {m}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${m}`}
                  className="h-7 w-7 text-text-tertiary hover:text-foreground"
                  onClick={() => setList(list.filter((x) => x !== m))}
                >
                  <X className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-secondary">No choices yet — add each dish guests can pick.</p>
        )}
        <p className="text-xs text-text-tertiary">Guests keep their choice if you rename or remove a dish; it still counts in the tallies.</p>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button className={PRIMARY} disabled={busy} onClick={() => run(async () => (await onSave(list)) && onClose())}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Save menu
        </Button>
      </DialogFooter>
    </>
  );
}

export function MenuDialog({ open, onOpenChange, meals, onSave }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Menu choices</DialogTitle>
          <DialogDescription>The dishes guests choose between on this chart — tallied per table for the caterer.</DialogDescription>
        </DialogHeader>
        {open ? <MenuBody meals={meals} onSave={onSave} onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

// --- Hand-added guest ----------------------------------------------------------------------

function AddGuestBody({ onSave, onClose }) {
  const [draft, setDraft] = useState({ name: "", email: "", party: "" });
  const [busy, run] = useBusy();
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  return (
    <>
      <div className="space-y-3">
        <Field label="Name">
          <Input value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="Full name" autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email (optional)">
            <Input type="email" value={draft.email} onChange={(e) => set({ email: e.target.value })} />
          </Field>
          <Field label="Party (optional)">
            <Input value={draft.party} onChange={(e) => set({ party: e.target.value })} placeholder="e.g. Smith family" />
          </Field>
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          className={PRIMARY}
          disabled={!draft.name.trim() || busy}
          onClick={() => run(async () => (await onSave(draft)) && onClose())}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add guest
        </Button>
      </DialogFooter>
    </>
  );
}

export function AddGuestDialog({ open, onOpenChange, onSave }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a guest</DialogTitle>
          <DialogDescription>
            For people without a ticket or registration — a speaker&apos;s partner, the band, staff at a table.
          </DialogDescription>
        </DialogHeader>
        {open ? <AddGuestBody onSave={onSave} onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

// --- Print -----------------------------------------------------------------------------------

export const PRINT_KINDS = {
  list: { title: "Seating list", description: "Every table with its guests, then an alphabetical find-your-table list." },
  cards: { title: "Place cards", description: "Folded tent cards, four to a sheet — cut on the dashed lines, fold on the dotted one." },
  signs: { title: "Table signs", description: "One folded tent sign per table." },
  caterer: { title: "Caterer summary", description: "Meals per table with dietary and access notes, plus totals." },
};

export function PrintDialog({ kind, onOpenChange, onPrint }) {
  const [paper, setPaper] = useState("a4");
  const [showMeal, setShowMeal] = useState(true);
  const meta = kind ? PRINT_KINDS[kind] : null;
  return (
    <Dialog open={Boolean(kind)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{meta?.title}</DialogTitle>
          <DialogDescription>{meta?.description} Opens a print-ready page in a new tab.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Paper">
            <SimpleSelect
              value={paper}
              onChange={setPaper}
              options={Object.entries(PAPER_SIZES).map(([value, p]) => ({ value, label: p.label }))}
              label="Paper size"
            />
          </Field>
          {kind === "cards" ? (
            <label className={cn("flex items-center justify-between gap-3 text-sm text-muted-foreground")}>
              Print the meal choice (for servers)
              <Switch checked={showMeal} onCheckedChange={setShowMeal} />
            </label>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className={PRIMARY} onClick={() => onPrint({ kind, paper, showMeal })}>
            <Printer className="h-4 w-4" /> Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
