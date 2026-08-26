import { NextResponse } from "next/server";
import { getSessionMember } from "@/lib/portal/session";
import { listBuyableMembershipPlans } from "@/lib/portal/memberships";
import { isStripeConfigured } from "@/lib/stripe/server";

export async function GET() {
  const member = await getSessionMember();
  if (!member) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const plans = await listBuyableMembershipPlans(member.email);
  return NextResponse.json({ plans, paymentsEnabled: isStripeConfigured() });
}
