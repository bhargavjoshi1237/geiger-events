import { runDispatch } from "@/lib/push/server/dispatch";
import { withCronSecret } from "@/lib/push/server/internal";

// Member push sender, woken by pg_cron (events_push.kick) every 30 s whenever rows are due.
export const maxDuration = 60;

async function handle(request) {
  // Budget well under maxDuration so a batch never gets killed between sending and recording.
  return withCronSecret(request, () => runDispatch({ budgetMs: 20_000 }));
}

export { handle as GET, handle as POST };
