import { after } from "next/server";
import { readJson } from "@/lib/workspace/server/http";
import { WORKSPACE_KEYS, workspaceContext, workspaceRoute } from "@/lib/workspace/server/route";
import { permissionFor, workspaceService } from "@/lib/workspace/server/service";
import { processAfter } from "@/lib/workspace/process/after";

export const runtime = "nodejs";
export const maxDuration = 60;

const RECORD_ACTIONS = new Set(["record.create", "record.update", "records.bulk", "records.restore", "change.undo"]);
const ALSO = [WORKSPACE_KEYS.configure, WORKSPACE_KEYS.create, WORKSPACE_KEYS.update, WORKSPACE_KEYS.delete];

// The workspace definition plus what the signed-in person may do.
export const GET = workspaceRoute(async (request, { eventId }) => {
  const context = await workspaceContext(request, eventId, WORKSPACE_KEYS.view, { also: ALSO });
  const definition = await workspaceService.getDefinition(context);
  const can = context.allowed;
  return {
    ...definition,
    can: {
      configure: can[WORKSPACE_KEYS.configure], create: can[WORKSPACE_KEYS.create],
      update: can[WORKSPACE_KEYS.update], delete: can[WORKSPACE_KEYS.delete],
    },
  };
});

// One organiser action (structure, records, views, comments, undo).
export const POST = workspaceRoute(async (request, { eventId }) => {
  const body = await readJson(request);
  const context = await workspaceContext(request, eventId, permissionFor(body), { also: [WORKSPACE_KEYS.configure] });
  const { result, after: followUps = [] } = await workspaceService.runCommand(context, body);
  if (RECORD_ACTIONS.has(body.action)) processAfter(context);
  if (followUps.length) {
    after(async () => {
      for (const task of followUps) {
        try { await task(); } catch (error) { console.error("[workspace] follow-up failed", error); }
      }
    });
  }
  return result;
});
