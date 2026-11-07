// Booking row (snake_case, from the table or an RPC envelope) -> camelCase view model. Shared by client and server.

const num = (v) => (v === null || v === undefined || v === "" ? 0 : Number(v) || 0);

export function normalizeVenueBooking(row) {
  if (!row) return null;
  const breakdown = row.price_breakdown && typeof row.price_breakdown === "object" ? row.price_breakdown : {};
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    venueId: row.venue_id ?? null,
    spaceId: row.space_id ?? null,
    eventId: row.event_id ?? null,
    reference: row.reference ?? "",
    title: row.title ?? "",
    startsAt: row.starts_at ?? null,
    endsAt: row.ends_at ?? null,
    blockedUntil: row.blocked_until ?? row.ends_at ?? null,
    status: row.status ?? "confirmed",
    holdExpiresAt: row.hold_expires_at ?? null,
    confirmedAt: row.confirmed_at ?? null,
    setupStyle: row.setup_style ?? "",
    attendees: Number(row.attendees ?? 0) || 0,
    timezone: row.timezone || "UTC",
    rateSnapshot: row.rate_snapshot && typeof row.rate_snapshot === "object" ? row.rate_snapshot : {},
    priceBreakdown: { lines: Array.isArray(breakdown.lines) ? breakdown.lines : [], hours: Number(breakdown.hours) || 0 },
    subtotal: num(row.subtotal),
    total: num(row.total),
    currency: row.currency || "GBP",
    bookedBy: row.booked_by ?? null,
    contactName: row.contact_name ?? "",
    contactEmail: row.contact_email ?? "",
    contactPhone: row.contact_phone ?? "",
    notes: row.notes ?? "",
    cancelledAt: row.cancelled_at ?? null,
    cancelReason: row.cancel_reason ?? "",
    metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : {},
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
    deletedAt: row.deleted_at ?? null,
  };
}
