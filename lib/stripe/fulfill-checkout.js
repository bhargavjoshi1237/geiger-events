import { formatDate } from "@/components/internal/screens/events/sample_data";
import { sendSuiteEmail } from "@/lib/email/client";
import { splitRegistrationAnswers } from "@/lib/events/registration_answers";
import { adminClient } from "@/lib/supabase/admin";
import { getEvent } from "@/lib/supabase/events";
import { buyTicket } from "@/lib/supabase/orders";
import { registerForEvent } from "@/lib/supabase/registrations";
import { linkTicketAnswers } from "@/lib/supabase/ticket_questions";

import { getStripe } from "./server";

const STRIPE_EXPANSIONS = [
  "payment_intent.payment_method",
  "payment_intent.latest_charge.balance_transaction",
];

// Stripe never returns a full PAN or CVC from these retrieval APIs. The
// PaymentIntent client secret is still a credential, though, so never persist it
// in the organizer-visible snapshot.
function safeStripeValue(value) {
  if (Array.isArray(value)) return value.map(safeStripeValue);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "client_secret")
      .map(([key, child]) => [key, safeStripeValue(child)]),
  );
}

async function retrieveCheckoutDetails(sessionId) {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: STRIPE_EXPANSIONS,
  });

  // An expanded Checkout Session only embeds the first page. Preserve the full
  // line-item list so the stored Stripe snapshot remains complete for large
  // orders too.
  const lineItems = [];
  for await (const item of stripe.checkout.sessions.listLineItems(sessionId, {
    limit: 100,
  })) {
    lineItems.push(item);
  }
  session.line_items = {
    object: "list",
    data: lineItems,
    has_more: false,
    url: `/v1/checkout/sessions/${sessionId}/line_items`,
  };

  return session;
}

function paymentIntentId(session) {
  return typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id || null;
}

async function storePaymentSnapshot(orderId, session, { source, stripeEventId }) {
  if (!orderId) return false;
  const sb = adminClient();
  if (!sb) {
    console.error("[checkout.fulfill] service-role client unavailable; Stripe snapshot not stored");
    return false;
  }

  const snapshot = {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    source,
    stripeEventId: stripeEventId || null,
    checkoutSession: safeStripeValue(session),
  };
  const { error } = await sb
    .from("event_orders")
    .update({ stripe_payment_details: snapshot })
    .eq("id", orderId)
    .eq("stripe_session_id", session.id);
  if (error) {
    console.error("[checkout.fulfill] couldn't store Stripe snapshot", error.message);
    return false;
  }
  return true;
}

// Shared by the signed Stripe webhook and the buyer return route. buy_ticket is
// idempotent on Checkout Session ID, so concurrent/retried calls create one
// order, one registration, and one confirmation email.
export async function fulfillCheckoutSession(
  sessionId,
  {
    source = "return",
    stripeEventId = null,
    checkoutSession = null,
    defer = null,
  } = {},
) {
  // Keep the response-critical path intentionally small: confirm the Session
  // and atomically create the order. Stripe enrichment, registration linking,
  // and email are scheduled after the HTTP response when a Route Handler gives
  // us Next.js `after` as `defer`.
  const session =
    checkoutSession || (await getStripe().checkout.sessions.retrieve(sessionId));
  if (session.payment_status !== "paid") {
    return { ok: false, status: session.payment_status, session };
  }

  const meta = session.metadata || {};
  let extra = {};
  try {
    extra = meta.extra ? JSON.parse(meta.extra) : {};
  } catch {
    extra = {};
  }

  const qty = Number(meta.quantity) || 1;
  let attendees = null;
  if (meta.attendees) {
    try {
      const parsed = JSON.parse(meta.attendees);
      if (Array.isArray(parsed) && parsed.length) attendees = parsed;
    } catch {
      attendees = null;
    }
  }

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
    purchasables: extra.purchasables || null,
    slot: extra.slot || null,
    slotId: meta.slotId || null,
    discountCode: meta.discountCode || null,
    donation: Number(meta.donation) || 0,
    attendees,
    bundleId: meta.bundleId || null,
    accessCode: meta.accessCode || null,
    // Seated events: buy_seats resolves the held seats from this token.
    seatToken: meta.seatToken || null,
    stripeSessionId: session.id,
    stripePaymentIntentId: paymentIntentId(session),
  });

  const finishFulfillment = async () => {
    let detailedSession = session;
    if (res.ok) {
      try {
        detailedSession = await retrieveCheckoutDetails(sessionId);
        await storePaymentSnapshot(res.orderId, detailedSession, {
          source,
          stripeEventId,
        });
      } catch (error) {
        console.error("[checkout.fulfill] Stripe enrichment failed", error);
      }
    }

    if (res.ok && res.created && meta.skipReg !== "1") {
      try {
        const event = await getEvent(meta.eventId);
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
          enforceCapacity: false,
        });

        if (meta.clientRef && regRes?.registration?.id) {
          await linkTicketAnswers(meta.clientRef, regRes.registration.id);
        }

        const total =
          typeof detailedSession.amount_total === "number"
            ? detailedSession.amount_total / 100
            : (Number(meta.price) || 0) * qty + (Number(meta.addons) || 0) * qty;
        const returnUrl = detailedSession.return_url || detailedSession.success_url || "";
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
            eventUrl: returnUrl ? returnUrl.split("?")[0] : "",
          },
        });
      } catch (error) {
        console.error("[checkout.fulfill] post-payment work failed", error);
      }
    }
  };

  if (typeof defer === "function") defer(finishFulfillment);
  else await finishFulfillment();

  return {
    ok: res.ok,
    orderId: res.orderId,
    sold: res.sold,
    soldOut: res.soldOut,
    ticket: meta.ticketName,
    quantity: qty,
    name: meta.name,
    email: meta.email,
  };
}
