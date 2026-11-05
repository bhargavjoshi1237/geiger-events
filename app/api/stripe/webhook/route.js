import { after, NextResponse } from "next/server";

import { fulfillCheckoutSession } from "@/lib/stripe/fulfill-checkout";
import {
  demoWebhookSecret,
  getDemoStripe,
  getStripe,
  stripeWebhookSecret,
} from "@/lib/stripe/server";

const FULFILLMENT_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
]);

// Geiger's own Stripe account, plus the demo sandbox when it's a separate account with its own endpoint secret.
function endpoints() {
  return [
    { secret: stripeWebhookSecret(), stripe: getStripe(), channel: { kind: "platform" } },
    { secret: demoWebhookSecret(), stripe: getDemoStripe(), channel: { kind: "demo" } },
  ].filter((endpoint) => endpoint.secret && endpoint.stripe);
}

export async function POST(request) {
  const candidates = endpoints();
  if (!candidates.length) {
    return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  const body = await request.text();
  let event;
  let channel;
  for (const endpoint of candidates) {
    try {
      event = endpoint.stripe.webhooks.constructEvent(body, signature, endpoint.secret);
      channel = endpoint.channel;
      break;
    } catch (error) {
      if (endpoint === candidates.at(-1)) {
        console.error("[stripe.webhook] signature verification failed", error.message);
      }
    }
  }
  if (!event) {
    return NextResponse.json({ error: "Invalid Stripe signature." }, { status: 400 });
  }

  if (FULFILLMENT_EVENTS.has(event.type)) {
    try {
      await fulfillCheckoutSession(event.data.object.id, {
        source: "webhook",
        stripeEventId: event.id,
        checkoutSession: event.data.object,
        defer: after,
        channel,
      });
    } catch (error) {
      console.error("[stripe.webhook] fulfillment failed", error);
      return NextResponse.json({ error: "Fulfillment failed." }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
