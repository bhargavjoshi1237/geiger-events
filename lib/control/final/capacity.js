import { ApiError } from "../../staff_access/errors.js";

// Capacity Limits, as components/internal/screens/registrations/capacity_limits.jsx computes it: confirmed and checked-in
// registrations take seats (weighted by party size) against capacity plus the overbook buffer kept in event metadata.

export const EVENT_COLUMNS = "id,name,type,event_date,capacity,capacityBuffer:metadata->capacityBuffer";

// Same tally as registrations/pipeline.jsx countRegs.
export function countRegs(regs) {
  const c = { total: regs.length, Confirmed: 0, Pending: 0, Waitlisted: 0, "Checked-in": 0, Declined: 0, Cancelled: 0, seats: 0 };
  for (const r of regs) {
    if (c[r.status] !== undefined) c[r.status] += 1;
    if (r.status === "Confirmed" || r.status === "Checked-in") c.seats += Number(r.party_size) || 1;
  }
  return c;
}

export function capacityRows(events, registrations) {
  const byEvent = new Map();
  for (const r of registrations) {
    if (!byEvent.has(r.event_id)) byEvent.set(r.event_id, []);
    byEvent.get(r.event_id).push(r);
  }
  return events.map((e) => {
    const counts = countRegs(byEvent.get(e.id) || []);
    const capacity = Number(e.capacity) || 0;
    const buffer = Number(e.capacityBuffer) || 0;
    const effective = capacity + buffer;
    const fill = effective ? Math.round((counts.seats / effective) * 100) : 0;
    return {
      id: e.id,
      name: e.name || "Untitled event",
      type: e.type || "",
      date: e.event_date || null,
      capacity,
      buffer,
      effective,
      seats: counts.seats,
      checkedIn: counts["Checked-in"],
      pending: counts.Pending,
      waitlisted: counts.Waitlisted,
      fill,
      remaining: Math.max(0, effective - counts.seats),
      full: effective > 0 && counts.seats >= effective,
    };
  });
}

// The dashboard's stat strip: events at capacity, total seats (capacity only), average fill of capped events.
export function capacityStats(rows) {
  const capped = rows.filter((r) => r.effective > 0);
  return {
    atCapacity: rows.filter((r) => r.full).length,
    totalSeats: rows.reduce((sum, r) => sum + r.capacity, 0),
    averageFill: capped.length ? Math.round(capped.reduce((sum, r) => sum + r.fill, 0) / capped.length) : 0,
  };
}

function wholeNumber(value, label) {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > 10_000_000) {
    throw new ApiError("invalid_input", 400, `${label} must be a whole number, 0 or more.`);
  }
  return n;
}

// PATCH { capacity?, buffer? } — capacity is a column, the buffer lives in event metadata, exactly as the dashboard saves them.
export function parseCapacityPatch(body) {
  const out = {};
  if (body && "capacity" in body) out.capacity = wholeNumber(body.capacity, "Capacity");
  if (body && "buffer" in body) out.buffer = wholeNumber(body.buffer, "Overbook buffer");
  if (!Object.keys(out).length) throw new ApiError("invalid_input", 400, "Send a capacity or a buffer.");
  return out;
}
