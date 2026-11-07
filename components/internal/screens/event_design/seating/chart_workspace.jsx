"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { format, isValid, parseISO } from "date-fns";
import { ChevronDown, FileSpreadsheet, IdCard, NotebookTabs, PencilRuler, Printer, Signpost, TriangleAlert, UtensilsCrossed, Wand2 } from "lucide-react";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  LogoLoading,
} from "@geiger/ui";
import { StatsBar, Toolbar } from "@/components/internal/shared/screen_kit";
import { slotKey } from "@/lib/event_design";
import { useSeatingChart } from "./use_seating_chart";
import { GuestList } from "./guest_list";
import { ChartCanvas } from "./chart_canvas";
import { ChartInspector } from "./chart_inspector";
import { AddGuestDialog, AutoSeatDialog, MenuDialog, PrintDialog, RuleDialog } from "./dialogs";
import { exportSeatingCsv, printSeating } from "./outputs";

// One plan's seating chart: stats, toolbar, guest list | chart | inspector, and the dialogs behind them.

const OUTLINE = "border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground";

function printableDate(value) {
  if (!value) return "";
  const d = parseISO(String(value));
  return isValid(d) ? format(d, "d MMMM yyyy") : String(value);
}

const slug = (s) => String(s || "seating").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "seating";

export function ChartWorkspace({ projectId, event, plan, onPlanChange, onEditLayout }) {
  const chart = useSeatingChart({ projectId, eventId: event?.id || null, plan, onPlanChange });
  const { guests, guestByKey, blocks, index, occ, rules } = chart;
  const [selection, setSelection] = useState(null);
  const [autoOpen, setAutoOpen] = useState(false);
  const [ruleDraft, setRuleDraft] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [printKind, setPrintKind] = useState(null);

  const live = useMemo(() => guests.filter((g) => !g.stale), [guests]);
  const orphans = useMemo(() => guests.filter((g) => g.orphan), [guests]);
  const capacity = blocks.reduce((n, b) => n + b.capacity, 0);
  const seatedCount = live.filter((g) => g.seated).length;
  const freeSeats = Math.max(0, capacity - occ.bySlot.size - [...occ.byBlock.values()].reduce((n, e) => n + e.tbd.length, 0));

  const stats = useMemo(() => {
    const tables = blocks.filter((b) => b.kind === "table");
    const used = tables.filter((b) => occ.byBlock.get(b.id)?.guests.length);
    const full = tables.filter((b) => (occ.byBlock.get(b.id)?.guests.length || 0) >= b.capacity);
    const chosen = live.filter((g) => g.meal);
    const meals = new Map();
    for (const g of chosen) meals.set(g.meal, (meals.get(g.meal) || 0) + 1);
    const top = [...meals.entries()].sort((a, b) => b[1] - a[1])[0];
    return [
      {
        label: "Guests",
        value: String(live.length),
        footer: orphans.length ? `${orphans.length} need reseating` : `${live.filter((g) => g.manual).length} added by hand`,
      },
      {
        label: "Seated",
        value: String(seatedCount),
        footer: `${live.length ? Math.round((seatedCount / live.length) * 100) : 0}% · ${freeSeats} seat${freeSeats === 1 ? "" : "s"} free`,
      },
      { label: "Tables in use", value: `${used.length}/${tables.length}`, footer: `${full.length} full` },
      { label: "Meals chosen", value: String(chosen.length), footer: top ? `Most: ${top[0]} (${top[1]})` : "No choices yet" },
    ];
  }, [blocks, occ, live, orphans, seatedCount, freeSeats]);

  const meta = {
    eventName: event?.name || "",
    planName: plan?.name || "",
    date: printableDate(event?.date),
  };

  // --- interactions -----------------------------------------------------------

  const notify = (res, guest, where) => {
    if (!res) return;
    if (res.outcome === "swapped") toast.success(`Swapped ${guest.name} with ${res.occupant.name}.`);
    else if (res.outcome === "bumped") toast.message(`${guest.name} seated · ${res.occupant.name} is back in the list.`);
    else if (res.outcome === "seated") toast.success(`${guest.name} → ${where}.`);
  };

  const seatAt = async (guest, slot, block) => {
    const res = await chart.seatGuest(guest, slot.itemId, slot.index);
    notify(res, guest, `${block.label} · Seat ${slot.seatNo}`);
    setSelection({ type: "seat", key: slot.key });
  };

  const seatAtTable = async (guest, block) => {
    const ok = await chart.seatAtBlock([guest], block);
    if (ok === false) toast.error(`${block.label} is full.`);
    else if (ok) toast.success(`${guest.name} → ${block.label}.`);
    setSelection({ type: "table", itemId: block.itemIds[0] });
  };

  // A guest picked from the list (or "Move" in the inspector) is placed by the next seat / table click.
  const selectedGuest = selection?.type === "guest" ? guestByKey.get(selection.key) : null;
  const selectedOccupant = selection?.type === "seat" ? occ.bySlot.get(selection.key) : null;
  const mover = selectedGuest && !selectedGuest.stale ? selectedGuest : null;

  const onSeat = (slot, block) => {
    if (mover && occ.bySlot.get(slot.key)?.key !== mover.key) {
      seatAt(mover, slot, block);
      return;
    }
    setSelection({ type: "seat", key: slot.key });
  };

  const onTable = (block) => {
    if (selectedGuest && !selectedGuest.stale && !(selectedGuest.seated && block.itemIds.includes(selectedGuest.itemId))) {
      seatAtTable(selectedGuest, block);
      return;
    }
    setSelection({ type: "table", itemId: block.itemIds[0] });
  };

  const onDropGuest = (key, hit) => {
    const guest = guestByKey.get(key);
    if (!guest || !hit) return;
    if (hit.slot) seatAt(guest, hit.slot, hit.block);
    else seatAtTable(guest, hit.block);
  };

  const canvasSelection =
    selection?.type === "guest" && selectedGuest?.seated && selectedGuest.seatIndex !== null
      ? { ...selection, seatKey: slotKey(selectedGuest.itemId, selectedGuest.seatIndex) }
      : selection;

  const hint = mover
    ? mover.seated
      ? `Click another seat to move ${mover.name} — an occupied seat swaps.`
      : `Click a seat or table to seat ${mover.name}.`
    : null;

  const actions = {
    seatGuest: async (guest, itemId, seatIndex) => {
      const res = await chart.seatGuest(guest, itemId, seatIndex);
      const hit = index.bySlot.get(slotKey(itemId, seatIndex));
      notify(res, guest, hit ? `${hit.block.label} · Seat ${hit.slot.seatNo}` : "seat");
    },
    seatAtBlock: async (members, block) => {
      const ok = await chart.seatAtBlock(members, block);
      if (ok === false) toast.error(`Not enough free seats at ${block.label}.`);
      else if (ok) toast.success(`Seated ${members.length} at ${block.label}.`);
      return ok;
    },
    unseat: async (list) => {
      if (await chart.unseat(list)) toast.success(list.length === 1 ? `${list[0].name} unseated.` : `Unseated ${list.length}.`);
    },
    updateGuest: chart.updateGuest,
    setTableRule: async (kind, itemId, on) => {
      if (!(await chart.setTableRule(kind, itemId, on))) toast.error("Couldn't update the table.");
    },
  };

  const clearOrphans = async () => {
    if (await chart.unseat(orphans)) toast.success(`Cleared ${orphans.length} seat${orphans.length === 1 ? "" : "s"} — reseat them from the list.`);
  };

  const removeGuest = async (guest) => {
    if (await chart.removeGuests([guest])) {
      toast.success(`Removed ${guest.name}.`);
      setSelection(null);
    }
  };

  const runPrint = ({ kind, paper, showMeal }) => {
    const error = printSeating(kind, { blocks, guests: live, meta, paper, showMeal });
    if (error) toast.error(error);
    else setPrintKind(null);
  };

  if (chart.loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-20">
        <LogoLoading size={56} aria-label="Loading seating chart" />
      </div>
    );
  }

  return (
    <>
      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex items-center gap-2">
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={!blocks.length} onClick={() => setAutoOpen(true)}>
            <Wand2 className="h-4 w-4" /> Auto-seat
          </Button>
          <Button variant="outline" className={OUTLINE} onClick={onEditLayout}>
            <PencilRuler className="h-4 w-4" /> Edit layout
          </Button>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className={`ml-auto ${OUTLINE}`}>
              <Printer className="h-4 w-4" /> Print &amp; export <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onSelect={() => setPrintKind("list")}>
              <NotebookTabs className="h-4 w-4" /> Seating list
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setPrintKind("cards")}>
              <IdCard className="h-4 w-4" /> Place cards
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setPrintKind("signs")}>
              <Signpost className="h-4 w-4" /> Table signs
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setPrintKind("caterer")}>
              <UtensilsCrossed className="h-4 w-4" /> Caterer summary
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => exportSeatingCsv({ guests, index, filename: `${slug(event?.name)}-${slug(plan?.name)}-seating.csv` })}
            >
              <FileSpreadsheet className="h-4 w-4" /> Export CSV
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Toolbar>

      {chart.rosterFailed || chart.chartFailed ? (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-700 dark:text-red-400">
          <TriangleAlert className="h-4 w-4 shrink-0" />
          {chart.chartFailed ? "Couldn't load the saved seating for this plan." : "Couldn't load the event's guest list."}
        </div>
      ) : null}

      {orphans.length ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-800 dark:text-amber-300">
          <TriangleAlert className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1">
            {orphans.length} guest{orphans.length === 1 ? " needs" : "s need"} reseating — their table or seat was removed from the plan.
          </span>
          <Button variant="ghost" size="sm" className="h-7 text-amber-800 hover:bg-amber-500/15 dark:text-amber-300" onClick={clearOrphans}>
            Clear their seats
          </Button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border bg-surface-subtle">
        <div className="grid grid-cols-1 lg:h-[calc(100vh-15rem)] lg:min-h-[560px] lg:grid-cols-[280px_minmax(0,1fr)_300px] lg:grid-rows-[minmax(0,1fr)]">
          <aside className="order-2 h-96 min-h-0 border-t border-border lg:order-1 lg:h-auto lg:border-r lg:border-t-0">
            <GuestList
              guests={guests}
              index={index}
              selectedKey={selectedGuest?.key || selectedOccupant?.key || null}
              onSelect={(g) => setSelection(selection?.type === "guest" && selection.key === g.key ? null : { type: "guest", key: g.key })}
              onAddGuest={() => setAddOpen(true)}
            />
          </aside>

          <div className="order-1 h-[60vh] min-h-0 lg:order-2 lg:h-auto">
            {blocks.length ? (
              <ChartCanvas
                plan={plan}
                blocks={blocks}
                index={index}
                occ={occ}
                selection={canvasSelection}
                hint={hint}
                onSeat={onSeat}
                onTable={onTable}
                onClear={() => setSelection(null)}
                onDropGuest={onDropGuest}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                <p className="text-sm font-semibold text-foreground">This plan has no seats yet</p>
                <p className="max-w-sm text-sm text-text-secondary">Add tables or chairs in the layout editor, then come back to seat guests.</p>
                <Button variant="outline" className={OUTLINE} onClick={onEditLayout}>
                  <PencilRuler className="h-4 w-4" /> Edit layout
                </Button>
              </div>
            )}
          </div>

          <aside className="scrollbar-subtle order-3 min-h-0 overflow-y-auto border-t border-border lg:border-l lg:border-t-0">
            <ChartInspector
              selection={selection}
              chart={chart}
              actions={actions}
              onSelect={setSelection}
              onEditRule={setRuleDraft}
              onMove={(g) => setSelection({ type: "guest", key: g.key })}
              onEditMenu={() => setMenuOpen(true)}
              onClearOrphans={clearOrphans}
              onRemoveGuest={removeGuest}
            />
          </aside>
        </div>
      </div>

      <AutoSeatDialog
        open={autoOpen}
        onOpenChange={setAutoOpen}
        unseated={live.filter((g) => !g.seated).length}
        freeSeats={freeSeats}
        ruleCount={rules.length}
        onRun={async (options) => {
          const result = await chart.runAutoSeat(options);
          if (!result) return false;
          toast.success(
            result.placements.length ? `Seated ${result.placements.length} guest${result.placements.length === 1 ? "" : "s"}.` : "Nobody new to seat.",
          );
          result.notes.forEach((n) => toast.message(n));
          return true;
        }}
      />

      <RuleDialog
        rule={ruleDraft}
        onOpenChange={(o) => !o && setRuleDraft(null)}
        guests={guests}
        blocks={blocks}
        onSave={async (input, existing) => {
          const saved = await chart.saveRule(input, existing);
          if (!saved) toast.error("Couldn't save the rule.");
          else toast.success("Rule saved.");
          return Boolean(saved);
        }}
        onDelete={async (rule) => {
          const ok = await chart.removeRule(rule);
          if (!ok) toast.error("Couldn't delete the rule.");
          return ok;
        }}
      />

      <MenuDialog
        open={menuOpen}
        onOpenChange={setMenuOpen}
        meals={chart.settings.meals}
        onSave={async (meals) => {
          const ok = await chart.saveMeals(meals);
          if (!ok) toast.error("Couldn't save the menu.");
          else toast.success("Menu saved.");
          return ok;
        }}
      />

      <AddGuestDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSave={async (draft) => {
          const ok = await chart.addGuest(draft);
          if (ok) toast.success(`Added ${draft.name.trim()}.`);
          return ok;
        }}
      />

      <PrintDialog kind={printKind} onOpenChange={(o) => !o && setPrintKind(null)} onPrint={runPrint} />
    </>
  );
}

export default ChartWorkspace;
