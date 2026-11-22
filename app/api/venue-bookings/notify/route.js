import { NextResponse } from "next/server";

import { sessionClient } from "@/lib/pay/server";
import { normalizeVenueBooking } from "@/lib/venue_booking/normalize";
import { sendBookingEmails } from "@/lib/venue_booking/notify";

// Instant Book emails: confirmation / hold notice / cancellation to the venue contact and the booker.
// Signed-in suite users only; the booking is read through their own session, so RLS scopes access.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS = new Set(["confirmation", "hold", "cancellation"]);

function siteBase(request) {
  let origin = "";
  try {
    const header = request.headers.get("origin");
    origin = header && /^https?:\/\//i.test(header) ? new URL(header).origin : request.nextUrl.origin;
  } catch {
    origin = request.nextUrl.origin;
  }
  return `${origin}${process.env.NEXT_PUBLIC_BASE_PATH || ""}`;
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const bookingId = String(body?.bookingId || "");
  const kind = String(body?.kind || "");
  if (!UUID.test(bookingId) || !KINDS.has(kind)) {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const session = await sessionClient();
  if (!session) return NextResponse.json({ ok: false, error: "Sign-in is unavailable right now." }, { status: 503 });
  const { data: auth } = await session.auth.getUser();
  if (!auth?.user) return NextResponse.json({ ok: false, error: "Sign in to continue." }, { status: 401 });

  const sb = session.schema("events");
  const { data: row, error } = await sb
    .from("venue_bookings")
    .select("*")
    .eq("id", bookingId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) {
    console.error("[venue-bookings.notify]", error.message);
    return NextResponse.json({ ok: false, error: "Couldn't load the booking." }, { status: 500 });
  }
  if (!row) return NextResponse.json({ ok: false, error: "Booking not found." }, { status: 404 });

  const { noRecipients, ...result } = await sendBookingEmails({
    db: sb,
    baseUrl: siteBase(request),
    row,
    booking: normalizeVenueBooking(row),
    kind,
  });
  return NextResponse.json(result, noRecipients ? { status: 409 } : undefined);
}
