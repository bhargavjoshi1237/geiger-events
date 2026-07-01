import { NextResponse } from "next/server";

import { getEvent } from "@/lib/supabase/events";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";

// Creates a Stripe Checkout Session for a priced ticket. Free ($0) tickets
// never call this — the public page finalizes those directly through the
// existing buy_ticket RPC. `returnUrl` is the buyer's current event page URL
// (the client already knows its own origin/basePath); Stripe redirects back to
// it with `?session_id=` on success or `?canceled=1` on cancel.
export async function POST(request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Online payments aren't configured." },
      { status: 503 },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const {
    eventId,
    ticketName,
    ticketPrice,
    quantity,
    addonUnit = 0,
    name = "",
    email = "",
    selections = null,
    answers = null,
    formId = null,
    returnUrl,
  } = body || {};

  const price = Number(ticketPrice) || 0;
  const qty = Math.max(1, Number(quantity) || 1);
  const addons = Number(addonUnit) || 0;

  if (!eventId || !returnUrl || price <= 0) {
    return NextResponse.json({ error: "Missing checkout details." }, { status: 400 });
  }
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  const event = await getEvent(eventId);
  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  const paymentsCfg = event.payments || {};
  if (paymentsCfg.enabled === false) {
    return NextResponse.json(
      { error: "Online payments are disabled for this event." },
      { status: 400 },
    );
  }

  const currency = paymentsCfg.currency || "usd";
  const lineItems = [
    {
      price_data: {
        currency,
        product_data: { name: `${ticketName || "Ticket"} — ${event.name}` },
        unit_amount: Math.round(price * 100),
      },
      quantity: qty,
    },
  ];
  if (addons > 0) {
    lineItems.push({
      price_data: {
        currency,
        product_data: { name: "Add-ons" },
        unit_amount: Math.round(addons * 100),
      },
      quantity: qty,
    });
  }

  // Stripe's statement_descriptor_suffix only allows letters/digits/spaces,
  // max 22 chars — sanitize rather than pass through raw organizer input.
  const descriptor = (paymentsCfg.statementDescriptor || "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .slice(0, 22)
    .trim();

  // Offering selections + registration answers ride along in a single metadata
  // value so the return trip can also file a registration record (parity with
  // the free-ticket path). Stripe caps each metadata value at 500 chars, so we
  // degrade gracefully — drop the bulkiest parts first — rather than fail the
  // whole checkout over a large custom-question form.
  const extra = { selections, answers, formId };
  let extraJson = JSON.stringify(extra);
  if (extraJson.length > 480) {
    extra.selections = null;
    extraJson = JSON.stringify(extra);
  }
  if (extraJson.length > 480) {
    extra.answers = null;
    extraJson = JSON.stringify(extra);
    console.warn(
      `[checkout.create] offering/answer metadata too large for event ${eventId} — dropped`,
    );
  }

  try {
    const stripe = getStripe();
    const separator = returnUrl.includes("?") ? "&" : "?";
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      customer_email: email,
      success_url: `${returnUrl}${separator}session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${returnUrl}${separator}canceled=1`,
      ...(descriptor
        ? { payment_intent_data: { statement_descriptor_suffix: descriptor } }
        : {}),
      metadata: {
        eventId,
        ticketName: ticketName || "General Admission",
        price: String(price),
        quantity: String(qty),
        addons: String(addons),
        name,
        email,
        extra: extraJson,
      },
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("[checkout.create]", e);
    return NextResponse.json({ error: "Couldn't start checkout." }, { status: 502 });
  }
}
