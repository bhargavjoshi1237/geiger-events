import Stripe from "stripe";

// Server-only Stripe client. The secret key lives in Vercel as
// GEIGER_STRIPE_SECRET_KEY (Production + Preview) — the shared name the suite's
// Vercel↔Stripe integration injects (see geiger-dash `lib/stripe/server.js`). A
// legacy `STRIPE_SECRET_KEY` is still honored as a fallback for local dev. When
// the key is absent/empty the helpers degrade gracefully — callers return a
// "not configured" result and the UI shows a clear message instead of crashing.
// Mirror of the Supabase isConfigured() guard pattern used across the data layer.

let cached = null;

export function stripeSecretKey() {
  return (
    process.env.GEIGER_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY || ""
  );
}

export function isStripeConfigured() {
  return Boolean(stripeSecretKey());
}

export function getStripe() {
  if (!isStripeConfigured()) return null;
  if (!cached) {
    // No apiVersion override — use the version pinned by this SDK release.
    cached = new Stripe(stripeSecretKey());
  }
  return cached;
}
