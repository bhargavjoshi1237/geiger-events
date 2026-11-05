import Stripe from "stripe";

let cached = null;
let cachedDemo = null;

const TEST_KEY = /^(sk|rk)_test_/;

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

// Geiger's demo sandbox for demo-mode checkouts; only ever a test key, so demo sales can't take real money.
export function demoSecretKey() {
  const key = process.env.GEIGER_STRIPE_DEMO_SECRET_KEY || stripeSecretKey();
  return TEST_KEY.test(key) ? key : "";
}

export function isDemoConfigured() {
  return Boolean(demoSecretKey());
}

// Needed only when the demo sandbox is a different Stripe account from the main key.
export function demoWebhookSecret() {
  return process.env.GEIGER_STRIPE_DEMO_WEBHOOK_SECRET || "";
}

export function getDemoStripe() {
  const key = demoSecretKey();
  if (!key) return null;
  if (key === stripeSecretKey()) return getStripe();
  if (!cachedDemo) cachedDemo = new Stripe(key);
  return cachedDemo;
}
