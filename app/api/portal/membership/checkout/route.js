import { NextResponse } from "next/server";
import { getSessionMember } from "@/lib/portal/session";
import {
  getPlanForPurchase,
  hasActiveMembership,
  enrollMembership,
} from "@/lib/portal/memberships";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";

// POST { planId, returnUrl } -> for a free plan, enrolls directly ({ enrolled });
// for a paid plan, opens a Stripe Checkout session ({ url }). Price/project are
// resolved server-side from the plan — the client value is never trusted.
export async function POST(request) {
  const member = await getSessionMember();
  if (!member) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const { planId, returnUrl } = await request.json().catch(() => ({}));
  if (!planId) {
    return NextResponse.json({ error: "Missing plan." }, { status: 400 });
  }

  const { plan, buyable } = await getPlanForPurchase(planId);
  if (!plan || !buyable) {
    return NextResponse.json(
      { error: "This membership isn't available." },
      { status: 404 },
    );
  }
  if (await hasActiveMembership(member.email, plan.id)) {
    return NextResponse.json(
      { error: "You already hold this membership." },
      { status: 409 },
    );
  }

  // Free membership — enroll immediately, no payment.
  if (plan.price <= 0) {
    const res = await enrollMembership({
      email: member.email,
      name: member.name,
      plan,
    });
    if (!res) {
      return NextResponse.json({ error: "Couldn't enroll." }, { status: 500 });
    }
    return NextResponse.json({ enrolled: true, planName: plan.name });
  }

  // Paid membership — one-time payment for the term via Stripe Checkout.
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Online payments aren't configured." },
      { status: 503 },
    );
  }
  const base = typeof returnUrl === "string" && /^https?:\/\//i.test(returnUrl)
    ? returnUrl
    : "";
  if (!base) {
    return NextResponse.json({ error: "Missing return URL." }, { status: 400 });
  }
  const sep = base.includes("?") ? "&" : "?";

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: member.email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${plan.name} membership`,
              ...(plan.description ? { description: plan.description.slice(0, 200) } : {}),
            },
            unit_amount: Math.round(plan.price * 100),
          },
          quantity: 1,
        },
      ],
      success_url: `${base}${sep}membership_session={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}${sep}membership_canceled=1`,
      metadata: {
        kind: "membership",
        planId: plan.id,
        email: member.email,
        name: member.name || "",
      },
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("[portal.membership.checkout]", e);
    return NextResponse.json({ error: "Couldn't start checkout." }, { status: 502 });
  }
}
