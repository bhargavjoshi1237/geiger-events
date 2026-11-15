import { readJson } from "@/lib/workspace/server/http";
import { importRows } from "@/lib/workspace/server/import";
import { WORKSPACE_KEYS, workspaceContext, workspaceRoute } from "@/lib/workspace/server/route";
import { processAfter } from "@/lib/workspace/process/after";

export const runtime = "nodejs";
export const maxDuration = 60;

// One batch (≤ 500 rows) of a CSV import: { objectId, mapping: [{ column, fieldId }], rows: string[][] }.
export const POST = workspaceRoute(async (request, { eventId }) => {
  const body = await readJson(request);
  const context = await workspaceContext(request, eventId, WORKSPACE_KEYS.create);
  const result = await importRows(context, body);
  processAfter(context);
  return result;
});
