import { salesByDay, totals } from "../stats.js";

// The cross-event analytics screen: totals, a 30-day trend and the events doing best, all from order and check-in rows.

function net(row) {
  if (row.cancelled_at) return 0;
  return Math.max(0, Number(row.total ?? 0) - Number(row.refunded_total ?? 0));
}

export function projectSummary({ events, orders, attendance, now = new Date(), days = 30 }) {
  const byEvent = new Map(
    events.map((e) => [e.id, { id: e.id, name: e.name || "Untitled", date: e.event_date ?? null, status: e.status ?? "", revenue: 0, sold: 0, checkedIn: 0, capacity: Number(e.capacity ?? 0) }]),
  );
  for (const row of orders) {
    const entry = byEvent.get(row.event_id);
    if (!entry || row.cancelled_at) continue;
    entry.revenue += net(row);
    entry.sold += Number(row.quantity ?? 1) || 0;
  }
  const seen = new Set();
  for (const row of attendance) {
    const key = `${row.event_id}:${row.registration_id || row.order_id || row.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const entry = byEvent.get(row.event_id);
    if (entry) entry.checkedIn += 1;
  }
  const list = [...byEvent.values()].map((e) => ({ ...e, revenue: Math.round(e.revenue * 100) / 100 }));
  const sold = list.reduce((s, e) => s + e.sold, 0);
  const checkedIn = list.reduce((s, e) => s + e.checkedIn, 0);
  return {
    totals: { ...totals(orders), events: events.length, checkedIn, showRate: sold ? Math.round((checkedIn / sold) * 100) : 0 },
    recent: totals(orders, now.getTime() - days * 86400000),
    byDay: salesByDay(orders, now, days),
    topEvents: list.filter((e) => e.revenue > 0 || e.sold > 0).sort((a, b) => b.revenue - a.revenue || b.sold - a.sold).slice(0, 8),
  };
}
