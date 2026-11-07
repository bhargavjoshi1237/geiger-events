import { adminClient } from "@/lib/supabase/admin";
import { buildBookingIcs, icsFileName } from "@/lib/venue_booking/ics";
import { normalizeVenueBooking } from "@/lib/venue_booking/normalize";

// Logged-out .ics download linked from Instant Book emails; the booking's public_token is the bearer secret.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

export async function GET(request) {
  const token = request.nextUrl.searchParams.get("token") || "";
  if (!UUID.test(token)) return notFound();
  const sb = adminClient();
  if (!sb) return new Response("Unavailable", { status: 503 });

  const { data: row, error } = await sb
    .from("venue_bookings")
    .select("*")
    .eq("public_token", token)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) console.error("[venue-bookings.ics]", error.message);
  if (!row) return notFound();
  const booking = normalizeVenueBooking(row);

  const [{ data: venue }, { data: space }, eventRes] = await Promise.all([
    sb.from("venues").select("name, address, city, postcode, country").eq("id", booking.venueId).maybeSingle(),
    sb.from("venue_spaces").select("name").eq("id", booking.spaceId).maybeSingle(),
    booking.eventId
      ? sb.from("events").select("name").eq("id", booking.eventId).eq("project_id", booking.projectId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const ics = buildBookingIcs({
    booking,
    spaceName: space?.name || "",
    venueName: venue?.name || "",
    address: [venue?.address, venue?.city, venue?.postcode, venue?.country].filter(Boolean).join(", "),
    eventName: eventRes?.data?.name || "",
  });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${icsFileName(booking)}"`,
      "Cache-Control": "no-store",
    },
  });
}
