import { NextResponse } from "next/server";
import { getSessionMember } from "@/lib/portal/session";
import { getPlanForPurchase, enrollMembership } from "@/lib/portal/memberships";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";

// POST { sessionId } -> confirms a membership Stripe Checkout on return and
// enrolls the member. Idempotent (enrollMembership dedupes on the session id), so
// a refreshed return page never enrolls twice.
export async function POST(request) {
  const member = await getSessionMember();
  if (!member) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const { sessionId } = await request.json().catch(() => ({}));
  if (!sessionId) {
    return NextResponse.json({ error: "Missing session." }, { status: 400 });
  }
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Not configured." }, { status: 503 });
  }

  let session;
  try {
    session = await getStripe().checkout.sessions.retrieve(sessionId);
  } catch (e) {
    console.error("[portal.membership.verify]", e);
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  const meta = session.metadata || {};
  // Only enroll the member the session belongs to, and only for a membership.
  if (
    meta.kind !== "membership" ||
    String(meta.email || "").toLowerCase() !== String(member.email).toLowerCase()
  ) {
    return NextResponse.json({ error: "Session mismatch." }, { status: 403 });
  }
  if (session.payment_status !== "paid") {
    return NextResponse.json({ enrolled: false, status: session.payment_status });
  }

  const { plan, buyable } = await getPlanForPurchase(meta.planId);
  if (!plan || !buyable) {
    return NextResponse.json({ error: "Plan unavailable." }, { status: 404 });
  }

  const res = await enrollMembership({
    email: member.email,
    name: member.name,
    plan,
    stripeSessionId: session.id,
  });
  if (!res) {
    return NextResponse.json({ error: "Couldn't enroll." }, { status: 500 });
  }
  return NextResponse.json({ enrolled: true, planName: plan.name });
}
