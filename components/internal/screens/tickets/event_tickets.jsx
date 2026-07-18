"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  CircleDot,
  Layers,
  ListChecks,
  MoreHorizontal,
  Pencil,
  Plus,
  Ticket,
  Trash2,
} from "lucide-react";

import {
  EditorSectionHeader,
  EmptyState,
  Field,
  SectionCard,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { Badge } from "@/components/ui/badge";
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
import { useEventConfig } from "@/lib/events/use-event-config";
import { useProject } from "@/context/project-context";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { listRecords } from "@/lib/supabase/ticketing";
import { getDietaryConfig } from "@/lib/supabase/dietary";

import { TicketStub } from "./ticket_stub";
import { TIER_COLOR_OPTIONS } from "./constants";

// Accent dot class for a tier color token (falls back to the first option).
const tierDot = (color) =>
  TIER_COLOR_OPTIONS.find((c) => c.value === color)?.dotClass ||
  TIER_COLOR_OPTIONS[0].dotClass;

// One-line summary of a ticket type's rules, for the applied-type hint.
function typeSummary(type) {
  if (!type) return "Type not found";
  const c = type.config || {};
  const vis = c.visibility || "public";
  const q = Array.isArray(c.questionIds) ? c.questionIds.length : 0;
  return [
    c.refund?.refundable ? "Refundable" : "Non-refundable",
    vis.charAt(0).toUpperCase() + vis.slice(1),
    q ? `${q} question${q > 1 ? "s" : ""}` : "no questions",
  ].join(" · ");
}

// Capitalized visibility label from a ticket type's config (Public/Hidden/…).
function visibilityLabel(type) {
  const v = type?.config?.visibility || "public";
  return v.charAt(0).toUpperCase() + v.slice(1);
}

// Dialog for creating/editing a single event ticket's identity + applied type.
function TicketEditDialog({ ticket, types, groups, onClose, onSave }) {
  const [draft, setDraft] = useState(() => ({ ...ticket }));
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const type = draft.ticketTypeId
    ? types.find((t) => t.id === draft.ticketTypeId)
    : null;

  const submit = () => {
    const name = (draft.name || "").trim();
    if (!name) {
      toast.error("Give the ticket a name.");
      return;
    }
    onSave({
      name,
      price: Number(draft.price) || 0,
      qty: Number(draft.qty) || 0,
      description: draft.description || "",
      ticketTypeId: draft.ticketTypeId || null,
      groupId: draft.groupId || null,
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg bg-background">
        <DialogHeader>
          <DialogTitle>Edit ticket</DialogTitle>
          <DialogDescription>
            Set what buyers see and pay, and optionally apply a reusable ticket
            type for its rules and questions.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <Field label="Ticket name">
            <Input
              value={draft.name || ""}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="e.g. General Admission"
              autoFocus
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Price">
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-text-secondary">$</span>
                <Input
                  type="number"
                  min={0}
                  inputMode="decimal"
                  className="tabular-nums"
                  value={draft.price ?? 0}
                  onChange={(e) => set({ price: Number(e.target.value) || 0 })}
                />
              </div>
            </Field>
            <Field label="Quantity">
              <Input
                type="number"
                min={0}
                className="tabular-nums"
                value={draft.qty ?? 0}
                onChange={(e) => set({ qty: Number(e.target.value) || 0 })}
              />
            </Field>
          </div>

          <Field label="Description" hint="Shown to buyers under the ticket name.">
            <Input
              value={draft.description || ""}
              onChange={(e) => set({ description: e.target.value })}
              placeholder="e.g. Includes front-row seating and after-party access."
            />
          </Field>

          {groups.length ? (
            <Field label="Group" hint="Which tier this ticket belongs to.">
              <Select
                value={draft.groupId || "none"}
                onValueChange={(v) => set({ groupId: v === "none" ? null : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Ungrouped" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ungrouped</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.tierId} value={g.tierId}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}

          <Field label="Apply ticket type" hint="Optional — provides rules & questions.">
            <div className="py-1.5">
              <Select
                value={draft.ticketTypeId || "none"}
                onValueChange={(v) =>
                  set({ ticketTypeId: v === "none" ? null : v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="No type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No type</SelectItem>
                  {types.map((ty) => (
                    <SelectItem key={ty.id} value={ty.id}>
                      {ty.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-2 text-xs text-text-secondary">
                {draft.ticketTypeId ? typeSummary(type) : "No rules applied"}
              </p>
            </div>
          </Field>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={submit}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Opt this event's ticket form into the project's Dietary & Accessibility
// inquiry. Stores just a boolean; the questions live on the project config.
function AttachInquiryCard({ event }) {
  const { projectId } = useProject();
  const [cfg, , saveCfg] = useEventConfig(event, "dietaryInquiry", { attach: false });
  const [questions, setQuestions] = useState([]);

  useEffect(() => {
    let alive = true;
    getDietaryConfig(projectId).then((c) => {
      if (alive) setQuestions(c?.questions ?? []);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  return (
    <SectionCard
      title="Dietary & Accessibility inquiry"
      description="Include the workspace inquiry questions in this event's ticket form. Build the question set in Registrations → Dietary & Accessibility."
    >
      <SettingsList>
        <SettingRow
          title="Attach Dietary & Accessibility inquiry"
          description="Ask these questions when someone fills in the ticket form."
          checked={!!cfg.attach}
          onCheckedChange={(v) =>
            saveCfg(
              { attach: v },
              { successMsg: v ? "Inquiry attached." : "Inquiry detached." },
            )
          }
        />
      </SettingsList>

      {cfg.attach ? (
        <div className="mt-4">
          {questions.length ? (
            <div className="space-y-2">
              {questions.map((q) => {
                const TypeIcon = q.type === "multiselect" ? ListChecks : CircleDot;
                return (
                  <div
                    key={q.id}
                    className="flex items-start gap-3 rounded-lg border border-border bg-surface-card px-3 py-2.5"
                  >
                    <TypeIcon className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{q.label}</span>
                        <Badge variant="neutral">
                          {q.type === "multiselect" ? "Multiple" : "Single"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-text-secondary">
              No inquiry questions yet. Add them in Registrations → Dietary & Accessibility.
            </p>
          )}
        </div>
      ) : null}
    </SectionCard>
  );
}

// Event-editor section: the event's purchasable tickets. Each ticket owns its
// identity (name/price/qty/description) and optionally applies a reusable ticket
// TYPE (rules + questions, resolved live at checkout). Tickets render as
// read-only stubs; editing happens in a dialog. Stored on the event's metadata
// bag under `tickets`, which the public page and buy_ticket already read
// (per-ticket inventory keys off each entry's id).
// Actions dropdown for a single ticket stub. `pos`/`section` scope move up/down
// to the ticket's own group so reordering stays within the visible section.
function TicketMenu({ pos, section, onEdit, onMoveUp, onMoveDown, onDelete }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Ticket actions"
          className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40 border-border bg-surface-card shadow-xl">
        <DropdownMenuItem
          className="cursor-pointer gap-2 text-muted-foreground focus:bg-surface-hover focus:text-foreground"
          onClick={onEdit}
        >
          <Pencil className="h-4 w-4" /> Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer gap-2 text-muted-foreground focus:bg-surface-hover focus:text-foreground"
          disabled={pos === 0}
          onClick={onMoveUp}
        >
          <ArrowUp className="h-4 w-4" /> Move up
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer gap-2 text-muted-foreground focus:bg-surface-hover focus:text-foreground"
          disabled={pos === section.length - 1}
          onClick={onMoveDown}
        >
          <ArrowDown className="h-4 w-4" /> Move down
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-surface-strong" />
        <DropdownMenuItem
          className="cursor-pointer gap-2 text-red-300 focus:bg-red-500/10 focus:text-red-300"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4 text-red-300" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function EventTicketsSection({ event, headerItem }) {
  const { projectId } = useProject();
  const { setTab } = useWorkspaceUrl();
  const [tickets, , save] = useEventConfig(event, "tickets", []);
  const [groups, , saveGroups] = useEventConfig(event, "ticketGroups", []);
  const [types, setTypes] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    let alive = true;
    listRecords(projectId, "ticket_type").then((rows) => {
      if (alive) setTypes(rows ?? []);
    });
    listRecords(projectId, "tier").then((rows) => {
      if (alive) setTiers(rows ?? []);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const list = Array.isArray(tickets) ? tickets : [];
  const groupList = useMemo(() => (Array.isArray(groups) ? groups : []), [groups]);
  const typeById = useMemo(() => {
    const m = new Map();
    for (const t of types) m.set(t.id, t);
    return m;
  }, [types]);

  const editingTicket = editingId
    ? list.find((t) => t.id === editingId) || null
    : null;

  // Groups added to this event, ordered by tier rank then name. Names/colors are
  // refreshed from the live tier when present; the stored snapshot is the public
  // page's fallback (the tiers table is member-only).
  const orderedGroups = useMemo(() => {
    return groupList
      .map((g) => {
        const live = tiers.find((t) => t.id === g.tierId);
        if (!live) return g;
        const c = live.config || {};
        return {
          tierId: g.tierId,
          name: live.name,
          color: c.color || g.color || "slate",
          rank: c.rank ?? g.rank ?? 1,
          description: c.description ?? g.description ?? "",
        };
      })
      .sort(
        (a, b) =>
          (a.rank ?? 1) - (b.rank ?? 1) ||
          (a.name || "").localeCompare(b.name || ""),
      );
  }, [groupList, tiers]);

  const groupIdSet = useMemo(
    () => new Set(orderedGroups.map((g) => g.tierId)),
    [orderedGroups],
  );
  const ungrouped = list.filter((t) => !t.groupId || !groupIdSet.has(t.groupId));
  const availableTiers = tiers.filter((t) => !groupIdSet.has(t.id));

  // Persist a default ticket immediately, then open the dialog to fill it in.
  const addTicket = (groupId = null) => {
    const id = crypto.randomUUID();
    save([
      ...list,
      { id, name: "General Admission", price: 0, qty: 0, description: "", ticketTypeId: null, groupId },
    ]);
    setEditingId(id);
  };

  const addGroup = (tier) => {
    if (groupIdSet.has(tier.id)) return;
    const c = tier.config || {};
    saveGroups(
      [
        ...groupList,
        { tierId: tier.id, name: tier.name, color: c.color || "slate", rank: c.rank ?? 1, description: c.description ?? "" },
      ],
      { successMsg: `Added ${tier.name} group.` },
    );
  };

  // Remove a group; its tickets fall back to ungrouped (never deleted).
  const removeGroup = (tierId) => {
    saveGroups(groupList.filter((g) => g.tierId !== tierId), { successMsg: "Group removed." });
    if (list.some((t) => t.groupId === tierId)) {
      save(list.map((t) => (t.groupId === tierId ? { ...t, groupId: null } : t)));
    }
  };

  const saveEdit = (patch) => {
    save(list.map((t) => (t.id === editingId ? { ...t, ...patch } : t)), {
      successMsg: "Ticket saved.",
    });
    setEditingId(null);
  };

  const removeTicket = (id) =>
    save(list.filter((t) => t.id !== id), { successMsg: "Ticket removed." });

  // Swap two tickets (by id) within the global list, preserving other positions.
  const swap = (idA, idB) => {
    const next = [...list];
    const ia = next.findIndex((t) => t.id === idA);
    const ib = next.findIndex((t) => t.id === idB);
    if (ia < 0 || ib < 0) return;
    [next[ia], next[ib]] = [next[ib], next[ia]];
    save(next);
  };

  // Render a section's tickets (move up/down scoped to that section's order).
  const renderTickets = (section) =>
    section.map((t, pos) => {
      const type = t.ticketTypeId ? typeById.get(t.ticketTypeId) : null;
      return (
        <TicketStub
          key={t.id}
          name={t.name}
          price={t.price}
          qty={t.qty}
          description={t.description}
          typeName={type?.name || null}
          visibilityLabel={type ? visibilityLabel(type) : null}
          onEdit={() => setEditingId(t.id)}
          menu={
            <TicketMenu
              pos={pos}
              section={section}
              onEdit={() => setEditingId(t.id)}
              onMoveUp={() => swap(t.id, section[pos - 1]?.id)}
              onMoveDown={() => swap(t.id, section[pos + 1]?.id)}
              onDelete={() => removeTicket(t.id)}
            />
          }
        />
      );
    });

  const addGroupMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
        >
          <Layers className="h-4 w-4" /> Add group <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 border-border bg-surface-card shadow-xl">
        {availableTiers.length ? (
          availableTiers.map((t) => (
            <DropdownMenuItem
              key={t.id}
              className="cursor-pointer gap-2 text-muted-foreground focus:bg-surface-hover focus:text-foreground"
              onClick={() => addGroup(t)}
            >
              <span className={cn("h-2.5 w-2.5 rounded-full", tierDot(t.config?.color))} />
              {t.name}
            </DropdownMenuItem>
          ))
        ) : (
          <DropdownMenuItem
            className="cursor-pointer gap-2 text-muted-foreground focus:bg-surface-hover focus:text-foreground"
            onClick={() => setTab("Ticket Tiers")}
          >
            <Plus className="h-4 w-4" />
            {tiers.length ? "All tiers added — manage" : "Create a tier first"}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const hasContent = list.length > 0 || groupList.length > 0;

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Tickets"}
        description={
          headerItem?.desc ||
          "The tickets buyers can purchase for this event, optionally organised into tier groups. Pricing and rules live on each ticket — create tiers under Tickets → Ticket Tiers."
        }
        action={
          <div className="flex items-center gap-2">
            {addGroupMenu}
            <Button
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => addTicket(null)}
            >
              <Plus className="h-4 w-4" /> Add ticket
            </Button>
          </div>
        }
      />

      {hasContent ? (
        <div className="space-y-6">
          {/* Tier groups, ordered by rank. */}
          {orderedGroups.map((g) => {
            const section = list.filter((t) => t.groupId === g.tierId);
            return (
              <div key={g.tierId} className="space-y-3">
                <div className="flex items-center gap-3 border-b border-border pb-2">
                  <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", tierDot(g.color))} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{g.name}</p>
                    {g.description ? (
                      <p className="truncate text-xs text-text-secondary">{g.description}</p>
                    ) : null}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => addTicket(g.tierId)}
                    className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
                  >
                    <Plus className="h-4 w-4" /> Add ticket
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Remove group"
                    onClick={() => removeGroup(g.tierId)}
                    className="text-text-secondary hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {section.length ? (
                  <div className="space-y-3">{renderTickets(section)}</div>
                ) : (
                  <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-text-secondary">
                    No tickets in this group yet.
                  </p>
                )}
              </div>
            );
          })}

          {/* Ungrouped tickets — labelled only when groups also exist. */}
          {ungrouped.length || !orderedGroups.length ? (
            <div className="space-y-3">
              {orderedGroups.length ? (
                <div className="flex items-center gap-3 border-b border-border pb-2">
                  <span className="text-sm font-semibold text-text-secondary">Ungrouped</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => addTicket(null)}
                    className="ml-auto text-muted-foreground hover:bg-surface-active hover:text-foreground"
                  >
                    <Plus className="h-4 w-4" /> Add ticket
                  </Button>
                </div>
              ) : null}
              {ungrouped.length ? (
                <div className="space-y-3">{renderTickets(ungrouped)}</div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <SectionCard
          title="No tickets yet"
          description="Add a ticket buyers can purchase for this event."
        >
          <EmptyState
            icon={Ticket}
            title="No tickets"
            description="Create a ticket, then optionally organise tickets into tier groups (create tiers under Tickets → Ticket Tiers)."
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => addTicket(null)}
                >
                  <Plus className="h-4 w-4" /> Add ticket
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setTab("Ticket Tiers")}
                  className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                >
                  Manage tiers
                </Button>
              </div>
            }
          />
        </SectionCard>
      )}

      {editingTicket ? (
        <TicketEditDialog
          key={editingId}
          ticket={editingTicket}
          types={types}
          groups={orderedGroups}
          onClose={() => setEditingId(null)}
          onSave={saveEdit}
        />
      ) : null}

      <AttachInquiryCard event={event} />
    </div>
  );
}

export default EventTicketsSection;
