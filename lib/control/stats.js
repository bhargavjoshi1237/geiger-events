// Sales and attendance figures for Control, computed from order rows so they match the dashboard's ledgers.

const DAY = 86400000;

export function dayKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function netOf(row) {
  if (row.cancelled_at) return 0;
  return Math.max(0, Number(row.total ?? 0) - Number(row.refunded_total ?? 0));
}

function soldOf(row) {
  return row.cancelled_at ? 0 : Number(row.quantity ?? 1) || 0;
}

// The last `days` days, oldest first, including empty days so a chart never skips.
export function salesByDay(rows, now, days = 14) {
  const end = Date.parse(`${dayKey(now)}T00:00:00Z`);
  const buckets = new Map();
  for (let i = days - 1; i >= 0; i -= 1) buckets.set(dayKey(end - i * DAY), { date: dayKey(end - i * DAY), sold: 0, revenue: 0 });
  for (const row of rows) {
    const bucket = row.created_at ? buckets.get(dayKey(row.created_at)) : null;
    if (!bucket) continue;
    bucket.sold += soldOf(row);
    bucket.revenue += netOf(row);
  }
  return [...buckets.values()].map((b) => ({ ...b, revenue: Math.round(b.revenue * 100) / 100 }));
}

export function salesByTicket(rows) {
  const byName = new Map();
  for (const row of rows) {
    const name = row.ticket_name || "Ticket";
    const entry = byName.get(name) || { name, sold: 0, revenue: 0 };
    entry.sold += soldOf(row);
    entry.revenue += netOf(row);
    byName.set(name, entry);
  }
  return [...byName.values()]
    .map((e) => ({ ...e, revenue: Math.round(e.revenue * 100) / 100 }))
    .sort((a, b) => b.revenue - a.revenue || b.sold - a.sold);
}

export function totals(rows, since = null) {
  let sold = 0;
  let revenue = 0;
  let orders = 0;
  for (const row of rows) {
    if (since && Date.parse(row.created_at) < since) continue;
    if (row.cancelled_at) continue;
    orders += 1;
    sold += soldOf(row);
    revenue += netOf(row);
  }
  return { orders, sold, revenue: Math.round(revenue * 100) / 100 };
}

// "Today" is the last 24 hours: a project's events span time zones, so there is no single midnight to cut at.
export function projectTotals(rows, now) {
  const t = now.getTime();
  return { today: totals(rows, t - DAY), week: totals(rows, t - 7 * DAY) };
}

// The door's numbers, exactly as events.checkin_stats counts them (that RPC needs a staff code, so Control mirrors it).
// Expected = live orders + confirmed registrations whose email bought no order; admitted counts each guest once.
export function doorCounts(registrations, orders, attendance) {
  const buyers = new Set(orders.map((o) => String(o.buyer_email || "").trim().toLowerCase()).filter(Boolean));
  const confirmed = registrations.filter(
    (r) => ["Confirmed", "Checked-in"].includes(r.status) && !buyers.has(String(r.email || "").trim().toLowerCase()),
  ).length;
  const live = orders.filter((o) => {
    if (o.cancelled_at) return false;
    if (["cancelled", "refunded"].includes(o.status || "confirmed")) return false;
    const total = Number(o.total ?? 0);
    return !(total > 0 && Number(o.refunded_total ?? 0) >= total);
  }).length;
  const admitted = new Set(attendance.map((a) => a.registration_id || a.order_id || a.id)).size;
  return { admitted, expected: confirmed + live };
}
