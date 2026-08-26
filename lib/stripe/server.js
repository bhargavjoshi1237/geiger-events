import Stripe from "stripe";

let cached = null;

export function stripeSecretKey() {
  return (
    process.env.GEIGER_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY || ""
  );
}

export function isStripeConfigured() {
  return Boolean(stripeSecretKey());
}

export function stripeWebhookSecret() {
  return (
    process.env.GEIGER_STRIPE_WEBHOOK_SECRET ||
    process.env.STRIPE_WEBHOOK_SECRET ||
    ""
  );
}

export function getStripe() {
  if (!isStripeConfigured()) return null;
  if (!cached) {
    cached = new Stripe(stripeSecretKey());
  }
  return cached;
}
