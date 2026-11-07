"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { listPassAttendees } from "@/lib/passes/attendees";
import { listRegistrationsByEvent } from "@/lib/supabase/registrations";
import { listDietaryRequests } from "@/lib/supabase/dietary";
import { getUser } from "@/lib/supabase/user";
import {
  applyChartChanges,
  chartSettingsOf,
  createChartRule,
  deleteChartAssignments,
  deleteChartRule,
  listChartAssignments,
  listChartRules,
  saveChartSettings,
  updateChartRule,
} from "@/lib/supabase/seating_charts";
import {
  autoSeat as planAutoSeat,
  buildChartGuests,
  freeSlotsIn,
  indexBlocks,
  newInstanceId,
  occupancy,
  ruleViolations,
  seatingBlocks,
  slotKey,
} from "@/lib/event_design";

// Seating chart state for one plan: the event roster merged with saved assignments, derived seats / tables, and every mutation.

const NONE = [];
const norm = (s) => String(s || "").trim().toLowerCase();
const identity = (g) => ({ guestKey: g.key, guestKind: g.kind, guestRef: g.refId, guestName: g.name, guestEmail: g.email });

const FIELD_MAP = {
  guestKind: "guestKind",
  guestRef: "guestRef",
  guestName: "guestName",
  guestEmail: "guestEmail",
  party: "party",
  meal: "meal",
  dietary: "dietary",
  vip: "vip",
  notes: "notes",
};

// Optimistic copy of what the RPC will do.
function mergeRows(rows, changes) {
  const next = [...(rows || [])];
  for (const change of changes) {
    let i = next.findIndex((r) => r.guestKey === change.guestKey);
    if (i === -1) {
      next.push({
        id: `pending-${change.guestKey}`,
        guestKey: change.guestKey,
        guestKind: "manual",
        guestRef: null,
        guestName: "",
        guestEmail: "",
        party: "",
        meal: "",
        dietary: "",
        vip: false,
        notes: "",
        itemId: null,
        seatIndex: null,
      });
      i = next.length - 1;
    }
    const row = { ...next[i] };
    for (const [key, field] of Object.entries(FIELD_MAP)) if (key in change) row[field] = change[key];
    if ("itemId" in change) {
      row.itemId = change.itemId || null;
      row.seatIndex = change.itemId && change.seatIndex !== undefined ? change.seatIndex : null;
    }
    next[i] = row;
  }
  return next;
}

const replaceRows = (rows, saved) => {
  const byKey = new Map(saved.map((r) => [r.guestKey, r]));
  const kept = (rows || []).map((r) => byKey.get(r.guestKey) || r);
  const have = new Set(kept.map((r) => r.guestKey));
  return [...kept, ...saved.filter((r) => !have.has(r.guestKey))];
};

export function useSeatingChart({ projectId, eventId, plan, onPlanChange }) {
  const planId = plan?.id || null;
  const [base, setBase] = useState({ eventId: null, roster: [], regs: [], requests: [], failed: false });
  const [chart, setChart] = useState({ planId: null, rows: [], rules: [], failed: false });

  useEffect(() => {
    if (!eventId) return undefined;
    let alive = true;
    Promise.all([
      listPassAttendees(eventId, projectId),
      listRegistrationsByEvent(eventId),
      listDietaryRequests(projectId),
    ]).then(([roster, regs, requests]) => {
      if (!alive) return;
      setBase({
        eventId,
        roster: roster ?? [],
        regs: regs ?? [],
        requests: (requests ?? []).filter((r) => r.eventId === eventId),
        failed: roster === null,
      });
    });
    return () => {
      alive = false;
    };
  }, [eventId, projectId]);

  const reloadChart = useCallback(() => {
    if (!planId) return Promise.resolve();
    return Promise.all([listChartAssignments(planId), listChartRules(planId)]).then(([rows, rules]) => {
      setChart((c) => (c.planId && c.planId !== planId ? c : { planId, rows: rows ?? [], rules: rules ?? [], failed: rows === null }));
    });
  }, [planId]);

  useEffect(() => {
    if (!planId) return undefined;
    let alive = true;
    Promise.all([listChartAssignments(planId), listChartRules(planId)]).then(([rows, rules]) => {
      if (alive) setChart({ planId, rows: rows ?? [], rules: rules ?? [], failed: rows === null });
    });
    return () => {
      alive = false;
    };
  }, [planId]);

  const loading = base.eventId !== eventId || chart.planId !== planId;
  const rows = chart.planId === planId ? chart.rows : NONE;
  const rules = chart.planId === planId ? chart.rules : NONE;
  const objects = plan?.objects;

  const blocks = useMemo(() => seatingBlocks(objects || []), [objects]);
  const index = useMemo(() => indexBlocks(blocks), [blocks]);

  // Dietary / accessibility per roster person: their registration (by id, or the buyer's email) plus any post-purchase requests.
  const dietaryFor = useMemo(() => {
    const regById = new Map(base.regs.map((r) => [r.id, r]));
    const regByEmail = new Map();
    for (const r of base.regs) if (r.email && !regByEmail.has(norm(r.email))) regByEmail.set(norm(r.email), r);
    const requests = new Map();
    for (const q of base.requests) {
      for (const k of [q.registrationId, norm(q.email)].filter(Boolean)) {
        if (!requests.has(k)) requests.set(k, []);
        requests.get(k).push(q.message);
      }
    }
    return (person) => {
      const reg =
        person.source === "registration"
          ? regById.get(person.id)
          : person.source === "order" && person.seat === 1
            ? regByEmail.get(norm(person.email))
            : null;
      const asks = [
        ...(reg ? requests.get(reg.id) || [] : []),
        ...(person.seat === 1 && person.email ? requests.get(norm(person.email)) || [] : []),
      ];
      const own = person.role === "Guest" ? "" : reg?.dietary || "";
      return {
        dietary: [own, ...new Set(asks)].filter(Boolean).join("; "),
        accessibility: person.role === "Guest" ? "" : reg?.accessibility || "",
      };
    };
  }, [base.regs, base.requests]);

  const guests = useMemo(
    () => buildChartGuests({ roster: base.eventId === eventId ? base.roster : [], rows, dietaryFor, objects: objects || [] }),
    [base, eventId, rows, dietaryFor, objects],
  );
  const guestByKey = useMemo(() => new Map(guests.map((g) => [g.key, g])), [guests]);
  const occ = useMemo(() => occupancy(guests, index), [guests, index]);
  const violations = useMemo(() => ruleViolations(rules, guests, index), [rules, guests, index]);
  const settings = useMemo(() => chartSettingsOf(plan), [plan]);

  // --- mutations ------------------------------------------------------------

  const commit = useCallback(
    async (changes) => {
      if (!planId || !changes.length) return true;
      setChart((c) => (c.planId === planId ? { ...c, rows: mergeRows(c.rows, changes) } : c));
      const saved = await applyChartChanges(planId, changes);
      if (!saved) {
        toast.error("Couldn't save the seating — reloaded the chart.");
        await reloadChart();
        return false;
      }
      setChart((c) => (c.planId === planId ? { ...c, rows: replaceRows(c.rows, saved) } : c));
      return true;
    },
    [planId, reloadChart],
  );

  const takenSlots = useMemo(() => new Set(occ.bySlot.keys()), [occ]);

  // Seat a guest: an occupied seat swaps (when the guest had a seat) or sends its occupant back to the list.
  const seatGuest = useCallback(
    async (guest, itemId, seatIndex) => {
      if (!guest) return null;
      const occupant = occ.bySlot.get(slotKey(itemId, seatIndex)) || null;
      if (occupant?.key === guest.key) return "same";
      const changes = [];
      let outcome = "seated";
      if (occupant) {
        const swap = guest.seated && guest.seatIndex !== null;
        changes.push({ ...identity(occupant), itemId: swap ? guest.itemId : null, seatIndex: swap ? guest.seatIndex : null });
        outcome = swap ? "swapped" : "bumped";
      }
      changes.push({ ...identity(guest), itemId, seatIndex });
      const ok = await commit(changes);
      return ok ? { outcome, occupant } : null;
    },
    [occ, commit],
  );

  // First free seats at a block (consecutive when possible) for one or more guests; false when it's full.
  const seatAtBlock = useCallback(
    async (members, block) => {
      const list = (members || []).filter(Boolean);
      const taken = new Set(takenSlots);
      for (const g of list) if (g.seated && g.seatIndex !== null) taken.delete(slotKey(g.itemId, g.seatIndex));
      const slots = freeSlotsIn(block, taken, list.length);
      if (slots.length < list.length) return false;
      return commit(list.map((g, i) => ({ ...identity(g), itemId: slots[i].itemId, seatIndex: slots[i].index })));
    },
    [takenSlots, commit],
  );

  const unseat = useCallback(
    (list) => commit((list || []).filter(Boolean).map((g) => ({ ...identity(g), itemId: null, seatIndex: null }))),
    [commit],
  );

  const updateGuest = useCallback((guest, patch) => commit([{ ...identity(guest), ...patch }]), [commit]);

  const addGuest = useCallback(
    ({ name, email, party }) =>
      commit([
        {
          guestKey: `manual:${newInstanceId()}`,
          guestKind: "manual",
          guestRef: null,
          guestName: String(name || "").trim(),
          guestEmail: String(email || "").trim(),
          party: String(party || "").trim(),
        },
      ]),
    [commit],
  );

  const removeGuests = useCallback(
    async (list) => {
      const ids = (list || []).map((g) => g.row?.id).filter((id) => id && !String(id).startsWith("pending-"));
      if (!ids.length) return false;
      const ok = await deleteChartAssignments(ids);
      if (!ok) {
        toast.error("Couldn't remove the guest.");
        return false;
      }
      const gone = new Set(ids);
      setChart((c) => (c.planId === planId ? { ...c, rows: c.rows.filter((r) => !gone.has(r.id)) } : c));
      return true;
    },
    [planId],
  );

  const runAutoSeat = useCallback(
    async (options) => {
      const result = planAutoSeat({ blocks, guests, rules, ...options });
      const placed = new Set(result.placements.map((p) => p.guestKey));
      const changes = result.placements.map((p) => ({ ...identity(guestByKey.get(p.guestKey)), itemId: p.itemId, seatIndex: p.seatIndex }));
      if (options?.reseatAll) {
        for (const g of guests) if (g.seated && !placed.has(g.key)) changes.push({ ...identity(g), itemId: null, seatIndex: null });
      }
      const ok = await commit(changes);
      return ok ? result : null;
    },
    [blocks, guests, rules, guestByKey, commit],
  );

  // --- rules ----------------------------------------------------------------

  const saveRule = useCallback(
    async (input, existing) => {
      if (existing) {
        const saved = await updateChartRule(existing.id, input);
        if (!saved) return null;
        setChart((c) => (c.planId === planId ? { ...c, rules: c.rules.map((r) => (r.id === saved.id ? saved : r)) } : c));
        return saved;
      }
      const user = await getUser();
      const saved = await createChartRule({ projectId, planId, createdBy: user?.id ?? null, ...input });
      if (!saved) return null;
      setChart((c) => (c.planId === planId ? { ...c, rules: [...c.rules, saved] } : c));
      return saved;
    },
    [projectId, planId],
  );

  const removeRule = useCallback(
    async (rule) => {
      const ok = await deleteChartRule(rule.id);
      if (ok) setChart((c) => (c.planId === planId ? { ...c, rules: c.rules.filter((r) => r.id !== rule.id) } : c));
      return ok;
    },
    [planId],
  );

  // VIP / reserved switch on one table: adds it to (or takes it out of) a table rule of that kind.
  const setTableRule = useCallback(
    async (kind, itemId, on) => {
      const holder = rules.find((r) => r.kind === kind && r.items.includes(itemId));
      if (on && !holder) return Boolean(await saveRule({ kind, items: [itemId], guests: [] }));
      if (!on && holder) {
        const items = holder.items.filter((id) => id !== itemId);
        if (!items.length && !holder.guests.length) return removeRule(holder);
        return Boolean(await saveRule({ items }, holder));
      }
      return true;
    },
    [rules, saveRule, removeRule],
  );

  const saveMeals = useCallback(
    async (meals) => {
      const saved = await saveChartSettings(planId, { meals });
      if (saved) onPlanChange?.(saved);
      return Boolean(saved);
    },
    [planId, onPlanChange],
  );

  return {
    loading,
    rosterFailed: base.eventId === eventId && base.failed,
    chartFailed: chart.planId === planId && chart.failed,
    guests,
    guestByKey,
    blocks,
    index,
    occ,
    rules,
    violations,
    settings,
    seatGuest,
    seatAtBlock,
    unseat,
    updateGuest,
    addGuest,
    removeGuests,
    runAutoSeat,
    saveRule,
    removeRule,
    setTableRule,
    saveMeals,
  };
}
