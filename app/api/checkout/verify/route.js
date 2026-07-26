import { after, NextResponse } from "next/server";

import { fulfillCheckoutSession } from "@/lib/stripe/fulfill-checkout";
import { isStripeConfigured } from "@/lib/stripe/server";

// The return route gives the buyer immediate fulfillment. The signed webhook
// calls the same idempotent function so payment completion does not depend on
// the buyer successfully returning to this page.
export async function GET(request) {
  const sessionId = request.nextUrl.searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "Missing session id." }, { status: 400 });
  }
  if (!isStripeConfigured()) {
    return NextResponse.json({ ok: false, error: "Not configured." }, { status: 503 });
  }

  try {
    const result = await fulfillCheckoutSession(sessionId, {
      source: "return",
      defer: after,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[checkout.verify]", error);
    return NextResponse.json(
      { ok: false, error: "Couldn't verify this payment." },
      { status: 502 },
    );
  }
}
