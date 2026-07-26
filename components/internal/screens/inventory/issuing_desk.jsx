"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  HandHeart,
  Loader2,
  MoreHorizontal,
  PackageCheck,
  Plus,
  ShieldAlert,
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
import { listEvents } from "@/lib/supabase/events";
import { listAllocations, listItems } from "@/lib/supabase/inventory";
import {
  issueManually,
  listRedemptions,
  lookupSubjectsAsOrganiser,
  undoRedemptionAsOrganiser,
} from "@/lib/supabase/inventory_issuing";
import { ItemThumb } from "./item_image";
import { formatDateTime, itemLabel, qty } from "./constants";

// The organiser's view of the hand-out ledger: what has physically left the
// shelf, to whom, by which staff code. Every row here was written by an
// issue_redeem() call — from the /issue desk or from the manual dialog below,
// which goes through exactly the same RPC so the rules can't diverge.

const REDEMPTION_STATUS_MAP = {
  issued: { label: "Issued", variant: "success", dotClass: "bg-emerald-400" },
  returned: { label: "Undone", variant: "neutral", dotClass: "bg-zinc-400" },
  voided: { label: "Voided", variant: "danger", dotClass: "bg-red-400" },
};

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All hand-outs" },
  { value: "issued", label: "Issued" },
  { value: "returned", label: "Undone" },
];

const METHOD_LABELS = {
  scan: "Scanned",
  search: "Searched",
  manual: "Manual",
  walkup: "Walk-up",
};

// --- Manual issue ------------------------------------------------------------

function ManualIssueDialog({ open, onOpenChange, events, allocations, onIssued }) {
  const [eventId, setEventId] = useState("");
  const [allocationId, setAllocationId] = useState("");
  const [itemId, setItemId] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [subject, setSubject] = useState(null);
  const [count, setCount] = useState("1");
  const [reason, setReason] = useState("");
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  const eventAllocations = useMemo(
    () => allocations.filter((a) => a.eventId === eventId),
    [allocations, eventId],
  );
  const allocation = eventAllocations.find((a) => a.id === allocationId) || null;
  const variants = allocation?.variants || [];

  // Changing the event invalidates everything chosen under it.
  const pickEvent = (id) => {
    setEventId(id);
    setAllocationId("");
    setItemId("");
    setSubject(null);
    setResults([]);
    setQuery("");
  };

  const search = async () => {
    if (!eventId || !query.trim()) return;
    setSearching(true);
    const rows = await lookupSubjectsAsOrganiser(eventId, query.trim());
    setSearching(false);
    setResults(rows || []);
    if (!rows?.length) toast.error("No attendee matched that search.");
  };

  const submit = async () => {
    if (!allocation) {
      toast.error("Pick an allocation.");
      return;
    }
    const target = itemId || variants[0]?.id || allocation.itemId;
    if (!target) {
      toast.error("Pick which item to hand over.");
      return;
    }
    setSaving(true);
    const res = await issueManually({
      eventId,
      allocationId: allocation.id,
      itemId: target,
      subjectKind: subject ? subject.subjectKind : "walkup",
      subjectId: subject ? subject.subjectId : null,
      qty: Number(count) || 1,
      // An organiser issuing by hand is always an explicit act, so it may pass
      // an already-collected or out-of-window guard — and is logged as such.
      override: true,
      reason: reason.trim(),
      staff: "Organiser",
    });
    setSaving(false);
    if (!res?.ok) {
      toast.error("Couldn't record that hand-out.");
      return;
    }
    toast.success("Hand-out recorded.");
    onOpenChange(false);
    onIssued();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-background">
        <DialogHeader>
          <DialogTitle>Record a hand-out</DialogTitle>
          <DialogDescription>
            Issues stock and writes the movement, exactly as the desk would.
            Leave the attendee blank for a walk-up.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <Field label="Event">
            <Select value={eventId} onValueChange={pickEvent}>
              <SelectTrigger className="bg-surface-card">
                <SelectValue placeholder="Pick an event" />
              </SelectTrigger>
              <SelectContent>
                {events.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Allocation">
            <Select
              value={allocationId}
              onValueChange={(v) => {
                setAllocationId(v);
                setItemId("");
              }}
              disabled={!eventId}
            >
              <SelectTrigger className="bg-surface-card">
                <SelectValue
                  placeholder={eventId ? "Pick an allocation" : "Pick an event first"}
                />
              </SelectTrigger>
              <SelectContent>
                {eventAllocations.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.itemName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {variants.length > 1 ? (
            <Field label="Variant" hint="Which size or colour physically left the shelf.">
              <Select value={itemId} onValueChange={setItemId}>
                <SelectTrigger className="bg-surface-card">
                  <SelectValue placeholder="Pick a variant" />
                </SelectTrigger>
                <SelectContent>
                  {variants.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.variantLabel || v.name} · {qty(v.onHand)} on hand
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}

          <Field label="Attendee" hint="Search by name, email or ticket code. Optional.">
            <div className="flex gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    search();
                  }
                }}
                placeholder="Name, email or ticket code"
                disabled={!eventId}
                className="bg-surface-card"
              />
              <Button
                variant="outline"
                onClick={search}
                disabled={!eventId || searching}
                className="shrink-0 border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              >
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
              </Button>
            </div>
          </Field>

          {subject ? (
            <div className="flex items-center justify-between rounded-lg border border-border bg-surface-card px-3 py-2">
              <span className="text-sm text-foreground">
                {subject.name || "Guest"}{" "}
                <span className="text-text-secondary">· {subject.email || "no email"}</span>
              </span>
              <Button variant="ghost" size="sm" onClick={() => setSubject(null)}>
                Clear
              </Button>
            </div>
          ) : (
            results.map((r) => (
              <button
                key={`${r.subjectKind}:${r.subjectId}`}
                type="button"
                onClick={() => {
                  setSubject(r);
                  setResults([]);
                }}
                className="rounded-lg border border-border bg-surface-card px-3 py-2 text-left text-sm transition-colors hover:bg-surface-hover"
              >
                <span className="text-foreground">{r.name || "Guest"}</span>{" "}
                <span className="text-text-secondary">
                  · {r.email || "no email"} · {r.ticketCode}
                </span>
              </button>
            ))
          )}

          <Field label="Quantity">
            <Input
              value={count}
              onChange={(e) => setCount(e.target.value)}
              inputMode="numeric"
              className="bg-surface-card"
            />
          </Field>

          <Field label="Note" hint="Why this was issued by hand — stored on the record.">
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. replaced a damaged shirt"
              className="bg-surface-card"
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={saving}
            onClick={submit}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? "Recording…" : "Record hand-out"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Screen ------------------------------------------------------------------

export function IssuingDeskScreen() {
  const { projectId } = useProject();
  const [redemptions, setRedemptions] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [items, setItems] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [eventFilter, setEventFilter] = useState("all");
  const [manualOpen, setManualOpen] = useState(false);

  const load = React.useCallback(() => {
    let alive = true;
    Promise.all([
      listRedemptions(projectId),
      listAllocations(projectId),
      listItems(projectId),
      listEvents(),
    ]).then(([reds, allocs, catalog, evts]) => {
      if (!alive) return;
      setRedemptions(reds ?? []);
      setAllocations(allocs ?? []);
      setItems(catalog ?? []);
      setEvents(evts ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  useEffect(() => load(), [load]);

  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const eventsById = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);

  // Allocations enriched for the manual dialog: item label + pickable variants.
  const allocationOptions = useMemo(() => {
    const childrenOf = new Map();
    for (const i of items) {
      if (!i.parentId) continue;
      childrenOf.set(i.parentId, [...(childrenOf.get(i.parentId) || []), i]);
    }
    return allocations
      .filter((a) => a.status !== "Closed")
      .map((a) => {
        const item = itemsById.get(a.itemId);
        const kids = childrenOf.get(a.itemId) || [];
        return {
          ...a,
          itemName: itemLabel(item),
          variants: kids.length ? kids : item ? [item] : [],
        };
      });
  }, [allocations, items, itemsById]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return redemptions.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (eventFilter !== "all" && r.eventId !== eventFilter) return false;
      if (!q) return true;
      const item = itemsById.get(r.itemId);
      return (
        r.attendeeName.toLowerCase().includes(q) ||
        r.attendeeEmail.toLowerCase().includes(q) ||
        r.issuedBy.toLowerCase().includes(q) ||
        itemLabel(item).toLowerCase().includes(q)
      );
    });
  }, [redemptions, search, status, eventFilter, itemsById]);

  const stats = useMemo(() => {
    const live = redemptions.filter((r) => r.status === "issued");
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const today = live.filter((r) => new Date(r.createdAt) >= startOfDay);
    const people = new Set(live.map((r) => r.subjectKey).filter(Boolean));
    const overrides = live.filter((r) => r.override).length;
    return [
      { label: "Handed out today", value: qty(today.reduce((s, r) => s + r.qty, 0)) },
      { label: "Handed out total", value: qty(live.reduce((s, r) => s + r.qty, 0)) },
      { label: "Unique collectors", value: String(people.size) },
      { label: "Overrides", value: String(overrides) },
    ];
  }, [redemptions]);

  const handleUndo = async (row) => {
    setRedemptions((prev) =>
      prev.map((r) => (r.id === row.id ? { ...r, status: "returned" } : r)),
    );
    const res = await undoRedemptionAsOrganiser(row.eventId, row.id);
    if (!res?.ok) {
      setRedemptions((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, status: "issued" } : r)),
      );
      toast.error("Couldn't undo that hand-out.");
      return;
    }
    toast.success("Hand-out undone — stock returned.");
  };

  const columns = [
    {
      key: "item",
      header: "Item",
      render: (r) => {
        const item = itemsById.get(r.itemId);
        return (
          <div className="flex items-center gap-3">
            <ItemThumb item={item} items={items} size="sm" />
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{itemLabel(item)}</p>
              <p className="truncate text-xs text-text-secondary">
                {eventsById.get(r.eventId)?.name || "Unknown event"}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      key: "attendee",
      header: "Collected by",
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate text-foreground">
            {r.subjectKind === "walkup" ? "Walk-up" : r.attendeeName || "Guest"}
          </p>
          <p className="truncate text-xs text-text-secondary">
            {r.attendeeEmail || METHOD_LABELS[r.method] || r.method}
          </p>
        </div>
      ),
    },
    {
      key: "qty",
      header: "Qty",
      align: "right",
      render: (r) => <span className="tabular-nums text-foreground">{qty(r.qty)}</span>,
    },
    {
      key: "staff",
      header: "Issued by",
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <span className="truncate text-text-secondary">{r.issuedBy || "—"}</span>
          {r.override ? (
            <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-label="Override" />
          ) : null}
        </div>
      ),
    },
    {
      key: "when",
      header: "When",
      render: (r) => (
        <span className="whitespace-nowrap text-text-secondary">
          {formatDateTime(r.createdAt)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusPill status={r.status} map={REDEMPTION_STATUS_MAP} />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
                aria-label="Hand-out actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 border-border bg-surface-subtle">
              <DropdownMenuItem
                disabled={r.status !== "issued"}
                className="cursor-pointer gap-2 text-muted-foreground focus:bg-surface-hover focus:text-foreground"
                onClick={() => handleUndo(r)}
              >
                <Undo2 className="h-4 w-4" /> Undo hand-out
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
        title="Item Issuing"
        description="Every item handed to an attendee, and by whom. Hand-outs come from the /issue desk; stock leaves the shelf the moment one is recorded."
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setManualOpen(true)}
          >
            <Plus className="h-4 w-4" /> Record hand-out
          </Button>
        }
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown
            value={status}
            options={STATUS_FILTER_OPTIONS}
            onValueChange={setStatus}
            placeholder="Status"
          />
          <FilterDropdown
            value={eventFilter}
            options={[
              { value: "all", label: "All events" },
              ...events.map((e) => ({ value: e.id, label: e.name })),
            ]}
            onValueChange={setEventFilter}
            placeholder="Event"
          />
        </div>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search attendee, item or staff…"
          className="w-full sm:max-w-xs"
        />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading hand-outs…
        </div>
      ) : !rows.length ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={redemptions.length ? PackageCheck : HandHeart}
            title={redemptions.length ? "No matching hand-outs" : "Nothing handed out yet"}
            description={
              redemptions.length
                ? "Try a different search or clear the filters."
                : "Once staff start issuing at the desk, every hand-out appears here. Create an issuing code under Issuing Staff to open the desk."
            }
            action={
              redemptions.length ? (
                <Button
                  variant="outline"
                  className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                  onClick={() => {
                    setSearch("");
                    setStatus("all");
                    setEventFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              ) : (
                <Button
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => setManualOpen(true)}
                >
                  <Plus className="h-4 w-4" /> Record hand-out
                </Button>
              )
            }
          />
        </div>
      ) : (
        <DataTable columns={columns} data={rows} getRowKey={(r) => r.id} />
      )}

      {/* Mounted only while open so each run starts from a clean draft. */}
      {manualOpen ? (
        <ManualIssueDialog
          open
          onOpenChange={setManualOpen}
          events={events}
          allocations={allocationOptions}
          onIssued={load}
        />
      ) : null}
    </MainScreenWrapper>
  );
}

export default IssuingDeskScreen;
