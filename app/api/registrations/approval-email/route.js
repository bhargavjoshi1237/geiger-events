import { NextResponse } from "next/server";

import { sendSuiteEmail } from "@/lib/email/client";
import { formatDate } from "@/components/internal/screens/events/sample_data";

// Emails an approved registrant a link back to the event's public page, where a
// dialog prompts them to continue and pay for their spot. Fire-and-forget from
// the Approval Gates screen — it never blocks (or reverses) the approval itself.
// The email itself is rendered/delivered by the shared dash email service; this
// route only assembles the "continue" link and hands off the data.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const {
    name = "",
    email,
    eventId,
    eventName = "your event",
    eventDate = "",
    origin,
    basePath = "",
  } = body || {};

  if (!email || !eventId) {
    return NextResponse.json(
      { ok: false, error: "Missing recipient or event." },
      { status: 400 },
    );
  }

  // Build the continue link only from a valid http(s) origin (the site itself).
  let base = "";
  try {
    if (origin && /^https?:\/\//i.test(origin)) base = new URL(origin).origin;
  } catch {
    base = "";
  }
  const params = new URLSearchParams({ approved: "1", email });
  if (name) params.set("name", name);
  const continueUrl = `${base}${basePath}/e/${eventId}?${params.toString()}`;

  const res = await sendSuiteEmail({
    template: "events.registration_approved",
    to: email,
    data: {
      guestName: name || "there",
      eventName,
      eventDate: eventDate ? formatDate(eventDate) : "",
      continueUrl,
    },
  });

  return NextResponse.json({ ok: res.ok, error: res.error });
}
