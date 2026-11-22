import { mustPush, withPushManager } from "@/lib/push/server/manage";
import { getProjectSettings } from "@/lib/push/server/store";

// GET ?projectId= -> pg_cron job status, recent dispatcher runs and the pause switches.
export async function GET(request) {
  const projectId = new URL(request.url).searchParams.get("projectId");
  return withPushManager(request, projectId, async ({ push }) => {
    const [status, runs, settings] = await Promise.all([
      push.rpc("scheduler_status"),
      push.from("dispatch_runs").select("kind, started_at, ms, claimed, sent, failed, skipped, planned, error").order("started_at", { ascending: false }).limit(20),
      getProjectSettings(projectId),
    ]);
    const s = mustPush(status, "Couldn't read the scheduler status.") || {};
    return {
      configured: Boolean(s.configured),
      globalPaused: Boolean(s.globalPaused),
      paused: settings.paused,
      jobs: (s.jobs || []).map((j) => ({
        name: j.name,
        schedule: j.schedule,
        active: Boolean(j.active),
        lastRunAt: j.lastRunAt || null,
        lastStatus: j.lastStatus || null,
        lastMessage: j.lastMessage || null,
      })),
      runs: (mustPush(runs, "Couldn't load recent runs.") || []).map((r) => ({
        kind: r.kind,
        startedAt: r.started_at,
        ms: r.ms,
        claimed: r.claimed,
        sent: r.sent,
        failed: r.failed,
        skipped: r.skipped,
        planned: r.planned,
        error: r.error,
      })),
    };
  });
}
