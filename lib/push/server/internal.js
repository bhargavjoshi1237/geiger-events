import { safeEqual } from "@/lib/api_webhooks/crypto";

// Guard for /api/internal/push/*: pg_cron (via pg_net) sends `Authorization: Bearer <secret>`, where the secret is
// PUSH_CRON_SECRET (its own value, stored in events_push.runtime) or CRON_SECRET (Vercel Cron, manual runs).
export async function withCronSecret(request, work) {
  const secrets = [process.env.PUSH_CRON_SECRET, process.env.CRON_SECRET].filter(Boolean);
  if (!secrets.length) return Response.json({ ok: false, error: "PUSH_CRON_SECRET is not set." }, { status: 503 });
  const auth = request.headers.get("authorization") || "";
  if (!secrets.some((s) => safeEqual(auth, `Bearer ${s}`))) {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  const result = await work();
  return Response.json(result, { status: result?.ok === false ? 500 : 200, headers: { "Cache-Control": "no-store" } });
}
