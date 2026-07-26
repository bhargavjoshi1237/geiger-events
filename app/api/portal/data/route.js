import { NextResponse } from "next/server";
import { getSessionMember } from "@/lib/portal/session";
import {
  listMemberOrders,
  listMemberMemberships,
  listMemberEntitlements,
  ticketsFromOrders,
} from "@/lib/portal/reads";
import { listMemberRefunds } from "@/lib/portal/refunds";

export async function GET() {
  const member = await getSessionMember();
  if (!member) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const [orders, memberships, refunds] = await Promise.all([
    listMemberOrders(member.email),
    listMemberMemberships(member.email),
    listMemberRefunds(member.email),
  ]);

  // Fold the member's latest refund status onto each order it belongs to.
  const withRefund = orders.map((o) => ({ ...o, refund: refunds[o.id] || null }));

  // Entitlements are looked up per order, so this runs after the orders are
  // known and only over orders that are already scoped to this member.
  const entitlements = await listMemberEntitlements(withRefund);

  return NextResponse.json({
    orders: withRefund,
    memberships,
    entitlements,
    tickets: ticketsFromOrders(withRefund).map((t) => ({
      ...t,
      entitlements: entitlements[t.id] || [],
    })),
  });
}
