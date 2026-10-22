import { formatDate } from "@/components/internal/screens/events/sample_data";
import { sendNotificationEmail } from "@/lib/email/notifications";
import { notifyRegistrationPending, notifyTicketSold } from "@/lib/notifications/server";
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

// Stored on the order as metadata.ticketEmail, which the success screen reads to confirm the tickets went out.
async function recordTicketEmail(orderId, { to, eventUrl, result }) {
  const sb = adminClient();
  if (!sb || !orderId) return;
  try {
    const { data } = await sb.from("event_orders").select("metadata").eq("id", orderId).maybeSingle();
    const metadata = data?.metadata && typeof data.metadata === "object" ? data.metadata : {};
    const ticketEmail = {
      status: result.ok ? "sent" : result.skipped ? "off" : "failed",
      to,
      eventUrl,
      at: new Date().toISOString(),
      attempts: (Number(metadata.ticketEmail?.attempts) || 0) + 1,
      ...(result.ok ? {} : { error: String(result.error || "") }),
    };
    const { error } = await sb
      .from("event_orders")
      .update({ metadata: { ...metadata, ticketEmail } })
      .eq("id", orderId);
    if (error) console.error("[checkout.fulfill] couldn't record the ticket email", error.message);
  } catch (error) {
    console.error("[checkout.fulfill] couldn't record the ticket email", error);
  }
}

// The buyer's ticket email; also what the success screen's Resend calls.
export async function sendTicketConfirmation({ orderId, eventId, to, name, ticketName, quantity, total, eventUrl = "" }) {
  let result;
  try {
    const event = await getEvent(eventId);
    const siteOrigin = eventUrl ? new URL(eventUrl).origin : "";
    result = to
      ? await sendNotificationEmail({
          projectId: event?.projectId,
          notification: "ticket_purchase_confirmation",
          template: "events.ticket_purchase_confirmation",
          to,
          data: {
            buyerName: name || "there",
            eventName: event?.name || "your event",
            eventDate: event ? formatDate(event.date) : "",
            ticketType: ticketName || "General Admission",
            quantity: String(quantity),
            orderTotal: (Number(total) || 0).toFixed(2),
            orderId: String(orderId || "").slice(0, 8),
            eventUrl,
            qrCodeUrl: siteOrigin && orderId ? `${siteOrigin}/api/tickets/${orderId}/qr` : "",
          },
        })
      : { ok: false, error: "no_email" };
  } catch (error) {
    console.error("[checkout.fulfill] ticket email failed", error);
    result = { ok: false, error: "request_failed" };
  }
  await recordTicketEmail(orderId, { to, eventUrl, result });
  return result;
}

export async function fulfillCheckoutSession(
  sessionId,
  {
    source = "return",
    stripeEventId = null,
    checkoutSession = null,
    defer = null,
  } = {},
) {
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

  // Express Lane orders carry no buyer in metadata — Stripe collected it on the hosted page.
  const buyer = session.customer_details || {};
  const buyerName = meta.name || buyer.individual_name || buyer.name || "";
  const buyerEmail = meta.email || buyer.email || "";

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
    name: buyerName,
    email: buyerEmail,
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
    seatToken: meta.seatToken || null,
    boothToken: meta.boothToken || null,
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
          name: buyerName,
          email: buyerEmail,
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

        if (regRes?.status === "Pending" && regRes.registration?.id) {
          await notifyRegistrationPending({ event, registrationId: regRes.registration?.id, name: buyerName });
        }
      } catch (error) {
        console.error("[checkout.fulfill] post-payment work failed", error);
      }
    }

    // Every new paid order gets its tickets by email, approved buyers included (they skip registration above).
    if (res.ok && res.created) {
      const returnUrl = detailedSession.return_url || detailedSession.success_url || "";
      await sendTicketConfirmation({
        orderId: res.orderId,
        eventId: meta.eventId,
        to: buyerEmail,
        name: buyerName,
        ticketName: meta.ticketName,
        quantity: qty,
        total:
          typeof detailedSession.amount_total === "number"
            ? detailedSession.amount_total / 100
            : (Number(meta.price) || 0) * qty + (Number(meta.addons) || 0) * qty,
        eventUrl: returnUrl.split("?")[0],
      });
    }

    // Deduped per order, so the webhook and verify routes both fulfilling still notify once.
    if (res.ok && res.created && res.orderId) {
      await notifyTicketSold({
        eventId: meta.eventId,
        orderId: res.orderId,
        buyerName,
        quantity: qty,
        ticketName: meta.ticketName,
      });
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
    name: buyerName,
    email: buyerEmail,
  };
}
