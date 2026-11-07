import { NextResponse } from "next/server";

import { safeEqual } from "@/lib/api_webhooks/crypto";
import { deliverBoardEmails } from "@/lib/portal/boards";

// Cron safety net for queued board reply emails (Bearer CRON_SECRET), mirroring the announcement push fan-out.
async function run(request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") || "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const result = await deliverBoardEmails({ origin: new URL(request.url).origin, limit: 100 });
  return NextResponse.json(result);
}

export const POST = run;
export const GET = run;
