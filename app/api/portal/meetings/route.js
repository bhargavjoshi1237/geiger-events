import { NextResponse } from "next/server";

import { listMeetingEvents } from "@/lib/portal/meetings";
import { withMember } from "@/lib/portal/meetings_http";

// Events the signed-in member holds a ticket for that have networking switched on.
export async function GET() {
  return withMember(async (member) => NextResponse.json({ events: await listMeetingEvents(member) }));
}
