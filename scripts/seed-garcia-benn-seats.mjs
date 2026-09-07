// Fills the Garcia vs Benn arena map: 18,600 chairs, then a realistic spread of
// sold and blocked ones so the storefront's seat picker has something to show.
//
// Run AFTER `npm run db:seed garcia-vs-benn` — that seed owns the venue, the
// seat map and the 160 sections; this owns events.seats and the per-event
// events.seat_assignments. Kept out of the .sql file because 18,600 INSERT rows
// are generated data, not authored data: the coordinates come from
// lib/seating/generate.js, the same module the editor uses, so a chair here
// lands exactly where the editor would have put it.
//
// Re-runnable. Both tables are cleared for this map/event and rebuilt, which is
// safe precisely because nothing else uses either — it refuses to run if some
// other event has live assignments against this map.
//
//   node scripts/seed-garcia-benn-seats.mjs
//
// Node reparses lib/seating/*.js as ESM (the package has no "type": "module")
// and warns about it once. That warning is expected and harmless.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import pg from "pg";
import dotenv from "dotenv";

const root = path.resolve(import.meta.dirname, "..");
const { generateSeats } = await import(
  pathToFileURL(path.join(root, "lib/seating/generate.js")).href
);

dotenv.config({ path: path.join(root, ".env") });

const EVENT_ID = "9a4c2026-0912-4b12-9e00-000000000001";
const MAP_ID = "7b012026-0912-4a10-9c00-000000000002";

// Chunked so a bulk insert never approaches Postgres' parameter ceiling.
const CHUNK = 800;

// Every tenth section carries a wheelchair space and its companion seat, in the
// front row. They are never sold below — an accessible seat that is always
// taken demonstrates nothing.
const ACCESSIBLE_EVERY = 10;

// Production, broadcast and commission holds, taken off the floor.
const BLOCKED_SECTIONS = 6;
const BLOCKED_PER_SECTION = 10;

// Deterministic jitter, so a re-run produces the same map.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const pool = new pg.Pool({ connectionString: process.env.STRING_URI });

async function main() {
  const { rows: maps } = await pool.query(
    "select id, config from events.seat_maps where id = $1 and deleted_at is null",
    [MAP_ID],
  );
  if (!maps.length) throw new Error("seat map missing — run `npm run db:seed garcia-vs-benn` first");
  const aspect = maps[0].config?.aspect || "16/10";

  const { rows: sections } = await pool.query(
    `select id, name, kind, x, y, width, height, rotation, layout, sort_order
       from events.seat_map_sections where seat_map_id = $1 order by sort_order`,
    [MAP_ID],
  );
  if (sections.length !== 160) throw new Error(`expected 160 sections, found ${sections.length}`);

  // Refuse to clear chairs somebody else's event has already sold.
  const { rows: foreign } = await pool.query(
    `select count(*)::int as n
       from events.seat_assignments a
       join events.seats s on s.id = a.seat_id
      where s.seat_map_id = $1 and a.event_id <> $2 and a.released_at is null`,
    [MAP_ID, EVENT_ID],
  );
  if (foreign[0].n > 0) {
    throw new Error(`${foreign[0].n} live assignments from another event on this map — not touching it`);
  }

  const { rows: evs } = await pool.query(
    "select metadata from events.events where id = $1 and deleted_at is null",
    [EVENT_ID],
  );
  if (!evs.length) throw new Error("event missing — run `npm run db:seed garcia-vs-benn` first");
  const meta = evs[0].metadata || {};
  const sectionTiers = meta.seating?.sectionTiers || {};
  const soldByTicket = meta.ticketSold || {};
  const priceByTicket = Object.fromEntries(
    (meta.tickets || []).map((t) => [t.id, Number(t.price) || 0]),
  );

  // ---------------------------------------------------------------------
  // Chairs
  // ---------------------------------------------------------------------
  const seatRows = [];
  // section id -> ordered seat ids, front row first. The sale pattern below
  // fills from the front, which is how a bowl actually sells.
  const bySection = new Map();

  sections.forEach((section, index) => {
    const generated = generateSeats(section, aspect);
    const accessible = index % ACCESSIBLE_EVERY === 0;
    const ids = [];
    let wheelchairId = null;

    generated.forEach((seat) => {
      const id = crypto.randomUUID();
      let kind = "standard";
      if (accessible && seat.rowLabel === "A" && seat.seatLabel === "1") {
        kind = "wheelchair";
        wheelchairId = id;
      } else if (accessible && seat.rowLabel === "A" && seat.seatLabel === "2") {
        kind = "companion";
      }
      seatRows.push({
        id,
        sectionId: section.id,
        rowLabel: seat.rowLabel,
        seatLabel: seat.seatLabel,
        x: seat.x,
        y: seat.y,
        kind,
      });
      if (kind === "standard") ids.push(id);
    });

    bySection.set(section.id, { ids, wheelchairId, accessible });
  });

  await pool.query("delete from events.seat_assignments where event_id = $1", [EVENT_ID]);
  await pool.query("delete from events.seats where seat_map_id = $1", [MAP_ID]);

  for (let i = 0; i < seatRows.length; i += CHUNK) {
    const slice = seatRows.slice(i, i + CHUNK);
    const params = [];
    const values = slice.map((s, n) => {
      const b = n * 8;
      params.push(s.id, MAP_ID, s.sectionId, s.rowLabel, s.seatLabel, s.x, s.y, s.kind);
      return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8})`;
    });
    await pool.query(
      `insert into events.seats (id, seat_map_id, section_id, row_label, seat_label, x, y, kind)
       values ${values.join(",")}`,
      params,
    );
  }

  // Pair each companion seat to the wheelchair space beside it, so the two sell
  // together rather than one of them stranding the other.
  await pool.query(
    `update events.seats c
        set companion_of = w.id
       from events.seats w
      where c.seat_map_id = $1 and c.kind = 'companion'
        and w.section_id = c.section_id and w.kind = 'wheelchair'`,
    [MAP_ID],
  );

  console.log(`seats: ${seatRows.length}`);

  // ---------------------------------------------------------------------
  // Sold seats, band by band, matching metadata.ticketSold exactly.
  // ---------------------------------------------------------------------
  const bands = new Map();
  for (const [sectionId, ticketId] of Object.entries(sectionTiers)) {
    if (!bands.has(ticketId)) bands.set(ticketId, []);
    bands.get(ticketId).push(sectionId);
  }

  const assignments = [];
  const random = rng(20260912);

  for (const [ticketId, sectionIds] of bands) {
    const target = Number(soldByTicket[ticketId]) || 0;
    if (!target) continue;
    const price = priceByTicket[ticketId] || 0;
    const pool_ = sectionIds.map((id) => bySection.get(id)?.ids || []);
    const capacity = pool_.reduce((n, ids) => n + ids.length, 0);

    // Proportional share per section with a little jitter, then the remainder
    // is swept up section by section so the band total lands on `target`.
    const wanted = pool_.map((ids) => {
      const share = (ids.length / capacity) * target;
      return Math.min(ids.length, Math.max(0, Math.round(share * (0.88 + random() * 0.24))));
    });
    let drift = target - wanted.reduce((a, b) => a + b, 0);
    for (let i = 0; drift !== 0 && i < wanted.length * 4; i += 1) {
      const k = i % wanted.length;
      const step = Math.sign(drift);
      const next = wanted[k] + step;
      if (next >= 0 && next <= pool_[k].length) {
        wanted[k] = next;
        drift -= step;
      }
    }

    pool_.forEach((ids, k) => {
      for (let n = 0; n < wanted[k]; n += 1) {
        assignments.push({ seatId: ids[n], ticketId, price, status: "sold" });
      }
    });
  }

  // Production and broadcast holds on the floor, taken from the back of the
  // section so they do not eat the seats people want.
  const floorSections = sections.slice(0, BLOCKED_SECTIONS);
  const soldIds = new Set(assignments.map((a) => a.seatId));
  for (const section of floorSections) {
    const ids = bySection.get(section.id)?.ids || [];
    let taken = 0;
    for (let i = ids.length - 1; i >= 0 && taken < BLOCKED_PER_SECTION; i -= 1) {
      if (soldIds.has(ids[i])) continue;
      assignments.push({
        seatId: ids[i],
        ticketId: sectionTiers[section.id] || null,
        price: 0,
        status: "blocked",
        note: "Production, broadcast and commission hold",
      });
      taken += 1;
    }
  }

  for (let i = 0; i < assignments.length; i += CHUNK) {
    const slice = assignments.slice(i, i + CHUNK);
    const params = [];
    const values = slice.map((a, n) => {
      const b = n * 6;
      params.push(EVENT_ID, a.seatId, a.ticketId, a.price, a.status, a.note || null);
      return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6})`;
    });
    await pool.query(
      `insert into events.seat_assignments (event_id, seat_id, ticket_id, price, status, note)
       values ${values.join(",")}`,
      params,
    );
  }

  const sold = assignments.filter((a) => a.status === "sold").length;
  const blocked = assignments.length - sold;
  console.log(`assignments: ${sold} sold, ${blocked} blocked`);

  // ---------------------------------------------------------------------
  // Verify against what the page will claim.
  // ---------------------------------------------------------------------
  const { rows: check } = await pool.query(
    `select
       (select count(*)::int from events.seats where seat_map_id = $1) as seats,
       (select count(*)::int from events.seats where seat_map_id = $1 and kind = 'wheelchair') as wheelchair,
       (select count(*)::int from events.seats where seat_map_id = $1 and kind = 'companion' and companion_of is not null) as companion,
       (select count(*)::int from events.seat_assignments where event_id = $2 and status = 'sold' and released_at is null) as sold,
       (select count(*)::int from events.seat_assignments where event_id = $2 and status = 'blocked' and released_at is null) as blocked,
       (select sold from events.events where id = $2) as event_sold`,
    [MAP_ID, EVENT_ID],
  );
  const c = check[0];
  console.log(JSON.stringify(c));
  if (c.sold !== c.event_sold) {
    console.error(`MISMATCH: ${c.sold} sold seats vs events.sold = ${c.event_sold}`);
    process.exitCode = 1;
  }

  // The anon read the storefront actually uses.
  const { rows: pub } = await pool.query("select * from events.public_event_seat_map($1)", [EVENT_ID]);
  const row = pub[0];
  console.log(
    `public_event_seat_map: ${row.sections?.length ?? 0} sections, ` +
      `${row.seats?.length ?? 0} seats, ${row.taken?.length ?? 0} taken`,
  );
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
