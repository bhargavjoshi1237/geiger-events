import { after, NextResponse } from "next/server";

import { channelFromParam } from "@/lib/pay/server";
import { fulfillCheckoutSession } from "@/lib/stripe/fulfill-checkout";
import { isDemoConfigured, isStripeConfigured } from "@/lib/stripe/server";

export async function GET(request) {
  const sessionId = request.nextUrl.searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "Missing session id." }, { status: 400 });
  }
  const channel = channelFromParam(request.nextUrl.searchParams.get("pay"));
  if (channel.kind === "demo" ? !isDemoConfigured() : !isStripeConfigured()) {
    return NextResponse.json({ ok: false, error: "Not configured." }, { status: 503 });
  }

  try {
    const result = await fulfillCheckoutSession(sessionId, {
      source: "return",
      defer: after,
      channel,
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
