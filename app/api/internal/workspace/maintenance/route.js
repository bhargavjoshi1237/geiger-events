import { safeEqual } from "@/lib/api_webhooks/crypto";
import { copyService } from "@/lib/workspace/server/copy_instance";
import { workspaceStore } from "@/lib/workspace/server/store";
import { automationEngine } from "@/lib/workspace/process/engine";
import { processStore } from "@/lib/workspace/process/store";

// Daily Workspace upkeep (vercel.json; Hobby allows daily): empties trash older than 30 days, resumes stalled copies,
// runs due automations and trims the run log.
export const runtime = "nodejs";
export const maxDuration = 60;

const DAY = 86_400_000;

async function handle(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ ok: false, error: "CRON_SECRET is not set." }, { status: 503 });
  if (!safeEqual(request.headers.get("authorization") || "", `Bearer ${secret}`)) {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  const purged = await workspaceStore.purge(new Date(Date.now() - 30 * DAY).toISOString());
  let removedFiles = 0;
  try {
    await workspaceStore.removeFiles(purged.paths ?? []);
    removedFiles = purged.paths?.length ?? 0;
  } catch (error) {
    console.error("[workspace] file cleanup failed", error);
  }
  const stalled = await workspaceStore.stalledJobs(new Date(Date.now() - 10 * 60_000).toISOString());
  let resumed = 0;
  for (const job of stalled) {
    const context = { projectId: job.project_id, eventId: job.event_id, principal: { kind: "staff", id: job.created_by } };
    try {
      await copyService.advance(context, job.id, { budgetMs: 8_000 });
      resumed++;
    } catch (error) {
      console.error("[workspace] copy resume failed", job.id, error);
    }
  }
  let automations = null;
  try {
    automations = await automationEngine.process({ budgetMs: 25_000 });
    await processStore.housekeeping();
  } catch (error) {
    console.error("[workspace] automations failed", error);
  }
  return Response.json({ ok: true, purgedRecords: purged.records ?? 0, removedFiles, resumed, automations }, { headers: { "Cache-Control": "no-store" } });
}

export { handle as GET, handle as POST };
