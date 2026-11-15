import { safeEqual } from "@/lib/api_webhooks/crypto";
import { automationEngine } from "@/lib/workspace/process/engine";

// Due automations for every event (schedules, waits, retries). Call it from any scheduler with the CRON_SECRET bearer.
export const runtime = "nodejs";
export const maxDuration = 60;

async function handle(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ ok: false, error: "CRON_SECRET is not set." }, { status: 503 });
  if (!safeEqual(request.headers.get("authorization") || "", `Bearer ${secret}`)) {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  const result = await automationEngine.process({ budgetMs: 45_000 });
  return Response.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
}

export { handle as GET, handle as POST };
