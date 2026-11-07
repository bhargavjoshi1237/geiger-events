// Pure Capacity Control logic: one card per area (the venue, each event zone, and any zone staff scanned into),
// its cap rule, live occupancy, level, and the arrivals/exits series for its sparkline.

export const normZone = (name) => String(name || "").trim().toLowerCase();

// none = no cap · ok · warn (past the warning %) · full (at the cap) · over (past it, via offline admits or overrides).
export function levelFor(occupancy, cap, warnPct = 85) {
  if (cap === null || cap === undefined) return "none";
  if (occupancy > cap) return "over";
  if (occupancy >= cap) return "full";
  if (cap > 0 && (occupancy / cap) * 100 >= warnPct) return "warn";
  return "ok";
}

export function percentOf(occupancy, cap) {
  if (cap === null || cap === undefined) return null;
  if (cap <= 0) return occupancy > 0 ? 100 : 0;
  return Math.round((occupancy / cap) * 100);
}

// zones: the event's checkinGates.zones; rules: checkin_capacity rows; occupancy: zone_occupancy rows.
export function buildZoneCards({ zones = [], rules = [], occupancy = [] } = {}) {
  const occByName = new Map(occupancy.map((o) => [o.nameKey, o]));
  const ruleByKey = new Map(rules.map((r) => [r.zoneKey, r]));
  const ruleByName = new Map(rules.filter((r) => r.zoneKey).map((r) => [normZone(r.zoneName), r]));

  const card = (key, name, nameKey, rule, extra = {}) => {
    const o = occByName.get(nameKey);
    const cap = rule?.hardCap ?? null;
    const warnPct = rule?.warnPct ?? 85;
    const current = o?.occupancy ?? 0;
    return {
      key,
      name,
      nameKey,
      rule: rule || null,
      cap,
      warnPct,
      reentry: rule?.reentry || "inherit",
      occupancy: current,
      admitted: o?.admitted ?? 0,
      exited: o?.exited ?? 0,
      overCapacityAdmits: o?.overCapacityAdmits ?? 0,
      offlineAdmits: o?.offlineAdmits ?? 0,
      lastMovementAt: o?.lastMovementAt ?? null,
      level: levelFor(current, cap, warnPct),
      pct: percentOf(current, cap),
      ...extra,
    };
  };

  const cards = [card("", "Venue", "", ruleByKey.get(""), { venue: true })];
  const seen = new Set([""]);
  for (const z of zones) {
    if (!z?.name || z.enabled === false) continue;
    const nameKey = normZone(z.name);
    if (seen.has(nameKey)) continue;
    seen.add(nameKey);
    cards.push(card(z.id || `name:${nameKey}`, z.name, nameKey, ruleByKey.get(z.id) || ruleByName.get(nameKey)));
  }
  // Zones staff scanned into that aren't in the event's list (renamed, or set on an NFC entry point).
  for (const o of occupancy) {
    if (seen.has(o.nameKey)) continue;
    seen.add(o.nameKey);
    cards.push(card(`name:${o.nameKey}`, o.zone || o.nameKey, o.nameKey, ruleByName.get(o.nameKey), { unlisted: true }));
  }
  return cards;
}

// Gap-filled per-bucket series for one area over the whole timeline's range, so every card's sparkline lines up.
export function bucketSeries(timeline, nameKey, bucketMinutes = 15) {
  if (!Array.isArray(timeline) || !timeline.length) return [];
  const step = bucketMinutes * 60000;
  const times = timeline.map((t) => new Date(t.bucket).getTime()).filter(Number.isFinite);
  if (!times.length) return [];
  const start = Math.min(...times);
  const end = Math.max(...times);
  const byTime = new Map(
    timeline.filter((t) => t.nameKey === nameKey).map((t) => [new Date(t.bucket).getTime(), t]),
  );
  const out = [];
  for (let t = start; t <= end && out.length < 400; t += step) {
    const row = byTime.get(t);
    out.push({ t, arrivals: row?.arrivals ?? 0, exits: row?.exits ?? 0 });
  }
  return out;
}
