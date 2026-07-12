import { NextResponse } from "next/server";
import { getSessionMember } from "@/lib/portal/session";
import {
  listMemberOrders,
  listMemberMemberships,
  ticketsFromOrders,
} from "@/lib/portal/reads";

export async function GET() {
  const member = await getSessionMember();
  if (!member) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const [orders, memberships] = await Promise.all([
    listMemberOrders(member.email),
    listMemberMemberships(member.email),
  ]);
  return NextResponse.json({
    orders,
    memberships,
    tickets: ticketsFromOrders(orders),
  });
}
