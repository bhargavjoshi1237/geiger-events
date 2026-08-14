import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { getSessionMember } from "@/lib/portal/session";
import { registerDevice, unregisterDevice } from "@/lib/portal/push";

// POST { pushToken, platform, appVersion } -> registers the device for pushes.
export async function POST(request) {
  const member = await getSessionMember();
  if (!member) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const sb = adminClient();
  if (!sb) return NextResponse.json({ error: "Unavailable." }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  const ok = await registerDevice({
    memberId: member.id,
    pushToken: body.pushToken,
    platform: body.platform,
    appVersion: body.appVersion,
  });
  if (!ok) {
    return NextResponse.json({ error: "Invalid token." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

// DELETE { pushToken } -> stops the device receiving the member's pushes. The app
// calls this on sign-out so a shared handset doesn't keep the previous owner's.
export async function DELETE(request) {
  const member = await getSessionMember();
  if (!member) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const sb = adminClient();
  if (!sb) return NextResponse.json({ error: "Unavailable." }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  await unregisterDevice(body.pushToken);
  return NextResponse.json({ ok: true });
}
