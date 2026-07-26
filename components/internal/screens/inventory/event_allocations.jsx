"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  Loader2,
  MoreHorizontal,
  PackageCheck,
  Plus,
  Store,
  Trash2,
  Undo2,
} from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  Field,
  ScreenHeader,
  SearchInput,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { useProject } from "@/context/project-context";
import { getUser } from "@/lib/supabase/user";
import { listEvents } from "@/lib/supabase/events";
import { listProjectOrders } from "@/lib/supabase/orders";
import {
  listItems,
  listAllocations,
  createAllocation,
  updateAllocation,
  softDeleteAllocation,
  issueAllocation,
  returnAllocation,
} from "@/lib/supabase/inventory";
import { stockableItems, projectedDemand } from "@/lib/inventory/demand";
import { redeemedByAllocation, ruleSummary } from "@/lib/inventory/entitlements";
import {
  buildInventoryPurchasable,
  mergePurchasable,
  purchasableIdFor,
  removePurchasable,
} from "@/lib/inventory/sell";
import { updateEventMeta } from "@/lib/supabase/events";
import { listRedemptions } from "@/lib/supabase/inventory_issuing";
import { conferenceApi } from "@/lib/supabase/conference";
import AudienceBuilder from "@/components/internal/shared/audience/audience_builder";

import { ItemThumb } from "./item_image";
import { PeriodEditor, SellAddonDialog, SessionPicker } from "./allocation_rules";
import {
  ALLOCATION_STATUS_FILTER_OPTIONS,
  ALLOCATION_STATUS_MAP,
  ALLOCATION_STATUS_OPTIONS,
  BUYER_ISSUANCE_MODES,
  ISSUANCE_FILTER_OPTIONS,
  ISSUANCE_MAP,
  ISSUANCE_OPTIONS,
  itemLabel,
  qty,
} from "./constants";

// --- Allocate dialog ---------------------------------------------------------

// The issuance mode decides which buyer link is shown: none for internal,
// a ticket multi-select for ticket-based, a purchasable picker for add-ons.
// `items` are the selectable leaves; `allItems` is the full catalog, so a
// variant's thumbnail can fall back to its parent's photo.
function AllocateDialog({
  open,
  onOpenChange,
  items,
  allItems,
  events,
  sessions,
  projectId,
  onCreate,
  pending,
}) {
  const [eventId, setEventId] = useState("");
  const [itemId, setItemId] = useState("");
  const [plannedQty, setPlannedQty] = useState("");
  const [issuance, setIssuance] = useState("internal");
  const [ticketIds, setTicketIds] = useState([]);
  const [purchasableId, setPurchasableId] = useState("");
  const [qtyPerAttendee, setQtyPerAttendee] = useState("1");
  const [status, setStatus] = useState("Planned");
  const [sessionIds, setSessionIds] = useState([]);
  const [audience, setAudience] = useState({});
  const [rule, setRule] = useState({ periodMode: "none", periodConfig: {} });

  const event = events.find((e) => e.id === eventId) || null;
  const tickets = Array.isArray(event?.tickets) ? event.tickets : [];
  const purchasables = Array.isArray(event?.purchasables) ? event.purchasables : [];
  const buyerMode = BUYER_ISSUANCE_MODES.includes(issuance);

  // Tags and segments can't be evaluated by the issuing RPCs (they live in the
  // contacts/segments tables), so a spec using them would entitle nobody.
  const unsupportedAudience =
    issuance === "audience" &&
    audience?.mode === "filtered" &&
    Boolean(audience?.filters?.tags?.length || audience?.filters?.segmentId);

  const toggleTicket = (id) =>
    setTicketIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );

  const toggleSession = (id) =>
    setSessionIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );

  const submit = () => {
    if (!eventId) {
      toast.error("Pick an event.");
      return;
    }
    if (!itemId) {
      toast.error("Pick an item.");
      return;
    }
    if (issuance === "ticket" && !ticketIds.length) {
      toast.error("Choose at least one ticket that entitles this item.");
      return;
    }
    if (issuance === "addon" && !purchasableId) {
      toast.error("Choose the add-on this item backs.");
      return;
    }
    if (issuance === "session" && !sessionIds.length) {
      toast.error("Choose at least one session that entitles this item.");
      return;
    }
    onCreate({
      eventId,
      itemId,
      plannedQty: Number(plannedQty) || 0,
      issuance,
      ticketIds: issuance === "ticket" ? ticketIds : [],
      purchasableId: issuance === "addon" ? purchasableId : "",
      sessionIds: issuance === "session" ? sessionIds : [],
      audience: issuance === "audience" ? audience : {},
      qtyPerAttendee: Number(qtyPerAttendee) || 1,
      // A collection rule only means something when a buyer is on the other
      // end; internal stock is issued walk-up.
      periodMode: buyerMode ? rule.periodMode : "none",
      periodConfig: buyerMode ? rule.periodConfig : {},
      status,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Allocate stock to an event</DialogTitle>
          <DialogDescription>
            Commit an item to an event and say how it reaches people — internally,
            with a ticket, or as a paid add-on.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Event">
              <Select value={eventId} onValueChange={setEventId}>
                <SelectTrigger className="bg-surface-card">
                  <SelectValue placeholder="Choose an event" />
                </SelectTrigger>
                <SelectContent>
                  {events.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name || "Untitled event"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Item">
              <div className="flex items-center gap-2.5">
                <ItemThumb
                  item={items.find((i) => i.id === itemId) || null}
                  items={allItems}
                />
                <Select value={itemId} onValueChange={setItemId}>
                  <SelectTrigger className="flex-1 bg-surface-card">
                    <SelectValue placeholder="Choose an item" />
                  </SelectTrigger>
                  <SelectContent>
                    {items.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {itemLabel(i)} · {qty(i.onHand)} on hand
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Planned quantity" hint="How much you're committing">
              <Input
                type="number"
                min="0"
                value={plannedQty}
                placeholder="0"
                onChange={(e) => setPlannedQty(e.target.value)}
                className="bg-surface-card"
              />
            </Field>
            <Field label="Status">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="bg-surface-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALLOCATION_STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Issuance" hint={ISSUANCE_MAP[issuance]?.hint}>
            <Select value={issuance} onValueChange={setIssuance}>
              <SelectTrigger className="bg-surface-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ISSUANCE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {issuance === "ticket" ? (
            <Field label="Entitled tickets" hint="Buyers of these tickets get one">
              {tickets.length ? (
                  <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border bg-surface-card p-2">
                    {tickets.map((t) => (
                      <label
                        key={t.id}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-text-secondary hover:bg-surface-hover"
                      >
                        <Checkbox
                          checked={ticketIds.includes(t.id)}
                          onCheckedChange={() => toggleTicket(t.id)}
                        />
                        {t.name || "Untitled ticket"}
                      </label>
                    ))}
                  </div>
              ) : (
                <p className="rounded-lg border border-border bg-surface-card px-3 py-2 text-xs text-text-tertiary">
                  {eventId
                    ? "This event has no tickets yet."
                    : "Pick an event to choose its tickets."}
                </p>
              )}
            </Field>
          ) : null}

          {issuance === "session" ? (
            <Field
              label="Entitled sessions"
              hint="Attendees signed up for any of these get one."
            >
              <SessionPicker
                sessions={sessions}
                selected={sessionIds}
                onToggle={toggleSession}
              />
            </Field>
          ) : null}

          {issuance === "audience" ? (
            <Field label="Audience" hint="Who this item is for.">
              <div className="space-y-2">
                <AudienceBuilder
                  projectId={projectId}
                  eventId={eventId}
                  spec={audience}
                  onSpecChange={setAudience}
                />
                {unsupportedAudience ? (
                  <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                    Tag and segment filters can&apos;t be checked at the issuing
                    desk, so this audience would entitle nobody. Target by ticket,
                    add-on or named buyers instead.
                  </p>
                ) : null}
              </div>
            </Field>
          ) : null}

          {issuance === "addon" ? (
            <Field label="Add-on" hint="Demand follows sales of this add-on">
              {purchasables.length ? (
                <Select value={purchasableId} onValueChange={setPurchasableId}>
                  <SelectTrigger className="bg-surface-card">
                    <SelectValue placeholder="Choose an add-on" />
                  </SelectTrigger>
                  <SelectContent>
                    {purchasables.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name || "Untitled add-on"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="rounded-lg border border-border bg-surface-card px-3 py-2 text-xs text-text-tertiary">
                  {eventId
                    ? "This event has no add-ons configured."
                    : "Pick an event to choose its add-ons."}
                </p>
              )}
            </Field>
          ) : null}

          {buyerMode ? (
            <>
              <Field label="Units per attendee" hint="Usually 1">
                <Input
                  type="number"
                  min="0"
                  value={qtyPerAttendee}
                  onChange={(e) => setQtyPerAttendee(e.target.value)}
                  className="bg-surface-card"
                />
              </Field>
              <PeriodEditor value={rule} onChange={setRule} />
            </>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="bg-primary" onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Allocate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Issue stock out to an event, or take unused stock back.
function IssueDialog({
  open,
  onOpenChange,
  mode,
  allocation,
  item,
  allItems,
  onConfirm,
  pending,
}) {
  const outstanding = Math.max(
    0,
    Number(allocation?.plannedQty || 0) - Number(allocation?.issuedQty || 0),
  );
  const max = mode === "issue" ? outstanding : Number(allocation?.issuedQty || 0);
  const [amount, setAmount] = useState(String(max || ""));

  const submit = () => {
    const value = Number(amount) || 0;
    if (value <= 0) {
      toast.error("Enter a quantity above zero.");
      return;
    }
    if (mode === "issue" && value > Number(item?.onHand || 0)) {
      toast.error(`Only ${qty(item?.onHand)} on hand.`);
      return;
    }
    if (value > max) {
      toast.error(
        mode === "issue"
          ? `Only ${qty(max)} left to issue on this allocation.`
          : `Only ${qty(max)} has been issued.`,
      );
      return;
    }
    onConfirm(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {mode === "issue" ? "Issue stock" : "Return stock"}
          </DialogTitle>
          <DialogDescription>
            {mode === "issue"
              ? `${qty(outstanding)} still to issue · ${qty(item?.onHand)} on hand.`
              : `${qty(allocation?.issuedQty)} issued so far.`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-card px-3 py-2">
          <ItemThumb item={item} items={allItems} />
          <span className="truncate text-sm font-medium text-foreground">
            {item ? itemLabel(item) : "Deleted item"}
          </span>
        </div>

        <Field label="Quantity">
          <Input
            type="number"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="bg-surface-card"
          />
        </Field>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="bg-primary" onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {mode === "issue" ? "Issue" : "Return"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Screen ------------------------------------------------------------------

export function EventAllocationsScreen() {
  const { projectId } = useProject();
  const [allocations, setAllocations] = useState([]);
  const [items, setItems] = useState([]);
  const [events, setEvents] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [issuanceFilter, setIssuanceFilter] = useState("all");
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState(false);
  const [issueTarget, setIssueTarget] = useState(null); // { allocation, mode }
  const [sessions, setSessions] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [sellTarget, setSellTarget] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      listAllocations(projectId),
      listItems(projectId),
      listEvents(projectId),
      listProjectOrders(projectId),
      conferenceApi.list(projectId, "session"),
      listRedemptions(projectId, { status: "issued" }),
    ]).then(([allocs, rows, evts, ords, sess, reds]) => {
      if (!alive) return;
      setAllocations(allocs ?? []);
      setItems(rows ?? []);
      setEvents(evts ?? []);
      setOrders(ords ?? []);
      setSessions(sess ?? []);
      setRedemptions(reds ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const eventsById = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  const stocked = useMemo(() => stockableItems(items), [items]);

  const ordersByEvent = useMemo(() => {
    const map = new Map();
    for (const o of orders) {
      const bucket = map.get(o.eventId) || [];
      bucket.push(o);
      map.set(o.eventId, bucket);
    }
    return map;
  }, [orders]);

  const collectedByAllocation = useMemo(
    () => redeemedByAllocation(redemptions),
    [redemptions],
  );

  // Decorate each allocation with its projected demand, what has actually been
  // collected, and the shortfall. `reserved` is demand not yet collected — the
  // units already spoken for, which is what reduces available-to-promise.
  const decorated = useMemo(
    () =>
      allocations.map((a) => {
        const event = eventsById.get(a.eventId) || null;
        const demand = projectedDemand(a, event, ordersByEvent.get(a.eventId) || []);
        const collected = collectedByAllocation.get(a.id) || 0;
        return {
          ...a,
          item: itemsById.get(a.itemId) || null,
          eventName: event?.name || "Untitled event",
          demand,
          collected,
          reserved: Math.max(0, demand - collected),
          shortfall: Math.max(0, demand - Number(a.plannedQty || 0)),
        };
      }),
    [allocations, eventsById, itemsById, ordersByEvent, collectedByAllocation],
  );

  const eventFilterOptions = useMemo(
    () => [
      { value: "all", label: "All events" },
      ...events.map((e) => ({ value: e.id, label: e.name || "Untitled event" })),
    ],
    [events],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return decorated
      .filter((a) => {
        if (eventFilter !== "all" && a.eventId !== eventFilter) return false;
        if (statusFilter !== "all" && a.status !== statusFilter) return false;
        if (issuanceFilter !== "all" && a.issuance !== issuanceFilter) return false;
        if (q) {
          const hay = `${itemLabel(a.item)} ${a.eventName} ${a.notes}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      // Cluster by event so one event's commitments read together.
      .sort((a, b) => a.eventName.localeCompare(b.eventName));
  }, [decorated, search, eventFilter, statusFilter, issuanceFilter]);

  const stats = useMemo(() => {
    const planned = decorated.reduce((s, a) => s + Number(a.plannedQty || 0), 0);
    const issued = decorated.reduce((s, a) => s + Number(a.issuedQty || 0), 0);
    const short = decorated.filter((a) => a.shortfall > 0);
    const shortUnits = short.reduce((s, a) => s + a.shortfall, 0);
    return [
      {
        label: "Allocations",
        value: String(decorated.length),
        footer: `${new Set(decorated.map((a) => a.eventId)).size} events`,
      },
      { label: "Planned", value: qty(planned), footer: "Units committed" },
      { label: "Issued", value: qty(issued), footer: "Handed out" },
      {
        label: "Short",
        value: qty(shortUnits),
        footer: `${short.length} allocation${short.length === 1 ? "" : "s"} under demand`,
      },
    ];
  }, [decorated]);

  const handleCreate = async (draft) => {
    setPending(true);
    const user = await getUser();
    const id = crypto.randomUUID();
    const optimistic = {
      id,
      projectId,
      ...draft,
      issuedQty: 0,
      notes: "",
      config: {},
      createdBy: user?.id ?? null,
      createdAt: new Date().toISOString(),
    };
    setAllocations((prev) => [optimistic, ...prev]);
    const created = await createAllocation(optimistic);
    setPending(false);
    if (!created) {
      setAllocations((prev) => prev.filter((a) => a.id !== id));
      toast.error("Couldn't save the allocation.");
      return;
    }
    setAllocations((prev) => prev.map((a) => (a.id === id ? created : a)));
    setCreating(false);
    toast.success("Stock allocated.");
  };

  const handleStatus = async (allocation, status) => {
    setAllocations((prev) =>
      prev.map((a) => (a.id === allocation.id ? { ...a, status } : a)),
    );
    const saved = await updateAllocation(allocation.id, { status });
    if (!saved) {
      setAllocations((prev) =>
        prev.map((a) =>
          a.id === allocation.id ? { ...a, status: allocation.status } : a,
        ),
      );
      toast.error("Couldn't update the allocation.");
    }
  };

  const handleDelete = async (allocation) => {
    setAllocations((prev) => prev.filter((a) => a.id !== allocation.id));
    toast.success("Allocation removed.");
    const ok = await softDeleteAllocation(allocation.id);
    if (!ok) {
      setAllocations((prev) => [allocation, ...prev]);
      toast.error("Couldn't remove the allocation.");
    }
  };

  // Issue/return go through the data layer so the movement and the allocation
  // stay in step; the item's on-hand is patched locally to match the ledger.
  const handleIssueOrReturn = async (amount) => {
    const { allocation, mode } = issueTarget;
    setPending(true);
    const saved =
      mode === "issue"
        ? await issueAllocation(allocation, amount)
        : await returnAllocation(allocation, amount);
    setPending(false);
    if (!saved) {
      toast.error(
        mode === "issue" ? "Couldn't issue the stock." : "Couldn't return the stock.",
      );
      return;
    }
    setAllocations((prev) => prev.map((a) => (a.id === saved.id ? saved : a)));
    setItems((prev) =>
      prev.map((i) =>
        i.id === allocation.itemId
          ? {
              ...i,
              onHand:
                Number(i.onHand || 0) + (mode === "issue" ? -amount : amount),
            }
          : i,
      ),
    );
    setIssueTarget(null);
    toast.success(mode === "issue" ? "Stock issued." : "Stock returned.");
  };

  // --- Selling an item as a checkout add-on ---------------------------------
  //
  // Writes the purchasable into the event's metadata and points the allocation
  // at it, so a purchase entitles the buyer and the desk hands the item over.
  const handlePublish = async (draft) => {
    const allocation = sellTarget;
    const event = eventsById.get(allocation.eventId);
    if (!event) {
      toast.error("Couldn't find that event.");
      return;
    }
    setPending(true);
    const entry = buildInventoryPurchasable({
      allocation,
      item: allocation.item,
      ...draft,
    });
    const next = mergePurchasable(event.purchasables, entry);
    const metaOk = await updateEventMeta(allocation.eventId, { purchasables: next });
    if (!metaOk) {
      setPending(false);
      toast.error("Couldn't publish the add-on to the event.");
      return;
    }

    const patch = {
      issuance: "addon",
      purchasableId: entry.id,
      config: { ...(allocation.config || {}), sale: { published: true, ...draft } },
    };
    const saved = await updateAllocation(allocation.id, patch);
    setPending(false);
    if (!saved) {
      toast.error("Published, but couldn't link it to the allocation.");
      return;
    }
    setAllocations((prev) => prev.map((a) => (a.id === saved.id ? saved : a)));
    setEvents((prev) =>
      prev.map((e) => (e.id === event.id ? { ...e, purchasables: next } : e)),
    );
    setSellTarget(null);
    toast.success("On sale at checkout.");
  };

  const handleUnpublish = async () => {
    const allocation = sellTarget;
    const event = eventsById.get(allocation.eventId);
    setPending(true);
    const next = removePurchasable(
      event?.purchasables,
      purchasableIdFor(allocation.id),
    );
    const metaOk = await updateEventMeta(allocation.eventId, { purchasables: next });
    if (!metaOk) {
      setPending(false);
      toast.error("Couldn't remove the add-on.");
      return;
    }
    const saved = await updateAllocation(allocation.id, {
      config: {
        ...(allocation.config || {}),
        sale: { ...(allocation.config?.sale || {}), published: false },
      },
    });
    setPending(false);
    if (saved) {
      setAllocations((prev) => prev.map((a) => (a.id === saved.id ? saved : a)));
    }
    setEvents((prev) =>
      prev.map((e) => (e.id === event?.id ? { ...e, purchasables: next } : e)),
    );
    setSellTarget(null);
    toast.success("Removed from checkout.");
  };

  const columns = [
    {
      key: "item",
      header: "Item",
      // Takes the table's spare width so the rest hug their values.
      className: "w-full",
      headClassName: "w-full",
      render: (a) => (
        <div className="flex items-center gap-3">
          <ItemThumb item={a.item} items={items} />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate font-medium text-foreground">
              {a.item ? itemLabel(a.item) : "Deleted item"}
            </span>
            <span className="truncate text-xs text-text-secondary">
              {a.eventName}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "issuance",
      header: "Issuance",
      className: "whitespace-nowrap",
      headClassName: "whitespace-nowrap",
      render: (a) => (
        <div className="flex flex-col gap-0.5">
          <StatusPill status={a.issuance} map={ISSUANCE_MAP} />
          {BUYER_ISSUANCE_MODES.includes(a.issuance) ? (
            <span className="text-xs text-text-tertiary">{ruleSummary(a)}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: "collected",
      header: "Collected",
      align: "right",
      className: "whitespace-nowrap text-right tabular-nums text-text-secondary",
      headClassName: "whitespace-nowrap",
      render: (a) => (a.collected ? qty(a.collected) : <span className="text-text-tertiary">—</span>),
    },
    {
      key: "planned",
      header: "Planned",
      align: "right",
      className: "whitespace-nowrap text-right tabular-nums text-text-secondary",
      headClassName: "whitespace-nowrap",
      render: (a) => qty(a.plannedQty),
    },
    {
      key: "issued",
      header: "Issued",
      align: "right",
      className: "whitespace-nowrap text-right tabular-nums text-text-secondary",
      headClassName: "whitespace-nowrap",
      render: (a) => qty(a.issuedQty),
    },
    {
      key: "demand",
      header: "Demand",
      align: "right",
      className: "whitespace-nowrap text-right tabular-nums",
      headClassName: "whitespace-nowrap",
      render: (a) => (
        <span className="font-semibold text-foreground">{qty(a.demand)}</span>
      ),
    },
    {
      key: "shortfall",
      header: "Short",
      align: "right",
      className: "whitespace-nowrap text-right tabular-nums",
      headClassName: "whitespace-nowrap",
      render: (a) =>
        a.shortfall > 0 ? (
          <span className="font-semibold text-red-400">-{qty(a.shortfall)}</span>
        ) : (
          <span className="text-text-tertiary">—</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      className: "whitespace-nowrap",
      headClassName: "whitespace-nowrap",
      render: (a) => <StatusPill status={a.status} map={ALLOCATION_STATUS_MAP} />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (a) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Allocation actions"
                className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-48 border-border bg-surface-card shadow-xl"
            >
              <DropdownMenuItem
                className="cursor-pointer gap-2 text-muted-foreground focus:bg-surface-hover focus:text-foreground"
                onClick={() => setIssueTarget({ allocation: a, mode: "issue" })}
              >
                <PackageCheck className="h-4 w-4" /> Issue stock
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer gap-2 text-muted-foreground focus:bg-surface-hover focus:text-foreground"
                disabled={!Number(a.issuedQty)}
                onClick={() => setIssueTarget({ allocation: a, mode: "return" })}
              >
                <Undo2 className="h-4 w-4" /> Return stock
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-surface-strong" />
              <DropdownMenuItem
                className="cursor-pointer gap-2 text-muted-foreground focus:bg-surface-hover focus:text-foreground"
                onClick={() => setSellTarget(a)}
              >
                <Store className="h-4 w-4" />
                {a.config?.sale?.published ? "Add-on settings" : "Sell as add-on"}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-surface-strong" />
              {ALLOCATION_STATUS_OPTIONS.filter((s) => s.value !== a.status).map(
                (s) => (
                  <DropdownMenuItem
                    key={s.value}
                    className="cursor-pointer gap-2 text-muted-foreground focus:bg-surface-hover focus:text-foreground"
                    onClick={() => handleStatus(a, s.value)}
                  >
                    Mark {s.label.toLowerCase()}
                  </DropdownMenuItem>
                ),
              )}
              <DropdownMenuSeparator className="bg-surface-strong" />
              <DropdownMenuItem
                className="cursor-pointer gap-2 text-red-300 focus:bg-red-500/10 focus:text-red-300"
                onClick={() => handleDelete(a)}
              >
                <Trash2 className="h-4 w-4 text-red-300" /> Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Event Allocations"
        description="Commit stock to events and see whether it covers demand. Ticket-based and add-on allocations project demand from live sales."
        actions={
          <Button
            className="bg-primary gap-2"
            onClick={() => setCreating(true)}
            disabled={!stocked.length || !events.length}
          >
            <Plus className="h-4 w-4" /> Allocate stock
          </Button>
        }
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex items-center gap-2">
          <FilterDropdown
            value={eventFilter}
            onValueChange={setEventFilter}
            options={eventFilterOptions}
            height="h-9"
          />
          <FilterDropdown
            value={issuanceFilter}
            onValueChange={setIssuanceFilter}
            options={ISSUANCE_FILTER_OPTIONS}
            height="h-9"
          />
          <FilterDropdown
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={ALLOCATION_STATUS_FILTER_OPTIONS}
            height="h-9"
          />
        </div>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search item or event…"
          className="w-full sm:max-w-xs"
        />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading allocations…
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(a) => a.id}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              <EmptyState
                icon={CalendarDays}
                title={
                  allocations.length
                    ? "No allocations match your filters"
                    : "Nothing allocated yet"
                }
                description={
                  allocations.length
                    ? "Try clearing the search or filters."
                    : "Commit stock to an event to plan what you'll need on the day."
                }
                action={
                  allocations.length ? (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setSearch("");
                        setEventFilter("all");
                        setStatusFilter("all");
                        setIssuanceFilter("all");
                      }}
                    >
                      Clear filters
                    </Button>
                  ) : null
                }
              />
            </div>
          }
        />
      )}

      <AllocateDialog
        key={creating ? "allocate-open" : "allocate-closed"}
        open={creating}
        onOpenChange={setCreating}
        items={stocked}
        allItems={items}
        events={events}
        sessions={sessions}
        projectId={projectId}
        pending={pending}
        onCreate={handleCreate}
      />

      {sellTarget ? (
        <SellAddonDialog
          open
          onOpenChange={(o) => !o && setSellTarget(null)}
          allocation={sellTarget}
          item={sellTarget.item}
          allItems={items}
          available={Math.max(
            0,
            Number(sellTarget.item?.onHand || 0) - Number(sellTarget.reserved || 0),
          )}
          onPublish={handlePublish}
          onUnpublish={handleUnpublish}
          pending={pending}
        />
      ) : null}

      <IssueDialog
        key={issueTarget ? `${issueTarget.mode}-${issueTarget.allocation.id}` : "issue-closed"}
        open={!!issueTarget}
        onOpenChange={(o) => !o && setIssueTarget(null)}
        mode={issueTarget?.mode}
        allocation={issueTarget?.allocation}
        item={issueTarget ? itemsById.get(issueTarget.allocation.itemId) : null}
        allItems={items}
        pending={pending}
        onConfirm={handleIssueOrReturn}
      />
    </MainScreenWrapper>
  );
}

export default EventAllocationsScreen;
