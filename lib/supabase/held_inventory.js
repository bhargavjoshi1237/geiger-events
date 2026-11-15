import { adminClient } from "./admin";

// Server-only: a buyer's live seat and booth holds, read with the service role so checkout can price exactly what buy_seats / buy_booths will book.
// Each returns the rows (possibly empty), or null when the holds couldn't be read.

const live = () => new Date().toISOString();

export async function heldSeats(eventId, token) {
  const admin = adminClient();
  if (!admin || !eventId || !token) return null;
  try {
    const { data, error } = await admin
      .from("seat_holds")
      .select("seat_id, seats(section_id)")
      .eq("event_id", eventId)
      .eq("session_token", token)
      .gt("expires_at", live());
    if (error) {
      console.error("[holds.seats]", error.message);
      return null;
    }
    return (data || []).map((row) => ({ seatId: row.seat_id, sectionId: row.seats?.section_id ?? null }));
  } catch (e) {
    console.error("[holds.seats]", e);
    return null;
  }
}

export async function heldBooths(eventId, token) {
  const admin = adminClient();
  if (!admin || !eventId || !token) return null;
  try {
    const { data, error } = await admin
      .from("booth_holds")
      .select("booth_id, hall_booths(price)")
      .eq("event_id", eventId)
      .eq("session_token", token)
      .gt("expires_at", live());
    if (error) {
      console.error("[holds.booths]", error.message);
      return null;
    }
    return (data || []).map((row) => ({ boothId: row.booth_id, price: Number(row.hall_booths?.price) || 0 }));
  } catch (e) {
    console.error("[holds.booths]", e);
    return null;
  }
}
