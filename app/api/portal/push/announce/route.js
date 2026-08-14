import { NextResponse } from "next/server";
import { fanOutPendingAnnouncements } from "@/lib/portal/push_fanout";

// POST -> machine trigger for the announcement fan-out. Not member-authenticated;
// guarded by a shared secret so it is never open by default. GET aliases it for
// plain Vercel Cron schedules.
async function run(request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") || "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const result = await fanOutPendingAnnouncements();
  return NextResponse.json(result);
}

export const POST = run;
export const GET = run;
