// Fills a seeded event's seat map with chairs (via lib/seating/generate.js, as the editor does) plus sold and blocked seats matching metadata.ticketSold.
// Run after the event's SQL seed; re-runnable, and refuses to touch a map another event has sold seats on.
//   node scripts/seed-event-seats.mjs <event-id>
// Node's one-off "reparsing as ES module" warning for lib/seating/*.js is expected.

import path from "node:path";
import { pathToFileURL } from "node:url";
import pg from "pg";
import dotenv from "dotenv";

const root = path.resolve(import.meta.dirname, "..");
const { generateSeats } = await import(
  pathToFileURL(path.join(root, "lib/seating/generate.js")).href
);

dotenv.config({ path: path.join(root, ".env") });

// Chunked so a bulk insert never approaches Postgres' parameter ceiling.
const CHUNK = 800;

// Every tenth section gets a front-row wheelchair space + companion, never sold, so accessible seating stays demonstrable.
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

export async function seedEventSeats(eventId) {
  const pool = new pg.Pool({ connectionString: process.env.STRING_URI });
  try {
    await fill(pool, eventId);
  } finally {
    await pool.end();
  }
}

async function fill(pool, eventId) {
  const { rows: evs } = await pool.query(
    "select metadata, to_char(event_date, 'YYYYMMDD') as day from events.events where id = $1 and deleted_at is null",
    [eventId],
  );
  if (!evs.length) throw new Error("event missing — run its `npm run db:seed` first");
  const meta = evs[0].metadata || {};
  const mapId = meta.seating?.seatMapId;
  if (!mapId) throw new Error("event has no metadata.seating.seatMapId");

  const { rows: maps } = await pool.query(
    "select id, config from events.seat_maps where id = $1 and deleted_at is null",
    [mapId],
  );
  if (!maps.length) throw new Error("seat map missing — run the event's `npm run db:seed` first");
  const aspect = maps[0].config?.aspect || "16/10";

  const { rows: sections } = await pool.query(
    `select id, name, kind, x, y, width, height, rotation, layout, sort_order
       from events.seat_map_sections where seat_map_id = $1 order by sort_order`,
    [mapId],
  );
  const sectionTiers = meta.seating?.sectionTiers || {};
  const known = new Set(sections.map((s) => s.id));
  const stray = Object.keys(sectionTiers).filter((id) => !known.has(id));
  if (!sections.length || stray.length) {
    throw new Error(`map has ${sections.length} sections; ${stray.length} sectionTiers ids point at none of them`);
  }

  // Refuse to clear chairs somebody else's event has already sold.
  const { rows: foreign } = await pool.query(
    `select count(*)::int as n
       from events.seat_assignments a
       join events.seats s on s.id = a.seat_id
      where s.seat_map_id = $1 and a.event_id <> $2 and a.released_at is null`,
    [mapId, eventId],
  );
  if (foreign[0].n > 0) {
    throw new Error(`${foreign[0].n} live assignments from another event on this map — not touching it`);
  }

  const soldByTicket = meta.ticketSold || {};
  const priceByTicket = Object.fromEntries(
    (meta.tickets || []).map((t) => [t.id, Number(t.price) || 0]),
  );

  // --- Chairs ---
  const seatRows = [];

  sections.forEach((section, index) => {
    const generated = generateSeats(section, aspect);
    const accessible = index % ACCESSIBLE_EVERY === 0;
    // The front row, which is not always "A" — a back bank can start at N.
    const front = generated[0]?.rowLabel;

    generated.forEach((seat) => {
      let kind = "standard";
      if (accessible && seat.rowLabel === front && seat.seatLabel === "1") kind = "wheelchair";
      else if (accessible && seat.rowLabel === front && seat.seatLabel === "2") kind = "companion";
      seatRows.push({
        sectionId: section.id,
        rowLabel: seat.rowLabel,
        seatLabel: seat.seatLabel,
        x: seat.x,
        y: seat.y,
        kind,
      });
    });
  });

  await pool.query("delete from events.seat_assignments where event_id = $1", [eventId]);

  // Upsert on the label so re-runs keep their chairs: mass deletes make each FK cascade scan unindexed tables.
  const key = (sectionId, row, seat) => `${sectionId}|${row}|${seat}`;
  const idOf = new Map();
  for (let i = 0; i < seatRows.length; i += CHUNK) {
    const slice = seatRows.slice(i, i + CHUNK);
    const params = [];
    const values = slice.map((s, n) => {
      const b = n * 7;
      params.push(mapId, s.sectionId, s.rowLabel, s.seatLabel, s.x, s.y, s.kind);
      return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7})`;
    });
    const { rows } = await pool.query(
      `insert into events.seats (seat_map_id, section_id, row_label, seat_label, x, y, kind)
       values ${values.join(",")}
       on conflict (section_id, row_label, seat_label)
       do update set x = excluded.x, y = excluded.y, kind = excluded.kind, companion_of = null
       returning id, section_id, row_label, seat_label`,
      params,
    );
    for (const r of rows) idOf.set(key(r.section_id, r.row_label, r.seat_label), r.id);
  }

  // Only chairs the layout no longer has — none on a plain re-run.
  await pool.query(
    "delete from events.seats where seat_map_id = $1 and not (id = any($2::uuid[]))",
    [mapId, [...idOf.values()]],
  );

  // section id -> standard seat ids, front row first, because a bowl sells from the front.
  const bySection = new Map(sections.map((s) => [s.id, { ids: [] }]));
  for (const s of seatRows) {
    if (s.kind === "standard") bySection.get(s.sectionId).ids.push(idOf.get(key(s.sectionId, s.rowLabel, s.seatLabel)));
  }

  // Pair each companion seat with its wheelchair space so the two sell together.
  await pool.query(
    `update events.seats c
        set companion_of = w.id
       from events.seats w
      where c.seat_map_id = $1 and c.kind = 'companion'
        and w.section_id = c.section_id and w.kind = 'wheelchair'`,
    [mapId],
  );

  console.log(`seats: ${seatRows.length}`);

  // --- Sold seats, band by band, matching metadata.ticketSold exactly ---
  const bands = new Map();
  for (const [sectionId, ticketId] of Object.entries(sectionTiers)) {
    if (!bands.has(ticketId)) bands.set(ticketId, []);
    bands.get(ticketId).push(sectionId);
  }

  const assignments = [];
  const random = rng(Number(evs[0].day));

  for (const [ticketId, sectionIds] of bands) {
    const target = Number(soldByTicket[ticketId]) || 0;
    if (!target) continue;
    const price = priceByTicket[ticketId] || 0;
    const pool_ = sectionIds.map((id) => bySection.get(id)?.ids || []);
    const capacity = pool_.reduce((n, ids) => n + ids.length, 0);
    if (target > capacity) throw new Error(`${ticketId}: ${target} sold but only ${capacity} chairs mapped`);

    // Jittered proportional share per section, then sweep the remainder until the band hits `target` (a near-sell-out needs many sweeps).
    const wanted = pool_.map((ids) => {
      const share = (ids.length / capacity) * target;
      return Math.min(ids.length, Math.max(0, Math.round(share * (0.88 + random() * 0.24))));
    });
    let drift = target - wanted.reduce((a, b) => a + b, 0);
    for (let moved = true; drift !== 0 && moved; ) {
      moved = false;
      for (let k = 0; k < wanted.length && drift !== 0; k += 1) {
        const step = Math.sign(drift);
        const next = wanted[k] + step;
        if (next >= 0 && next <= pool_[k].length) {
          wanted[k] = next;
          drift -= step;
          moved = true;
        }
      }
    }

    pool_.forEach((ids, k) => {
      for (let n = 0; n < wanted[k]; n += 1) {
        assignments.push({ seatId: ids[n], ticketId, price, status: "sold" });
      }
    });
  }

  // Production and broadcast holds on the floor, taken from the back so they don't eat the best seats.
  const soldIds = new Set(assignments.map((a) => a.seatId));
  for (const section of sections.slice(0, BLOCKED_SECTIONS)) {
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
      params.push(eventId, a.seatId, a.ticketId, a.price, a.status, a.note || null);
      return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6})`;
    });
    await pool.query(
      `insert into events.seat_assignments (event_id, seat_id, ticket_id, price, status, note)
       values ${values.join(",")}`,
      params,
    );
  }

  const sold = assignments.filter((a) => a.status === "sold").length;
  console.log(`assignments: ${sold} sold, ${assignments.length - sold} blocked`);

  // --- Verify against what the page will claim ---
  const { rows: check } = await pool.query(
    `select
       (select count(*)::int from events.seats where seat_map_id = $1) as seats,
       (select count(*)::int from events.seats where seat_map_id = $1 and kind = 'wheelchair') as wheelchair,
       (select count(*)::int from events.seats where seat_map_id = $1 and kind = 'companion' and companion_of is not null) as companion,
       (select count(*)::int from events.seat_assignments where event_id = $2 and status = 'sold' and released_at is null) as sold,
       (select count(*)::int from events.seat_assignments where event_id = $2 and status = 'blocked' and released_at is null) as blocked,
       (select sold from events.events where id = $2) as event_sold`,
    [mapId, eventId],
  );
  const c = check[0];
  console.log(JSON.stringify(c));
  if (c.sold !== c.event_sold) {
    console.error(`MISMATCH: ${c.sold} sold seats vs events.sold = ${c.event_sold}`);
    process.exitCode = 1;
  }

  // The anon read the storefront actually uses.
  const { rows: pub } = await pool.query("select * from events.public_event_seat_map($1)", [eventId]);
  const row = pub[0];
  console.log(
    `public_event_seat_map: ${row.sections?.length ?? 0} sections, ` +
      `${row.seats?.length ?? 0} seats, ${row.taken?.length ?? 0} taken`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const eventId = process.argv[2];
  if (!eventId) {
    console.error("usage: node scripts/seed-event-seats.mjs <event-id>");
    process.exitCode = 1;
  } else {
    await seedEventSeats(eventId).catch((e) => {
      console.error(e.message);
      process.exitCode = 1;
    });
  }
}
