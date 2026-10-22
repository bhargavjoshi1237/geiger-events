import { NextResponse } from "next/server";

import { adminClient } from "@/lib/supabase/admin";
import { sendTicketConfirmation } from "@/lib/stripe/fulfill-checkout";

// The ticket email's state for the post-payment screen, plus a buyer-triggered resend.
// The Stripe session id from the return URL is the bearer secret, as it is for /api/checkout/verify.

const RESEND_GAP_MS = 60_000;
const MAX_ATTEMPTS = 5;
// A brand-new order with no record yet is still mid-send; past this it never recorded one.
const IN_FLIGHT_MS = 2 * 60_000;

async function orderFor(sessionId) {
  const sb = adminClient();
  if (!sb || !sessionId) return null;
  const { data, error } = await sb
    .from("event_orders")
    .select("id, event_id, buyer_name, buyer_email, ticket_name, quantity, total, metadata, created_at")
    .eq("stripe_session_id", sessionId)
    .maybeSingle();
  if (error) {
    console.error("[checkout.email]", error.message);
    return null;
  }
  return data;
}

function view(order) {
  const sent = order?.metadata?.ticketEmail;
  return {
    status: sent?.status || "pending",
    to: sent?.to || order?.buyer_email || "",
    at: sent?.at || null,
  };
}

export async function GET(request) {
  const order = await orderFor(request.nextUrl.searchParams.get("session_id"));
  return NextResponse.json(view(order));
}

export async function POST(request) {
  const order = await orderFor(request.nextUrl.searchParams.get("session_id"));
  if (!order) return NextResponse.json({ error: "We couldn't find that order." }, { status: 404 });

  const last = order.metadata?.ticketEmail;
  const since = (iso) => Date.now() - new Date(iso).getTime();
  if (!order.buyer_email) {
    return NextResponse.json({ error: "This order has no email address." }, { status: 409 });
  }
  if (last?.status === "off") {
    return NextResponse.json({ error: "This event doesn't send ticket emails." }, { status: 409 });
  }
  if (!last && since(order.created_at) < IN_FLIGHT_MS) {
    return NextResponse.json({ error: "Your tickets are still being sent — give it a moment." }, { status: 409 });
  }
  if (last?.at && since(last.at) < RESEND_GAP_MS) {
    return NextResponse.json({ error: "Just sent — give it a minute before trying again." }, { status: 429 });
  }
  if ((Number(last?.attempts) || 0) >= MAX_ATTEMPTS) {
    return NextResponse.json(
      { error: "We've tried several times — contact the organiser with your order number." },
      { status: 429 },
    );
  }

  const result = await sendTicketConfirmation({
    orderId: order.id,
    eventId: order.event_id,
    to: order.buyer_email,
    name: order.buyer_name,
    ticketName: order.ticket_name,
    quantity: order.quantity,
    total: order.total,
    // Orders from before the email was recorded have no stored link; rebuild the public page the buyer is on.
    eventUrl:
      last?.eventUrl ||
      `${request.headers.get("origin") || request.nextUrl.origin}${process.env.NEXT_PUBLIC_BASE_PATH || ""}/e/${order.event_id}`,
  });
  return NextResponse.json({
    status: result.ok ? "sent" : result.skipped ? "off" : "failed",
    to: order.buyer_email,
    at: new Date().toISOString(),
  });
}
