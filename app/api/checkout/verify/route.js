import { NextResponse } from "next/server";

import { getEvent } from "@/lib/supabase/events";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";
import { buyTicket } from "@/lib/supabase/orders";
import { registerForEvent } from "@/lib/supabase/registrations";
import { linkTicketAnswers } from "@/lib/supabase/ticket_questions";
import { sendSuiteEmail } from "@/lib/email/client";
import { formatDate } from "@/components/internal/screens/events/sample_data";
import { splitRegistrationAnswers } from "@/lib/events/registration_answers";

// Confirms a Stripe Checkout Session on the buyer's return and turns it into a
// real order. buy_ticket is idempotent on stripe_session_id, so a refreshed
// return page never double-books, double-registers, or double-emails.
export async function GET(request) {
  const sessionId = request.nextUrl.searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "Missing session id." }, { status: 400 });
  }
  if (!isStripeConfigured()) {
    return NextResponse.json({ ok: false, error: "Not configured." }, { status: 503 });
  }

  let session;
  try {
    const stripe = getStripe();
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (e) {
    console.error("[checkout.verify]", e);
    return NextResponse.json({ ok: false, error: "Session not found." }, { status: 404 });
  }

  if (session.payment_status !== "paid") {
    return NextResponse.json({ ok: false, status: session.payment_status });
  }

  const meta = session.metadata || {};
  let extra = {};
  try {
    extra = meta.extra ? JSON.parse(meta.extra) : {};
  } catch {
    extra = {};
  }

  const qty = Number(meta.quantity) || 1;
  const event = await getEvent(meta.eventId);

  const res = await buyTicket({
    eventId: meta.eventId,
    name: meta.name,
    email: meta.email,
    ticket: meta.ticketName,
    ticketId: meta.ticketId || null,
    price: Number(meta.price) || 0,
    quantity: qty,
    addons: Number(meta.addons) || 0,
    selections: extra.selections || null,
    stripeSessionId: session.id,
    stripePaymentIntentId: session.payment_intent,
  });

  if (res.ok && res.created && meta.skipReg !== "1") {
    // Parity with the free-ticket path: a paid order also files a registration
    // record so the buyer shows up in Guests/RSVPs. Approval/waitlist policy is
    // read from the event itself, not trusted from checkout-time metadata.
    // Skipped for approved guests (skipReg) — they're already a registration.
    const rsvpCfg = event?.rsvp || {};
    const { dietary, accessibility, answers } = splitRegistrationAnswers(
      event?.questions,
      extra.answers || {},
    );
    const regRes = await registerForEvent({
      eventId: meta.eventId,
      formId: extra.formId || null,
      name: meta.name,
      email: meta.email,
      partySize: qty,
      dietary,
      accessibility,
      answers,
      requireApproval: !!rsvpCfg.requireApproval,
      allowWaitlist: rsvpCfg.waitlist !== false,
      source: "Online",
      // Parity registration after a paid order — buy_ticket already gated
      // capacity, so don't re-gate (would drop a paid attendee).
      enforceCapacity: false,
    });

    // Attach the pre-payment ticket answers (written before the Stripe handoff)
    // to the registration we just filed.
    if (meta.clientRef && regRes?.registration?.id) {
      await linkTicketAnswers(meta.clientRef, regRes.registration.id);
    }

    const total = (Number(meta.price) || 0) * qty + (Number(meta.addons) || 0) * qty;
    await sendSuiteEmail({
      template: "events.ticket_purchase_confirmation",
      to: meta.email,
      data: {
        buyerName: meta.name || "there",
        eventName: event?.name || "your event",
        eventDate: event ? formatDate(event.date) : "",
        ticketType: meta.ticketName || "General Admission",
        quantity: String(qty),
        orderTotal: total.toFixed(2),
        orderId: String(res.orderId || "").slice(0, 8),
        // The buyer's own return URL (stripped of the session_id template) —
        // the event's public page, basePath included.
        eventUrl: session.success_url ? session.success_url.split("?")[0] : "",
      },
    });
  }

  return NextResponse.json({
    ok: res.ok,
    orderId: res.orderId,
    sold: res.sold,
    soldOut: res.soldOut,
    ticket: meta.ticketName,
    quantity: qty,
    name: meta.name,
    email: meta.email,
  });
}
