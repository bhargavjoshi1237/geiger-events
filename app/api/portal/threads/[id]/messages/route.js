import { NextResponse } from "next/server";
import { getSessionMember } from "@/lib/portal/session";
import { postMessage } from "@/lib/portal/support";

// POST /api/portal/threads/<id>/messages { body } -> append a member message.
export async function POST(request, { params }) {
  const member = await getSessionMember();
  if (!member) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const { id } = await params;
  const { body } = await request.json().catch(() => ({}));
  if (!body || !String(body).trim()) {
    return NextResponse.json({ error: "Write a message first." }, { status: 400 });
  }
  const message = await postMessage({ memberId: member.id, threadId: id, body });
  if (!message) {
    return NextResponse.json({ error: "Couldn't send." }, { status: 500 });
  }
  return NextResponse.json({ message });
}
