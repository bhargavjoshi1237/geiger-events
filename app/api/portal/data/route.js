import { NextResponse } from "next/server";
import { getSessionMember } from "@/lib/portal/session";
import {
  listMemberOrders,
  listMemberMemberships,
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

  return NextResponse.json({
    orders: withRefund,
    memberships,
    tickets: ticketsFromOrders(withRefund),
  });
}
