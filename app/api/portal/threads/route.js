import { NextResponse } from "next/server";
import { getSessionMember } from "@/lib/portal/session";
import { listMemberThreads, createThread } from "@/lib/portal/support";

// GET -> { threads } for the signed-in member.
export async function GET() {
  const member = await getSessionMember();
  if (!member) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const threads = await listMemberThreads(member.id);
  return NextResponse.json({ threads });
}

// POST { subject, body, orderId? } -> opens a new thread with the organiser.
export async function POST(request) {
  const member = await getSessionMember();
  if (!member) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const { subject, body, orderId } = await request.json().catch(() => ({}));
  if (!body || !String(body).trim()) {
    return NextResponse.json({ error: "Write a message first." }, { status: 400 });
  }
  const thread = await createThread({
    memberId: member.id,
    email: member.email,
    subject,
    body,
    orderId: orderId || null,
  });
  if (!thread) {
    return NextResponse.json({ error: "Couldn't open the thread." }, { status: 500 });
  }
  return NextResponse.json({ thread });
}
