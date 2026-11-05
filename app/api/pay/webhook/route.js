import { after } from "next/server";

import { pay } from "@/lib/pay/server";
import { fulfillCheckoutSession } from "@/lib/stripe/fulfill-checkout";

// Connect endpoint ("events on connected accounts"): ticket sales made on an organization's own Stripe account.
export const POST = pay.webhooks.handler({
  onPaymentSucceeded: async (payment, { event, session, stripeAccount }) => {
    if (!stripeAccount) return;
    await fulfillCheckoutSession(session.id, {
      source: "webhook",
      stripeEventId: event.id,
      checkoutSession: session,
      defer: after,
      channel: { kind: "connected", stripeAccount },
    });
  },
});
