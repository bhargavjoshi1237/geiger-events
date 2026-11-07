import { seatPositions } from "./chairs.js";

// Seating Charts domain: seat blocks (tables / chair rows), guests merged from the event roster, auto-seating, rules and tallies.

export const SEATING_RULE_KINDS = [
  { value: "together", label: "Seat together", target: "guests" },
  { value: "apart", label: "Keep apart", target: "guests" },
  { value: "vip_table", label: "VIP table", target: "tables" },
  { value: "reserved_table", label: "Reserved table", target: "tables" },
];
export const seatingRuleLabel = (kind) => SEATING_RULE_KINDS.find((k) => k.value === kind)?.label || "Rule";

export const slotKey = (itemId, index) => `${itemId}#${index}`;
const norm = (s) => String(s || "").trim().toLowerCase();

// "Table 5" for numbered tables, the label for named ones, the object name otherwise.
export function tableLabel(item) {
  const label = String(item?.label || "").trim();
  if (label) return /^\d+$/.test(label) ? `Table ${label}` : label;
  return item?.name || "Table";
}

const labelNumber = (item) => {
  const n = parseInt(item?.label, 10);
  return Number.isFinite(n) && /^\d+$/.test(String(item?.label).trim()) ? n : null;
};

// Seat-bearing objects → blocks guests sit in: each table / sofa is one block, single chairs join into rows (one block per run).
export function seatingBlocks(objects) {
  const list = (objects || []).filter((o) => (Number(o?.seats) || 0) > 0);
  const singles = list.filter((o) => o.seats === 1 && o.category === "seating");
  const multis = list.filter((o) => !(o.seats === 1 && o.category === "seating"));
  const blocks = [];

  const tables = [...multis].sort((a, b) => {
    const na = labelNumber(a);
    const nb = labelNumber(b);
    if (na !== null && nb !== null && na !== nb) return na - nb;
    if ((na === null) !== (nb === null)) return na === null ? 1 : -1;
    return a.y_m - b.y_m || a.x_m - b.x_m;
  });
  const nameCount = new Map();
  for (const item of tables) {
    let label = tableLabel(item);
    if (!String(item.label || "").trim()) {
      const n = (nameCount.get(label) || 0) + 1;
      nameCount.set(label, n);
      label = `${label} ${n}`;
    }
    const slots = seatPositions(item).map((p) => ({
      key: slotKey(item.id, p.index),
      itemId: item.id,
      index: p.index,
      x: p.x,
      y: p.y,
      angle: p.angle,
      seatNo: p.index + 1,
    }));
    blocks.push({ id: item.id, kind: "table", label, itemIds: [item.id], slots, center: [item.x_m, item.y_m], capacity: slots.length });
  }

  // Chair rows: same facing, same line; numbered front to back, seats numbered along the row.
  const lines = new Map();
  for (const o of singles) {
    const t = ((Number(o.rotation) || 0) * Math.PI) / 180;
    const along = o.x_m * Math.cos(t) + o.y_m * Math.sin(t);
    const perp = -o.x_m * Math.sin(t) + o.y_m * Math.cos(t);
    const key = `${Math.round(Number(o.rotation) || 0)}|${Math.round(perp / 0.3)}`;
    if (!lines.has(key)) lines.set(key, { perp, items: [] });
    lines.get(key).items.push({ o, along });
  }
  const sortedLines = [...lines.values()].sort((a, b) => a.perp - b.perp);
  sortedLines.forEach((line, i) => {
    const rowLabel = `Row ${i + 1}`;
    line.items.sort((a, b) => a.along - b.along);
    let run = [];
    let seatNo = 0;
    const flush = () => {
      if (!run.length) return;
      const slots = run.map(({ o }) => {
        const p = seatPositions(o)[0];
        seatNo += 1;
        return { key: slotKey(o.id, 0), itemId: o.id, index: 0, x: p.x, y: p.y, angle: p.angle, seatNo };
      });
      const cx = slots.reduce((s, x) => s + x.x, 0) / slots.length;
      const cy = slots.reduce((s, x) => s + x.y, 0) / slots.length;
      blocks.push({
        id: `row:${run[0].o.id}`,
        kind: "row",
        label: rowLabel,
        itemIds: run.map(({ o }) => o.id),
        slots,
        center: [cx, cy],
        capacity: slots.length,
      });
      run = [];
    };
    for (const entry of line.items) {
      const prev = run[run.length - 1];
      if (prev && entry.along - prev.along - (entry.o.width_m + prev.o.width_m) / 2 > 0.3) flush();
      run.push(entry);
    }
    flush();
  });
  return blocks;
}

// Lookup tables for a block list: slot key → { block, slot }, item id → block.
export function indexBlocks(blocks) {
  const bySlot = new Map();
  const byItem = new Map();
  for (const b of blocks || []) {
    for (const s of b.slots) bySlot.set(s.key, { block: b, slot: s });
    for (const id of b.itemIds) byItem.set(id, b);
  }
  return { bySlot, byItem };
}

// "Table 5 · Seat 3", "Row 2 · Seat 11", "Table 5 · seat TBD", or "".
export function seatLabel(index, itemId, seatIndex) {
  if (!itemId) return "";
  const block = index.byItem.get(itemId);
  if (!block) return "";
  if (seatIndex === null || seatIndex === undefined) return `${block.label} · seat TBD`;
  const hit = index.bySlot.get(slotKey(itemId, seatIndex));
  return hit ? `${block.label} · Seat ${hit.slot.seatNo}` : block.label;
}

// --- Dietary ---------------------------------------------------------------------

const NOTHING = /^(none|no|n\/?a|nil|nothing|-+|no requirements?|no restrictions?)\.?$/i;

export const DIETARY_TAGS = [
  { key: "vegan", label: "Vegan", test: /vegan/i },
  { key: "vegetarian", label: "Vegetarian", test: /veg(etarian|gie|\b)|meat[- ]?free|no meat/i },
  { key: "gluten_free", label: "Gluten-free", test: /gluten|coeliac|celiac|wheat/i },
  { key: "nut_allergy", label: "Nut allergy", test: /\bnuts?\b|peanut|tree ?nut/i },
  { key: "dairy_free", label: "Dairy-free", test: /dairy|lactose|\bmilk/i },
  { key: "seafood", label: "No fish / shellfish", test: /shellfish|seafood|\bfish/i },
  { key: "egg", label: "Egg allergy", test: /\beggs?\b/i },
  { key: "halal", label: "Halal", test: /halal/i },
  { key: "kosher", label: "Kosher", test: /kosher/i },
];

const meaningful = (text) => {
  const t = String(text || "").trim();
  return t && !NOTHING.test(t) ? t : "";
};

// Free-text dietary note → recognised tags (or "other" when there's a note we can't classify).
export function dietaryTags(text) {
  const t = meaningful(text);
  if (!t) return [];
  const tags = DIETARY_TAGS.filter((d) => d.test.test(t)).map((d) => d.key);
  if (tags.includes("vegan")) return tags.filter((k) => k !== "vegetarian");
  return tags.length ? tags : ["other"];
}

// --- Guests -------------------------------------------------------------------------

// The party a roster person belongs to by default: everyone on one order, a registration and its plus-ones.
export function defaultPartyKey(key) {
  const k = String(key || "");
  if (k.startsWith("order:")) return k.split(":").slice(0, 2).join(":");
  if (k.startsWith("reg:")) return k.split(":").slice(0, 2).join(":");
  return k;
}

export const guestKindOf = (key) => {
  const prefix = String(key || "").split(":")[0];
  if (prefix === "order") return "order";
  if (prefix === "reg") return "registration";
  if (["team", "speaker", "sponsor", "booth", "manual"].includes(prefix)) return prefix;
  return "manual";
};

const initialsOf = (name) =>
  String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("") || "?";

// Roster (lib/passes/attendees) + this chart's assignment rows → one guest per person; rows without a roster match stay as manual or stale guests.
export function buildChartGuests({ roster, rows, dietaryFor, objects }) {
  const rowByKey = new Map((rows || []).map((r) => [r.guestKey, r]));
  const objectById = new Map((objects || []).map((o) => [o.id, o]));
  const out = [];
  const seen = new Set();
  const make = (person, row, { manual = false, stale = false } = {}) => {
    const key = person.key;
    const diet = dietaryFor?.(person) || { dietary: "", accessibility: "" };
    const dietaryText = meaningful(row?.dietary) || meaningful(diet.dietary);
    const item = row?.itemId ? objectById.get(row.itemId) : null;
    const orphan =
      Boolean(row?.itemId) &&
      (!item || !(item.seats > 0) || (row.seatIndex !== null && row.seatIndex !== undefined && row.seatIndex >= item.seats));
    return {
      key,
      kind: guestKindOf(key),
      refId: person.id || row?.guestRef || null,
      name: person.name || row?.guestName || "Guest",
      initials: initialsOf(person.name || row?.guestName),
      email: person.email || row?.guestEmail || "",
      tier: person.tier || "",
      role: person.role || (manual ? "Guest" : ""),
      company: person.company || "",
      defaultParty: defaultPartyKey(key),
      partyName: String(row?.party || "").trim(),
      dietary: dietaryText,
      dietaryTags: dietaryTags(dietaryText),
      accessibility: meaningful(diet.accessibility),
      row: row || null,
      itemId: row?.itemId || null,
      seatIndex: row?.seatIndex ?? null,
      meal: row?.meal || "",
      vip: row?.vip === true,
      notes: row?.notes || "",
      seated: Boolean(row?.itemId) && !orphan,
      orphan,
      manual,
      stale,
    };
  };
  for (const person of roster || []) {
    if (!person?.key || seen.has(person.key)) continue;
    seen.add(person.key);
    out.push(make(person, rowByKey.get(person.key) || null));
  }
  for (const row of rows || []) {
    if (seen.has(row.guestKey)) continue;
    seen.add(row.guestKey);
    const manual = row.guestKind === "manual";
    out.push(
      make({ key: row.guestKey, id: row.guestRef, name: row.guestName, email: row.guestEmail }, row, {
        manual,
        stale: !manual,
      }),
    );
  }

  // Effective parties: a typed party/group name wins, else the order / registration; labelled by name or lead guest.
  const parties = new Map();
  for (const g of out) {
    g.partyKey = g.partyName ? `name:${norm(g.partyName)}` : g.defaultParty;
    if (!parties.has(g.partyKey)) parties.set(g.partyKey, []);
    parties.get(g.partyKey).push(g);
  }
  for (const g of out) {
    const members = parties.get(g.partyKey);
    g.partySize = members.length;
    g.partyLabel = g.partyName || (members.length > 1 ? `${members[0].name}'s party` : "");
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

// Orphans: seated on an object (or seat) that no longer exists on the plan.
export const orphanedGuests = (guests) => (guests || []).filter((g) => g.orphan);

// --- Occupancy -------------------------------------------------------------------------

// slot key → guest, block id → { guests, seated, tbd } for the current assignments.
export function occupancy(guests, index) {
  const bySlot = new Map();
  const byBlock = new Map();
  const ensure = (id) => {
    if (!byBlock.has(id)) byBlock.set(id, { guests: [], tbd: [] });
    return byBlock.get(id);
  };
  for (const g of guests || []) {
    if (!g.seated) continue;
    const block = index.byItem.get(g.itemId);
    if (!block) continue;
    if (g.seatIndex === null || g.seatIndex === undefined) {
      ensure(block.id).tbd.push(g);
      ensure(block.id).guests.push(g);
      continue;
    }
    const key = slotKey(g.itemId, g.seatIndex);
    if (!index.bySlot.has(key)) continue;
    bySlot.set(key, g);
    ensure(block.id).guests.push(g);
  }
  return { bySlot, byBlock };
}

// Lowest free slots of a block (consecutive run of `count` first, else any), honouring seat-TBD guests already counted.
export function freeSlotsIn(block, taken, count = 1) {
  const free = block.slots.filter((s) => !taken.has(s.key));
  if (count <= 1) return free.slice(0, count);
  for (let i = 0; i + count <= free.length; i += 1) {
    const run = free.slice(i, i + count);
    if (run.every((s, k) => k === 0 || s.seatNo === run[k - 1].seatNo + 1)) return run;
  }
  return free.slice(0, count);
}

// --- Auto-seat -----------------------------------------------------------------------------

// Fills seats keeping parties (and "together" rules) at one table, honouring apart / VIP / reserved rules.
// sortBy: "party" (biggest first) | "ticket" (ticket types fill tables in turn) | "name". Existing seats stay unless reseatAll.
export function autoSeat({ blocks, guests, rules = [], sortBy = "party", reseatAll = false, onlyKeys = null }) {
  const index = indexBlocks(blocks);
  const taken = new Set();
  const blockGuests = new Map(blocks.map((b) => [b.id, new Set()]));
  const tbdCount = new Map();
  const seatedBlock = new Map();
  const notes = [];
  const allow = onlyKeys ? new Set(onlyKeys) : null;

  const live = (guests || []).filter((g) => !g.stale);
  // Everyone already seated holds their seat (stale guests too, until they're cleared).
  for (const g of guests || []) {
    if (reseatAll || !g.seated) continue;
    const block = index.byItem.get(g.itemId);
    if (!block) continue;
    if (g.seatIndex === null || g.seatIndex === undefined) {
      tbdCount.set(block.id, (tbdCount.get(block.id) || 0) + 1);
    } else {
      taken.add(slotKey(g.itemId, g.seatIndex));
    }
    seatedBlock.set(g.key, block.id);
    blockGuests.get(block.id).add(g.key);
  }

  // Seat-TBD guests get a concrete seat at their table first.
  const placements = [];
  const placeAt = (g, slot, block) => {
    taken.add(slot.key);
    placements.push({ guestKey: g.key, itemId: slot.itemId, seatIndex: slot.index });
    seatedBlock.set(g.key, block.id);
    blockGuests.get(block.id).add(g.key);
  };
  for (const g of live) {
    if (reseatAll || !g.seated || (g.seatIndex !== null && g.seatIndex !== undefined)) continue;
    const block = index.byItem.get(g.itemId);
    const slot = block && freeSlotsIn(block, taken, 1)[0];
    if (!slot) continue;
    tbdCount.set(block.id, Math.max(0, (tbdCount.get(block.id) || 1) - 1));
    placeAt(g, slot, block);
  }

  const freeIn = (block) => block.slots.filter((s) => !taken.has(s.key)).length - (tbdCount.get(block.id) || 0);

  // Constraint maps.
  const apart = new Map();
  const addApart = (a, b) => {
    if (!apart.has(a)) apart.set(a, new Set());
    apart.get(a).add(b);
  };
  const vipBlocks = new Set();
  const reserved = new Map();
  const parent = new Map(live.map((g) => [g.key, g.key]));
  const find = (k) => {
    let x = k;
    while (parent.get(x) !== x) x = parent.get(x);
    parent.set(k, x);
    return x;
  };
  const union = (a, b) => {
    if (!parent.has(a) || !parent.has(b)) return;
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(rb, ra);
  };
  const partyLead = new Map();
  for (const g of live) {
    if (partyLead.has(g.partyKey)) union(partyLead.get(g.partyKey), g.key);
    else partyLead.set(g.partyKey, g.key);
  }
  for (const rule of rules || []) {
    const keys = (rule.guests || []).filter((k) => parent.has(k));
    const blocksOf = (rule.items || []).map((id) => index.byItem.get(id)?.id).filter(Boolean);
    if (rule.kind === "together") keys.slice(1).forEach((k) => union(keys[0], k));
    if (rule.kind === "apart") {
      for (const a of keys) for (const b of keys) if (a !== b) addApart(a, b);
    }
    if (rule.kind === "vip_table") blocksOf.forEach((id) => vipBlocks.add(id));
    if (rule.kind === "reserved_table") {
      for (const id of blocksOf) {
        if (!reserved.has(id)) reserved.set(id, new Set());
        keys.forEach((k) => reserved.get(id).add(k));
      }
    }
  }

  const byKey = new Map(live.map((g) => [g.key, g]));
  const groups = new Map();
  for (const g of live) {
    const root = find(g.key);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(g);
  }

  const pendingGroups = [];
  for (const members of groups.values()) {
    const pending = members.filter((g) => !seatedBlock.has(g.key) && (!allow || allow.has(g.key)));
    if (!pending.length) continue;
    const anchor = members.map((g) => seatedBlock.get(g.key)).find(Boolean) || null;
    const tiers = pending.map((g) => g.tier || "").sort();
    pendingGroups.push({
      members: pending,
      vip: members.some((g) => g.vip),
      tier: tiers[0] || "",
      lead: [...pending].sort((a, b) => a.name.localeCompare(b.name))[0],
      anchor,
    });
  }
  pendingGroups.sort((a, b) => {
    if (a.vip !== b.vip) return a.vip ? -1 : 1;
    if (sortBy === "ticket" && a.tier !== b.tier) return (a.tier || "~").localeCompare(b.tier || "~");
    if (sortBy === "name") return a.lead.name.localeCompare(b.lead.name);
    return b.members.length - a.members.length || a.lead.name.localeCompare(b.lead.name);
  });

  const conflicts = (block, members) => {
    const there = blockGuests.get(block.id);
    return members.some((m) => {
      const avoid = apart.get(m.key);
      if (!avoid) return false;
      for (const k of there) if (avoid.has(k)) return true;
      return members.some((o) => o !== m && avoid.has(o.key));
    });
  };
  const allowedIn = (block, members, vip) => {
    if (reserved.has(block.id) && !members.every((m) => reserved.get(block.id).has(m.key))) return false;
    if (vipBlocks.has(block.id) && !vip) return false;
    return !conflicts(block, members);
  };
  const ordered = (group) => {
    const preferred = [];
    if (group.anchor) preferred.push(group.anchor);
    for (const [id, keys] of reserved) if (group.members.some((m) => keys.has(m.key))) preferred.push(id);
    if (group.vip) preferred.push(...vipBlocks);
    const seen = new Set();
    const out = [];
    for (const id of [...preferred, ...blocks.map((b) => b.id)]) {
      if (seen.has(id)) continue;
      seen.add(id);
      const b = blocks.find((x) => x.id === id);
      if (b) out.push(b);
    }
    return out;
  };
  const seatGroupIn = (block, members) => {
    const slots = freeSlotsIn(block, taken, members.length);
    members.forEach((m, i) => slots[i] && placeAt(m, slots[i], block));
  };

  const unplaced = [];
  for (const group of pendingGroups) {
    const candidates = ordered(group);
    const whole = candidates.find((b) => freeIn(b) >= group.members.length && allowedIn(b, group.members, group.vip));
    if (whole) {
      seatGroupIn(whole, group.members);
      continue;
    }
    // Too big for any one table (or split by an apart rule): fill tables already used by the group, then the roomiest.
    const used = [];
    for (const m of group.members) {
      const options = candidates.filter((b) => freeIn(b) > 0 && allowedIn(b, [m], group.vip));
      const best = options.find((b) => used.includes(b.id)) || options.sort((a, b) => freeIn(b) - freeIn(a))[0];
      if (!best) {
        unplaced.push(m.key);
        continue;
      }
      seatGroupIn(best, [m]);
      if (!used.includes(best.id)) used.push(best.id);
    }
    if (used.length > 1) {
      notes.push(`${group.lead.name}'s group of ${group.members.length} is split across ${used.map((id) => blocks.find((b) => b.id === id)?.label).join(", ")}.`);
    }
  }
  if (unplaced.length) notes.push(`${unplaced.length} guest${unplaced.length === 1 ? "" : "s"} couldn't be seated — no free seats left that fit the rules.`);
  return { placements, unplaced: unplaced.filter((k) => byKey.has(k)), notes };
}

// --- Rules & tallies --------------------------------------------------------------------------

// Rules broken by the current seating, as readable messages with the guests / tables involved.
export function ruleViolations(rules, guests, index) {
  const byKey = new Map((guests || []).map((g) => [g.key, g]));
  const blockOf = (g) => (g?.seated ? index.byItem.get(g.itemId) || null : null);
  // A VIP's whole party may sit at a VIP table.
  const vipParties = new Set((guests || []).filter((g) => g.vip).map((g) => g.partyKey));
  const out = [];
  for (const rule of rules || []) {
    const members = (rule.guests || []).map((k) => byKey.get(k)).filter(Boolean);
    if (rule.kind === "together") {
      const seated = members.filter(blockOf);
      const ids = new Set(seated.map((g) => blockOf(g).id));
      if (ids.size > 1) {
        out.push({ ruleId: rule.id, message: `${seated.map((g) => g.name).join(", ")} aren't at the same table.`, guestKeys: seated.map((g) => g.key) });
      }
    } else if (rule.kind === "apart") {
      const seen = new Map();
      for (const g of members) {
        const b = blockOf(g);
        if (!b) continue;
        if (seen.has(b.id)) {
          out.push({ ruleId: rule.id, message: `${seen.get(b.id).name} and ${g.name} are both at ${b.label}.`, guestKeys: [seen.get(b.id).key, g.key] });
        } else seen.set(b.id, g);
      }
    } else if (rule.kind === "vip_table" || rule.kind === "reserved_table") {
      const allowed = new Set(rule.guests || []);
      for (const itemId of rule.items || []) {
        const block = index.byItem.get(itemId);
        if (!block) continue;
        const wrong = (guests || []).filter(
          (g) =>
            blockOf(g)?.id === block.id &&
            (rule.kind === "vip_table" ? !vipParties.has(g.partyKey) : allowed.size > 0 && !allowed.has(g.key)),
        );
        if (wrong.length) {
          out.push({
            ruleId: rule.id,
            message: `${wrong.map((g) => g.name).join(", ")} ${wrong.length === 1 ? "is" : "are"} at ${rule.kind === "vip_table" ? "VIP" : "reserved"} ${block.label}.`,
            guestKeys: wrong.map((g) => g.key),
          });
        }
      }
    }
  }
  return out;
}

// [{ meal, count }] most-chosen first, with guests who haven't chosen counted under "".
export function mealTally(guests) {
  const counts = new Map();
  for (const g of guests || []) {
    const meal = String(g.meal || "").trim();
    counts.set(meal, (counts.get(meal) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([meal, count]) => ({ meal, count }))
    .sort((a, b) => (a.meal === "") - (b.meal === "") || b.count - a.count || a.meal.localeCompare(b.meal));
}

// Surname-first sort key for escort ("find your table") lists.
export function surnameKey(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  return `${parts[parts.length - 1]} ${parts.slice(0, -1).join(" ")}`.toLowerCase();
}

// Per block: who sits where (seat order, then seat-TBD guests) — the basis for every printout and the CSV.
export function seatingByBlock(blocks, guests) {
  const index = indexBlocks(blocks);
  const occ = occupancy(guests, index);
  return blocks.map((block) => {
    const seats = block.slots.map((s) => ({ seatNo: s.seatNo, slot: s, guest: occ.bySlot.get(s.key) || null }));
    const tbd = occ.byBlock.get(block.id)?.tbd || [];
    const seated = [...seats.filter((s) => s.guest).map((s) => s.guest), ...tbd];
    return { block, seats, tbd, guests: seated, meals: mealTally(seated) };
  });
}
