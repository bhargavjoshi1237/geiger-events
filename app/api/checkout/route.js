import { NextResponse } from "next/server";

import { getEvent } from "@/lib/supabase/events";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";
import { checkoutBranding } from "@/lib/stripe/branding";
import { validateEventDiscount, discountBase } from "@/lib/supabase/discounts";
import { earlybirdReduction } from "@/lib/events/earlybird";
import { groupDiscountAmount } from "@/lib/events/group";

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
    seatToken = null,
    boothToken = null,
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

  const descriptor = (paymentsCfg.statementDescriptor || "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .slice(0, 22)
    .trim();

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

  let discountAmount = 0;
  let appliedCode = null;
  if (discountCode && !bundleId) {
    const appliesTo = event.discountSettings?.appliesTo || "order";
    const base = discountBase({ price: effUnit, qty, addonUnit: addons }, appliesTo);
    // Resolve against the ticket being bought, passing the base so the RPC
    // returns the final amount with the coupon's cap already applied. Taking
    // that number (rather than recomputing here) is what keeps the Stripe
    // charge identical to what buy_ticket records.
    const dres = await validateEventDiscount(eventId, discountCode, {
      ticketId,
      qty,
      base,
    });
    if (dres.ok) {
      discountAmount = dres.amount;
      if (discountAmount > 0) appliedCode = dres.code;
    }
  }

  const groupAmount = attendeeList ? groupDiscountAmount(event, effUnit * qty) : 0;
  const totalOff = Math.round((discountAmount + groupAmount) * 100) / 100;

  try {
    const stripe = getStripe();
    const separator = returnUrl.includes("?") ? "&" : "?";
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
    const branding = checkoutBranding(event.pageDesign);
    const params = {
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
        ticketId: ticketId != null ? String(ticketId) : "",
        slotId: slotId != null ? String(slotId) : "",
        discountCode: appliedCode || "",
        price: String(price),
        quantity: String(qty),
        addons: String(addons),
        donation: String(donationAmount),
        bundleId: bundleId || "",
        accessCode: accessCode || "",
        attendees: attendeeList ? JSON.stringify(attendeeList).slice(0, 490) : "",
        name,
        email,
        skipReg: skipRegistration ? "1" : "",
        clientRef: clientRef || "",
        seatToken: seatToken || "",
        boothToken: boothToken || "",
        extra: extraJson,
      },
    };

    let session;
    try {
      session = await stripe.checkout.sessions.create(
        branding ? { ...params, branding_settings: branding } : params,
      );
    } catch (e) {
      if (!branding) throw e;
      console.warn(
        `[checkout.create] branding rejected for event ${eventId} — retrying unbranded:`,
        e?.message,
      );
      session = await stripe.checkout.sessions.create(params);
    }
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("[checkout.create]", e);
    return NextResponse.json({ error: "Couldn't start checkout." }, { status: 502 });
  }
}
