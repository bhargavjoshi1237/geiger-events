"use client";

import React, { useMemo, useState } from "react";
import { ArrowRightLeft, CircleAlert, Plus, Search, Trash2, TriangleAlert, UserMinus, Users, UtensilsCrossed } from "lucide-react";

import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, Textarea } from "@geiger/ui";
import { Field } from "@/components/internal/shared/screen_kit";
import { mealTally, seatingRuleLabel, seatLabel } from "@/lib/event_design";
import { cn } from "@/lib/utils";
import { GuestBadges } from "./dietary_icons";

// Right zone: the selected guest, seat or table — or, with nothing selected, meals, rules and guests needing a new seat.

const NO_MEAL = "__none__";
const OUTLINE = "border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground";

function Section({ title, action, children, className }) {
  return (
    <div className={cn("space-y-3 border-b border-border p-4 last:border-b-0", className)}>
      {title || action ? (
        <div className="flex items-center justify-between gap-2">
          {title ? <p className="text-xs font-medium text-text-tertiary">{title}</p> : <span />}
          {action}
        </div>
      ) : null}
      {children}
    </div>
  );
}

function Tally({ meals }) {
  if (!meals.length) return <p className="text-xs text-text-tertiary">No one seated yet.</p>;
  return (
    <ul className="space-y-1">
      {meals.map((m) => (
        <li key={m.meal || "none"} className="flex items-center justify-between gap-2 text-xs">
          <span className={m.meal ? "text-text-secondary" : "text-text-tertiary"}>{m.meal || "No choice yet"}</span>
          <span className="font-medium tabular-nums text-foreground">{m.count}</span>
        </li>
      ))}
    </ul>
  );
}

// Text field that saves on blur when it changed.
function BlurInput({ value, onSave, multiline, ...props }) {
  const [draft, setDraft] = useState(value || "");
  const [synced, setSynced] = useState(value || "");
  if ((value || "") !== synced) {
    setSynced(value || "");
    setDraft(value || "");
  }
  const Comp = multiline ? Textarea : Input;
  return (
    <Comp
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft.trim() !== (value || "").trim() && onSave(draft.trim())}
      onKeyDown={(e) => !multiline && e.key === "Enter" && e.currentTarget.blur()}
      {...props}
    />
  );
}

function GuestPanel({ guest, index, meals, rules, actions, onRemove, onMove }) {
  const mealOptions = [...new Set([...meals, ...(guest.meal ? [guest.meal] : [])])];
  const myRules = rules.filter((r) => r.guests.includes(guest.key));
  return (
    <>
      <Section>
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
              guest.seated ? "bg-primary/15 text-primary" : "border border-border bg-surface-card text-text-secondary",
            )}
          >
            {guest.initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{guest.name}</p>
            <p className="truncate text-xs text-text-secondary">{[guest.email, guest.company].filter(Boolean).join(" · ") || "No email"}</p>
            <p className="truncate text-xs text-text-tertiary">
              {[guest.tier, guest.role && guest.role !== "Attendee" ? guest.role : null, guest.manual ? "Added by hand" : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <GuestBadges guest={guest} />
        </div>
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-card px-3 py-2">
          <span
            className={cn(
              "min-w-0 truncate text-sm",
              guest.orphan ? "text-amber-700 dark:text-amber-400" : guest.seated ? "font-medium text-foreground" : "text-text-secondary",
            )}
          >
            {guest.orphan ? "Needs reseating" : guest.seated ? seatLabel(index, guest.itemId, guest.seatIndex) : "Not seated"}
          </span>
          <div className="flex shrink-0 items-center">
            {onMove && guest.seated ? (
              <Button variant="ghost" size="sm" className="h-7 text-muted-foreground" onClick={() => onMove(guest)}>
                <ArrowRightLeft className="h-4 w-4" /> Move
              </Button>
            ) : null}
            {guest.seated || guest.orphan ? (
              <Button variant="ghost" size="sm" className="h-7 text-muted-foreground" onClick={() => actions.unseat([guest])}>
                <UserMinus className="h-4 w-4" /> Unseat
              </Button>
            ) : null}
          </div>
        </div>
        {!onMove && !guest.stale ? (
          <p className="text-xs text-text-tertiary">
            {guest.seated
              ? "Click another seat to move them — an occupied seat swaps."
              : "Click a seat or table on the chart, or drag the guest onto it."}
          </p>
        ) : null}
        {guest.stale ? (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            This ticket or registration is no longer on the event — remove the guest or keep them by hand.
          </p>
        ) : null}
      </Section>

      <Section title="Meal & needs">
        <Field label="Meal">
          <Select value={guest.meal || NO_MEAL} onValueChange={(v) => actions.updateGuest(guest, { meal: v === NO_MEAL ? "" : v })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_MEAL}>No choice yet</SelectItem>
              {mealOptions.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Dietary note" hint={guest.row?.dietary ? undefined : "From their registration unless you note otherwise."}>
          <BlurInput
            value={guest.row?.dietary || ""}
            placeholder={guest.dietary || "None"}
            onSave={(dietary) => actions.updateGuest(guest, { dietary })}
          />
        </Field>
        <label className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
          VIP
          <Switch checked={guest.vip} onCheckedChange={(vip) => actions.updateGuest(guest, { vip })} />
        </label>
      </Section>

      <Section title="Party & notes">
        <Field label="Party" hint={guest.partyName ? undefined : guest.partySize > 1 ? `With their order: ${guest.partySize} guests` : "Same party name = seated together."}>
          <BlurInput
            value={guest.partyName}
            placeholder={guest.partyLabel || "e.g. Smith family"}
            onSave={(party) => actions.updateGuest(guest, { party })}
          />
        </Field>
        <Field label="Notes">
          <BlurInput multiline rows={2} value={guest.notes} onSave={(notes) => actions.updateGuest(guest, { notes })} />
        </Field>
        {myRules.length ? (
          <p className="text-xs text-text-secondary">
            Rules: {myRules.map((r) => r.label || seatingRuleLabel(r.kind)).join(", ")}
          </p>
        ) : null}
        {guest.manual || guest.stale ? (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-red-600 hover:bg-red-500/10 hover:text-red-600 dark:text-red-400"
            onClick={() => onRemove(guest)}
          >
            <Trash2 className="h-4 w-4" /> Remove from chart
          </Button>
        ) : null}
      </Section>
    </>
  );
}

function AssignList({ guests, onPick }) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return guests.filter((g) => !s || `${g.name} ${g.partyLabel} ${g.tier}`.toLowerCase().includes(s)).slice(0, 40);
  }, [guests, q]);
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a guest to seat…" className="pl-9" />
      </div>
      <ul className="scrollbar-subtle max-h-48 overflow-y-auto rounded-lg border border-border">
        {shown.map((g) => (
          <li key={g.key}>
            <button
              type="button"
              onClick={() => onPick(g)}
              className="flex w-full items-center justify-between gap-2 border-b border-border px-3 py-1.5 text-left text-sm last:border-b-0 hover:bg-surface-active"
            >
              <span className="truncate text-foreground">{g.name}</span>
              <span className="shrink-0 text-xs text-text-tertiary">{g.seated ? "seated" : g.partyLabel || g.tier}</span>
            </button>
          </li>
        ))}
        {!shown.length ? <li className="px-3 py-3 text-center text-xs text-text-tertiary">No one to seat.</li> : null}
      </ul>
    </div>
  );
}

function TablePanel({ block, guests, occ, rules, actions, onSelect }) {
  const entry = occ.byBlock.get(block.id);
  const seated = entry?.guests || [];
  const vip = rules.some((r) => r.kind === "vip_table" && r.items.some((id) => block.itemIds.includes(id)));
  const reserved = rules.some((r) => r.kind === "reserved_table" && r.items.some((id) => block.itemIds.includes(id)));
  const free = block.capacity - seated.length;
  const parties = useMemo(() => {
    const map = new Map();
    for (const g of guests) {
      if (g.seated || g.stale) continue;
      if (!map.has(g.partyKey)) map.set(g.partyKey, []);
      map.get(g.partyKey).push(g);
    }
    return [...map.values()].filter((m) => m.length > 1 && m.length <= free).sort((a, b) => b.length - a.length);
  }, [guests, free]);
  const [party, setParty] = useState("");
  const itemId = block.itemIds[0];

  return (
    <>
      <Section>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-foreground">{block.label}</p>
            <p className="text-xs tabular-nums text-text-secondary">
              {seated.length} of {block.capacity} seated{free > 0 ? ` · ${free} free` : free < 0 ? ` · ${-free} over` : " · full"}
            </p>
          </div>
          {seated.length ? (
            <Button variant="ghost" size="sm" className="h-7 text-muted-foreground" onClick={() => actions.unseat(seated)}>
              Clear
            </Button>
          ) : null}
        </div>
        {block.kind === "table" ? (
          <div className="space-y-2">
            <label className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
              VIP table
              <Switch checked={vip} onCheckedChange={(on) => actions.setTableRule("vip_table", itemId, on)} />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
              Reserved — skip in auto-seat
              <Switch checked={reserved} onCheckedChange={(on) => actions.setTableRule("reserved_table", itemId, on)} />
            </label>
          </div>
        ) : null}
      </Section>

      <Section title="Seats">
        <ul className="space-y-0.5">
          {block.slots.map((s) => {
            const g = occ.bySlot.get(s.key);
            return (
              <li key={s.key}>
                <button
                  type="button"
                  onClick={() => onSelect({ type: "seat", key: s.key })}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-surface-active"
                >
                  <span className="w-5 shrink-0 text-right text-xs tabular-nums text-text-tertiary">{s.seatNo}</span>
                  <span className={cn("min-w-0 flex-1 truncate", g ? "text-foreground" : "text-text-tertiary")}>{g ? g.name : "Empty"}</span>
                  {g ? <GuestBadges guest={g} /> : null}
                  {g?.meal ? <span className="shrink-0 truncate text-xs text-text-tertiary">{g.meal}</span> : null}
                </button>
              </li>
            );
          })}
          {(entry?.tbd || []).map((g) => (
            <li key={g.key}>
              <button
                type="button"
                onClick={() => onSelect({ type: "guest", key: g.key })}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-surface-active"
              >
                <span className="w-5 shrink-0 text-right text-xs text-text-tertiary">–</span>
                <span className="min-w-0 flex-1 truncate text-foreground">{g.name}</span>
                <span className="text-xs text-text-tertiary">seat TBD</span>
              </button>
            </li>
          ))}
        </ul>
        {parties.length ? (
          <div className="flex items-center gap-2">
            <Select value={party} onValueChange={setParty}>
              <SelectTrigger className="h-8 min-w-0 flex-1 text-xs">
                <SelectValue placeholder="Seat a party here…" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {parties.map((members) => (
                  <SelectItem key={members[0].partyKey} value={members[0].partyKey}>
                    {members[0].partyLabel} ({members.length})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className={OUTLINE}
              disabled={!party}
              onClick={async () => {
                const members = parties.find((m) => m[0].partyKey === party);
                if (members && (await actions.seatAtBlock(members, block))) setParty("");
              }}
            >
              Seat
            </Button>
          </div>
        ) : null}
      </Section>

      <Section title="Meals at this table">
        <Tally meals={mealTally(seated)} />
      </Section>
    </>
  );
}

function Overview({ guests, occ, rules, violations, settings, onSelect, onEditRule, onEditMenu, onClearOrphans }) {
  const live = guests.filter((g) => !g.stale);
  const orphans = guests.filter((g) => g.orphan);
  const seatedCount = live.filter((g) => g.seated).length;
  return (
    <>
      <Section title="Seating">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-2xl font-bold tabular-nums text-foreground">
            {seatedCount}
            <span className="text-sm font-normal text-text-tertiary"> / {live.length}</span>
          </span>
          <span className="text-xs text-text-secondary">guests seated</span>
        </div>
        <p className="text-xs text-text-tertiary">
          Select a guest, seat or table to edit it. {occ.bySlot.size ? "" : "Drag guests from the list onto the chart to start."}
        </p>
      </Section>

      {orphans.length ? (
        <Section
          title="Needs reseating"
          action={
            <Button variant="ghost" size="sm" className="h-7 text-muted-foreground" onClick={onClearOrphans}>
              Clear all
            </Button>
          }
        >
          <p className="text-xs text-text-secondary">Their table or seat was removed from the plan.</p>
          <ul className="space-y-0.5">
            {orphans.slice(0, 12).map((g) => (
              <li key={g.key}>
                <button
                  type="button"
                  onClick={() => onSelect({ type: "guest", key: g.key })}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm text-foreground hover:bg-surface-active"
                >
                  <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span className="truncate">{g.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section
        title="Meals"
        action={
          <Button variant="ghost" size="sm" className="h-7 text-muted-foreground" onClick={onEditMenu}>
            <UtensilsCrossed className="h-3.5 w-3.5" /> {settings.meals.length ? "Edit menu" : "Set menu"}
          </Button>
        }
      >
        <Tally meals={mealTally(live)} />
      </Section>

      <Section
        title="Rules"
        action={
          <Button variant="ghost" size="sm" className="h-7 text-muted-foreground" onClick={() => onEditRule({ kind: "together" })}>
            <Plus className="h-3.5 w-3.5" /> Add rule
          </Button>
        }
      >
        {rules.length ? (
          <ul className="space-y-0.5">
            {rules.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onEditRule(r)}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-surface-active"
                >
                  <span className="min-w-0 truncate text-foreground">{r.label || seatingRuleLabel(r.kind)}</span>
                  <span className="shrink-0 text-xs text-text-tertiary">
                    {r.kind === "together" || r.kind === "apart"
                      ? `${r.guests.length} guests`
                      : `${r.items.length} table${r.items.length === 1 ? "" : "s"}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-text-tertiary">Seat people together or apart, or keep tables for VIPs.</p>
        )}
        {violations.length ? (
          <ul className="space-y-1">
            {violations.map((v) => (
              <li key={`${v.ruleId}-${v.message}`}>
                <button
                  type="button"
                  onClick={() => v.guestKeys[0] && onSelect({ type: "guest", key: v.guestKeys[0] })}
                  className="flex w-full items-start gap-2 rounded-md px-2 py-1 text-left text-xs text-red-600 hover:bg-surface-active dark:text-red-400"
                >
                  <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {v.message}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </Section>
    </>
  );
}

export function ChartInspector({ selection, chart, actions, onSelect, onEditRule, onEditMenu, onClearOrphans, onRemoveGuest, onMove }) {
  const { guests, guestByKey, index, occ, rules, violations, settings } = chart;

  if (selection?.type === "guest") {
    const guest = guestByKey.get(selection.key);
    if (guest) {
      return (
        <GuestPanel key={guest.key} guest={guest} index={index} meals={settings.meals} rules={rules} actions={actions} onRemove={onRemoveGuest} />
      );
    }
  }

  if (selection?.type === "seat") {
    const hit = index.bySlot.get(selection.key);
    if (hit) {
      const occupant = occ.bySlot.get(selection.key);
      if (occupant) {
        return (
          <>
            <Section>
              <p className="text-xs font-medium text-text-tertiary">
                {hit.block.label} · Seat {hit.slot.seatNo}
              </p>
            </Section>
            <GuestPanel
              key={occupant.key}
              guest={occupant}
              index={index}
              meals={settings.meals}
              rules={rules}
              actions={actions}
              onRemove={onRemoveGuest}
              onMove={onMove}
            />
          </>
        );
      }
      const waiting = guests.filter((g) => !g.seated && !g.stale);
      return (
        <>
          <Section title={`${hit.block.label} · Seat ${hit.slot.seatNo}`}>
            {waiting.length ? (
              <AssignList guests={waiting} onPick={(g) => actions.seatGuest(g, hit.slot.itemId, hit.slot.index)} />
            ) : (
              <p className="flex items-center gap-2 text-xs text-text-tertiary">
                <Users className="h-3.5 w-3.5" /> Everyone has a seat.
              </p>
            )}
          </Section>
          <TablePanel key={hit.block.id} block={hit.block} guests={guests} occ={occ} rules={rules} actions={actions} onSelect={onSelect} />
        </>
      );
    }
  }

  if (selection?.type === "table") {
    const block = index.byItem.get(selection.itemId);
    if (block) {
      return <TablePanel key={block.id} block={block} guests={guests} occ={occ} rules={rules} actions={actions} onSelect={onSelect} />;
    }
  }

  return (
    <Overview
      guests={guests}
      occ={occ}
      rules={rules}
      violations={violations}
      settings={settings}
      onSelect={onSelect}
      onEditRule={onEditRule}
      onEditMenu={onEditMenu}
      onClearOrphans={onClearOrphans}
    />
  );
}

export default ChartInspector;
