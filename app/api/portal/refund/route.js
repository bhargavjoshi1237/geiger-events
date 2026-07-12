import { NextResponse } from "next/server";
import { getSessionMember } from "@/lib/portal/session";
import { fileRefund } from "@/lib/portal/refunds";

// POST { orderId, reason } -> files a refund request for the member's order.
export async function POST(request) {
  const member = await getSessionMember();
  if (!member) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const { orderId, reason } = await request.json().catch(() => ({}));
  const res = await fileRefund({
    email: member.email,
    name: member.name,
    orderId,
    reason,
  });
  if (res.error) {
    return NextResponse.json({ error: res.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
