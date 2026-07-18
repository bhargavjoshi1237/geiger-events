import { NextResponse } from "next/server";

import { getEvent } from "@/lib/supabase/events";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";
import {
  validateEventDiscount,
  discountBase,
  discountAmountFor,
} from "@/lib/supabase/discounts";
import { earlybirdReduction } from "@/lib/events/earlybird";
import { groupDiscountAmount } from "@/lib/events/group";

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
    ticketId = null,
    ticketPrice,
    quantity,
    addonUnit = 0,
    name = "",
    email = "",
    selections = null,
    purchasables = null,
    slot = null,
    slotId = null,
    discountCode = null,
    donation = 0,
    attendees = null,
    bundleId = null,
    accessCode = null,
    answers = null,
    formId = null,
    clientRef = null,
    skipRegistration = false,
    returnUrl,
  } = body || {};

  const price = Number(ticketPrice) || 0;
  const qty = Math.max(1, Number(quantity) || 1);
  const addons = Number(addonUnit) || 0;
  const donationAmount = Math.max(0, Number(donation) || 0);
  const attendeeList = Array.isArray(attendees) && attendees.length ? attendees : null;

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

  // Early-bird: reduce the ticket line by the in-window per-unit amount (skipped
  // for bundles). The ORIGINAL price still travels in metadata — buy_ticket
  // re-derives the same reduction from the server clock, so the two agree without
  // double-reducing.
  const ebPerUnit = bundleId ? 0 : earlybirdReduction(event, price);
  const effUnit = Math.max(0, price - ebPerUnit);

  const lineItems = [
    {
      price_data: {
        currency,
        product_data: { name: `${ticketName || "Ticket"} — ${event.name}` },
        unit_amount: Math.round(effUnit * 100),
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
  if (donationAmount > 0) {
    lineItems.push({
      price_data: {
        currency,
        product_data: { name: event.donation?.cause ? `Donation — ${event.donation.cause}` : "Donation" },
        unit_amount: Math.round(donationAmount * 100),
      },
      quantity: 1,
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
  const extra = { selections, purchasables, slot, answers, formId };
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

  // Discount code: re-validate server-side against the event's attached coupons
  // and compute the exact amount off, so the Stripe charge matches what the order
  // RPC will record (buy_ticket re-derives the same discount on return).
  let discountAmount = 0;
  let appliedCode = null;
  if (discountCode && !bundleId) {
    const dres = await validateEventDiscount(eventId, discountCode);
    if (dres.ok) {
      const appliesTo = event.discountSettings?.appliesTo || "order";
      // Base off the post-early-bird unit so the coupon matches buy_ticket.
      discountAmount = discountAmountFor(
        dres,
        discountBase({ price: effUnit, qty, addonUnit: addons }, appliesTo),
      );
      if (discountAmount > 0) appliedCode = dres.code;
    }
  }

  // Group discount (when dispensing to attendees) rides in the same one-off
  // coupon as the code discount so Stripe charges what buy_ticket will record.
  const groupAmount = attendeeList ? groupDiscountAmount(event, effUnit * qty) : 0;
  const totalOff = Math.round((discountAmount + groupAmount) * 100) / 100;

  try {
    const stripe = getStripe();
    const separator = returnUrl.includes("?") ? "&" : "?";
    // A one-off coupon applies the exact amount off to this session only.
    let discounts;
    if (totalOff > 0) {
      const coupon = await stripe.coupons.create({
        amount_off: Math.round(totalOff * 100),
        currency,
        duration: "once",
        name: appliedCode
          ? groupAmount > 0
            ? `Code ${appliedCode} + group`
            : `Code ${appliedCode}`
          : groupAmount > 0
            ? "Group discount"
            : "Discount",
      });
      discounts = [{ coupon: coupon.id }];
    }
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      customer_email: email,
      success_url: `${returnUrl}${separator}session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${returnUrl}${separator}canceled=1`,
      ...(discounts ? { discounts } : {}),
      ...(descriptor
        ? { payment_intent_data: { statement_descriptor_suffix: descriptor } }
        : {}),
      metadata: {
        eventId,
        ticketName: ticketName || "General Admission",
        // The chosen tier id (when a real tier) so the return trip can enforce
        // that tier's inventory in buy_ticket. Empty string when untiered.
        ticketId: ticketId != null ? String(ticketId) : "",
        // The booked slot id (when slot booking is on) so the return trip can
        // enforce that slot's inventory in buy_ticket. Empty string when none.
        slotId: slotId != null ? String(slotId) : "",
        // The applied discount code so the return trip re-derives the discount in
        // buy_ticket (matching what Stripe charged). Empty when none applied.
        discountCode: appliedCode || "",
        // Original (pre-early-bird) price — buy_ticket re-derives the reduction.
        price: String(price),
        quantity: String(qty),
        addons: String(addons),
        // Donation (once), bundle id, and access code for the return-trip order.
        donation: String(donationAmount),
        bundleId: bundleId || "",
        accessCode: accessCode || "",
        // Group attendees (one row per email in buy_ticket) in their own key so
        // they don't compete with `extra` for the 500-char cap.
        attendees: attendeeList ? JSON.stringify(attendeeList).slice(0, 490) : "",
        name,
        email,
        // "1" for approved guests already registered — verify skips re-filing.
        skipReg: skipRegistration ? "1" : "",
        // Correlates the pre-payment ticket answers to the order on return.
        clientRef: clientRef || "",
        extra: extraJson,
      },
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("[checkout.create]", e);
    return NextResponse.json({ error: "Couldn't start checkout." }, { status: 502 });
  }
}
