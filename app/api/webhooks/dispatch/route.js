import { safeEqual } from "@/lib/api_webhooks/crypto";
import { dispatchWebhooks, runWebhookHousekeeping } from "@/lib/api_webhooks/server/dispatch";

// Webhook dispatcher, run daily by Vercel Cron (vercel.json; Hobby allows no more often). Vercel sends `Authorization: Bearer $CRON_SECRET`.
export const maxDuration = 60;

const BATCH = 25;
const BUDGET_MS = 35_000;

async function handle(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ ok: false, error: "CRON_SECRET is not set." }, { status: 503 });
  }
  if (!safeEqual(request.headers.get("authorization") || "", `Bearer ${secret}`)) {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const started = Date.now();
  const totals = { claimed: 0, succeeded: 0, failed: 0, dead: 0 };
  // Keep draining full batches while there's time left in this invocation.
  while (Date.now() - started < BUDGET_MS) {
    const batch = await dispatchWebhooks({ limit: BATCH });
    if (!batch.ok) {
      return Response.json({ ok: false, error: batch.error, ...totals }, { status: 500 });
    }
    totals.claimed += batch.claimed;
    for (const result of batch.results) totals[result.outcome] = (totals[result.outcome] || 0) + 1;
    if (batch.claimed < BATCH) break;
  }

  const housekeeping = await runWebhookHousekeeping();
  return Response.json(
    { ok: true, ...totals, ms: Date.now() - started, housekeeping },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export { handle as GET, handle as POST };
