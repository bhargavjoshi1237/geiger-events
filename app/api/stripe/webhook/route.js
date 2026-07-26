import { after, NextResponse } from "next/server";

import { fulfillCheckoutSession } from "@/lib/stripe/fulfill-checkout";
import {
  getStripe,
  isStripeConfigured,
  stripeWebhookSecret,
} from "@/lib/stripe/server";

const FULFILLMENT_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
]);

export async function POST(request) {
  const secret = stripeWebhookSecret();
  if (!isStripeConfigured() || !secret) {
    return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  let event;
  try {
    // Signature verification requires the exact, unparsed UTF-8 request body.
    event = getStripe().webhooks.constructEvent(await request.text(), signature, secret);
  } catch (error) {
    console.error("[stripe.webhook] signature verification failed", error.message);
    return NextResponse.json({ error: "Invalid Stripe signature." }, { status: 400 });
  }

  if (FULFILLMENT_EVENTS.has(event.type)) {
    try {
      await fulfillCheckoutSession(event.data.object.id, {
        source: "webhook",
        stripeEventId: event.id,
        checkoutSession: event.data.object,
        defer: after,
      });
    } catch (error) {
      // A non-2xx response tells Stripe to retry this delivery.
      console.error("[stripe.webhook] fulfillment failed", error);
      return NextResponse.json({ error: "Fulfillment failed." }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
