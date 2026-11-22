import { runDispatch } from "./dispatch.js";

// Sends what server code just enqueued without waiting for the next pg_cron tick. Call inside after(); never throws.
export async function kickDispatch() {
  try {
    await runDispatch({ budgetMs: 8_000, limit: 50 });
  } catch (e) {
    console.error("[push.kick]", e);
  }
}
