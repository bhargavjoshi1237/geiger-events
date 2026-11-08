import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { getSessionMember } from "@/lib/portal/session";
import { detectRoles } from "@/lib/control/detect";

// Whether this attendee is also on an event team — a hint only; Control itself needs a team sign-in.
export async function GET() {
  const member = await getSessionMember();
  if (!member) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  return NextResponse.json(await detectRoles(adminClient(), member), {
    headers: { "Cache-Control": "no-store" },
  });
}
