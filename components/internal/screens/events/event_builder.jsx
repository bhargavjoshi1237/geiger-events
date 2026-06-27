"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Ticket, Trash2 } from "lucide-react";

import {
  EditorSectionHeader,
  Field,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEventConfig } from "@/lib/events/use-event-config";

// Create-ticket dialog — a focused flow for adding a new tier (vs. inline-
// editing existing ones below).
function CreateTicketDialog({ open, onOpenChange, onCreate }) {
  const [draft, setDraft] = useState({ name: "", price: "", qty: "" });
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const submit = () => {
    if (!draft.name.trim()) {
      toast.error("Give the ticket a name.");
      return;
    }
    onCreate({
      id: Date.now(),
      name: draft.name.trim(),
      price: Number(draft.price) || 0,
      qty: Number(draft.qty) || 0,
    });
    setDraft({ name: "", price: "", qty: "" });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-background">
        <DialogHeader>
          <DialogTitle>Add ticket type</DialogTitle>
          <DialogDescription>
            Create a new tier attendees can buy.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Name" htmlFor="ticket-name">
            <Input
              id="ticket-name"
              value={draft.name}
              spellCheck={false}
              onChange={(e) => set("name")(e.target.value)}
              placeholder="e.g. General Admission"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Price">
              {/* `$` sits beside the field rather than overlaid — the Input
                  forces its own padding, so an absolute prefix would collide. */}
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-text-secondary">$</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={draft.price}
                  onChange={(e) => set("price")(e.target.value)}
                  className="tabular-nums"
                  placeholder="0"
                />
              </div>
            </Field>
            <Field label="Quantity">
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                value={draft.qty}
                onChange={(e) => set("qty")(e.target.value)}
                className="tabular-nums"
                placeholder="e.g. 100"
              />
            </Field>
          </div>
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
            Add ticket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Basics (name, summary, format) ------------------------------------------

export function BasicsSection({ event, headerItem, onPatch }) {
  // Controlled directly off the lifted event so edits flow to the header,
  // preview, and (on Save) back to the list. No section-local copy to drift.
  const patch = onPatch || (() => {});

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Event details"}
        description={headerItem?.desc}
      />
      <div className="grid gap-4">
        <Field label="Event name">
          <Input
            value={event?.name || ""}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="What's it called?"
          />
        </Field>
        <Field
          label="Short summary"
          hint="Shown in listings and social previews."
        >
          <Textarea
            value={event?.summary || ""}
            onChange={(e) => patch({ summary: e.target.value })}
            rows={3}
            placeholder="One or two lines that sell the event."
          />
        </Field>
        <Field label="Format">
          <Select
            value={event?.type || "In-person"}
            onValueChange={(v) => patch({ type: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="In-person">In-person</SelectItem>
              <SelectItem value="Online">Online</SelectItem>
              <SelectItem value="Hybrid">Hybrid</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
    </div>
  );
}

// --- Tickets -----------------------------------------------------------------

const INITIAL_TICKETS = [
  { id: 1, name: "General Admission", price: 25, qty: 200 },
  { id: 2, name: "Early Bird", price: 18, qty: 80 },
  { id: 3, name: "VIP", price: 60, qty: 40 },
  { id: 4, name: "Student", price: 12, qty: 60 },
];

// The perforation seam: a dashed line punched with a background-coloured notch
// at top and bottom so it reads as a tear line. Reused on both ticket edges.
function Perforation() {
  return (
    <div className="relative flex w-0 items-center" aria-hidden="true">
      <span className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background" />
      <div className="h-full border-l border-dashed border-border-strong" />
      <span className="absolute bottom-0 left-1/2 h-3 w-3 -translate-x-1/2 translate-y-1/2 rounded-full bg-background" />
    </div>
  );
}

// The ticket's left edge: the price shown as a face-value denomination, torn
// off the body by a perforation.
function TicketLeft({ price }) {
  return (
    <>
      <div className="flex w-[4.5rem] shrink-0 items-center justify-center bg-surface-card/50 px-2 py-3 text-center">
        <span className="text-xl font-bold leading-none tabular-nums text-white">
          ${Number(price || 0).toLocaleString()}
        </span>
      </div>
      <Perforation />
    </>
  );
}

// A single tier rendered as an interactable ticket stub: a coloured spine, the
// name as the ticket title, and a perforated stub (with punched notches) that
// holds price + quantity. Every field edits in place.
function TicketCard({ ticket, onChange, onRemove }) {
  const subtotal = (Number(ticket.price) || 0) * (Number(ticket.qty) || 0);

  return (
    <div className="group relative flex items-stretch overflow-hidden rounded-xl border border-border bg-surface-subtle transition-colors hover:border-border-strong focus-within:border-border-strong">
      {/* Coloured spine */}
      <div className="w-1.5 shrink-0 bg-primary/70" aria-hidden="true" />

      {/* Left edge — price denomination */}
      <TicketLeft price={ticket.price} />

      {/* Body — ticket name */}
      <div className="flex min-w-0 flex-1 items-center gap-3 py-3.5 pl-4 pr-3">
        <div className="min-w-0 flex-1">
          <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">
            Ticket name
          </span>
          {/* Raw input so the title can sit borderless on the ticket; the shared
              Input forces its own padding/border, which would break the look. */}
          <input
            value={ticket.name}
            spellCheck={false}
            onChange={(e) => onChange("name", e.target.value)}
            placeholder="Ticket name"
            aria-label="Ticket name"
            className="w-full truncate rounded-sm bg-transparent text-base font-semibold text-white outline-none placeholder:text-text-tertiary focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>
      </div>

      <Perforation />

      <div className="flex shrink-0 items-end gap-3 py-3.5 pl-5 pr-3 sm:pr-4">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
            Price
          </span>
          <div className="flex items-center gap-1">
            <span className="text-sm text-text-secondary">$</span>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              value={ticket.price}
              onChange={(e) => onChange("price", Number(e.target.value))}
              className="w-20 tabular-nums"
              aria-label="Price"
            />
          </div>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
            Qty
          </span>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            value={ticket.qty}
            onChange={(e) => onChange("qty", Number(e.target.value))}
            className="w-20 tabular-nums"
            aria-label="Quantity"
          />
        </label>
        </div>

      {/* Remove */}
      <div className="flex shrink-0 items-center px-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Remove ${ticket.name || "ticket"}`}
          onClick={onRemove}
          className="text-text-secondary opacity-0 transition-opacity hover:bg-red-500/10 hover:text-red-400 focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function TicketsSection({ event, headerItem }) {
  const [tickets, setTickets, saveTickets, saving] = useEventConfig(
    event,
    "tickets",
    INITIAL_TICKETS,
  );

  const [createOpen, setCreateOpen] = useState(false);

  const createTicket = (ticket) =>
    saveTickets([...tickets, ticket], { successMsg: "Ticket added." });
  const removeTicket = (id) => setTickets(tickets.filter((x) => x.id !== id));
  const updateTicket = (id, key, value) =>
    setTickets(tickets.map((x) => (x.id === id ? { ...x, [key]: value } : x)));

  return (
    <div className="space-y-5">
      {/* Own header — title on the left, tier stats pinned to the far right of
          the row (this section opts out of the editor's default header). */}
      <div className="flex flex-col gap-4 pb-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold capitalize text-white">
            {headerItem?.label || "Ticket Types"}
          </h2>
          <p className="mt-0.5 text-sm text-text-secondary">
            {headerItem?.desc || "The ticket tiers attendees can buy."}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setCreateOpen(true)}
          className="shrink-0 border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
        >
          <Plus className="h-4 w-4" /> Add ticket
        </Button>
      </div>

      {tickets.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-surface-subtle px-6 py-10 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface-card text-text-secondary">
            <Ticket className="h-5 w-5" />
          </div>
          <p className="text-sm text-text-secondary">
            No ticket tiers yet. Add one to start selling.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4" /> Add ticket
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <TicketCard
              key={t.id}
              ticket={t}
              onChange={(key, value) => updateTicket(t.id, key, value)}
              onRemove={() => removeTicket(t.id)}
            />
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <Button
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={saving}
          onClick={() => saveTickets(tickets, { successMsg: "Tickets saved." })}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {saving ? "Saving…" : "Save tickets"}
        </Button>
      </div>

      <CreateTicketDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={createTicket}
      />
    </div>
  );
}

// --- Registration settings ---------------------------------------------------

const DEFAULT_REG_SETTINGS = { requireApproval: false, showRemaining: true };

export function RegistrationSettingsSection({ event, headerItem }) {
  const [settings, , saveSettings] = useEventConfig(
    event,
    "regSettings",
    DEFAULT_REG_SETTINGS,
  );
  const set = (key) => (value) =>
    saveSettings({ ...settings, [key]: value });

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Registration Settings"}
        description={headerItem?.desc}
      />
      <SettingsList>
        <SettingRow
          title="Require approval"
          description="Manually approve each registration before it's confirmed."
          checked={settings.requireApproval}
          onCheckedChange={set("requireApproval")}
        />
        <SettingRow
          title="Show tickets remaining"
          description="Display a live count of remaining tickets on the event page."
          checked={settings.showRemaining}
          onCheckedChange={set("showRemaining")}
        />
      </SettingsList>
    </div>
  );
}
