import { NextResponse } from "next/server";

import { getEvent } from "@/lib/supabase/events";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";
import { checkoutBranding } from "@/lib/stripe/branding";
import { validateEventDiscount, discountBase } from "@/lib/supabase/discounts";
import { earlybirdReduction } from "@/lib/events/earlybird";
import { groupDiscountAmount } from "@/lib/events/group";
import { resolveTicketReleases } from "@/lib/events/ticket_releases";
import { expressConfig } from "@/lib/events/express_checkout";

// Add-ons as named Stripe lines, purchasables at the event's own price; one "Add-ons" line when they don't add up to the charge.
function addonLineItems({ event, currency, qty, addons, purchasables, selections, slot }) {
  const unitCents = Math.round(addons * 100);
  if (unitCents <= 0) return [];
  const catalog = new Map(
    (Array.isArray(event.purchasables) ? event.purchasables : []).map((p) => [String(p?.id), p]),
  );

  const items = [];
  for (const p of Array.isArray(purchasables) ? purchasables : []) {
    const known = catalog.get(String(p?.id));
    const cents = Math.round((Number(known ? known.price : p?.price) || 0) * 100);
    const count = Math.max(0, Math.floor(Number(p?.quantity) || 0));
    if (cents > 0 && count > 0) items.push({ name: known?.name || p?.name, cents, count: count * qty });
  }
  for (const o of Array.isArray(selections) ? selections : []) {
    for (const c of Array.isArray(o?.choices) ? o.choices : []) {
      const cents = Math.round((Number(c?.price) || 0) * 100);
      if (cents > 0) items.push({ name: o.offering ? `${o.offering}: ${c.label}` : c.label, cents, count: qty });
    }
  }
  const slotCents = Math.round((Number(slot?.priceDelta) || 0) * 100);
  if (slotCents > 0) items.push({ name: slot.label ? `Time slot: ${slot.label}` : "Time slot", cents: slotCents, count: qty });

  const itemized = items.reduce((sum, i) => sum + i.cents * i.count, 0);
  const lines = itemized === unitCents * qty ? items : [{ name: "Add-ons", cents: unitCents, count: qty }];
  return lines.map((i) => ({
    price_data: {
      currency,
      product_data: { name: String(i.name || "Add-on").slice(0, 250) },
      unit_amount: i.cents,
    },
    quantity: i.count,
  }));
}

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
    express = false,
    termsAcceptedAt = null,
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
  const event = await getEvent(eventId);
  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  // Express Lane leaves name and email to Stripe; only an event that turned it on may skip them.
  const expressCfg = express ? expressConfig(event) : null;
  if (express && !expressCfg.enabled) {
    return NextResponse.json({ error: "Express checkout isn't available." }, { status: 400 });
  }
  if (!express && (!email || !email.includes("@"))) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }
  if (email && !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  const paymentsCfg = event.payments || {};
  if (paymentsCfg.enabled === false) {
    return NextResponse.json(
      { error: "Online payments are disabled for this event." },
      { status: 400 },
    );
  }

  const currency = paymentsCfg.currency || "usd";

  // Batched releases: refuse to start Stripe when the unlocked tranches can't
  // cover the basket (buy_ticket re-checks this under lock — this is the early,
  // buyer-friendly error before they pay).
  if (ticketId != null && !bundleId) {
    const entry = (Array.isArray(event.tickets) ? event.tickets : []).find(
      (t) => String(t.id) === String(ticketId),
    );
    if (entry && Array.isArray(entry.releases) && entry.releases.length) {
      const sold = Number(event.ticketSold?.[String(ticketId)]) || 0;
      const st = resolveTicketReleases(entry, {
        sold,
        soldOutAtMap: event.releaseSoldOutAt || {},
        now: new Date(),
      });
      if (!st.unlimitedUnlocked && sold + qty > st.unlockedQty) {
        const next = st.nextRelease;
        return NextResponse.json(
          {
            error: next?.unlocksAt
              ? `This wave is sold out — the next wave opens ${next.unlocksAt}.`
              : "This wave is sold out — the next wave isn't open yet.",
          },
          { status: 409 },
        );
      }
    }
  }

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
  lineItems.push(
    ...addonLineItems({ event, currency, qty, addons, purchasables, selections, slot }),
  );
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
    // Nothing after a '#' reaches the page's query, so the session id must come before any anchor.
    const returnBase = String(returnUrl).split("#")[0];
    const separator = returnBase.includes("?") ? "&" : "?";
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
      ...(email ? { customer_email: email } : {}),
      ...(expressCfg?.collectName && !name
        ? { name_collection: { individual: { enabled: true, optional: false } } }
        : {}),
      success_url: `${returnBase}${separator}session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${returnBase}${separator}canceled=1`,
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
        express: express ? "1" : "",
        termsAck: termsAcceptedAt ? String(termsAcceptedAt).slice(0, 40) : "",
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
