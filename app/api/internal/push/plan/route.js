import { runPlan } from "@/lib/push/server/plan";
import { withCronSecret } from "@/lib/push/server/internal";

// Reminder planner, run by pg_cron (events_push.kick_plan) every 5 minutes.
export const maxDuration = 60;

async function handle(request) {
  return withCronSecret(request, () => runPlan());
}

export { handle as GET, handle as POST };
