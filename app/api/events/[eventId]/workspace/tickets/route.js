import { readJson } from "@/lib/workspace/server/http";
import { WORKSPACE_KEYS, workspaceContext, workspaceRoute } from "@/lib/workspace/server/route";
import { WorkspaceError } from "@/lib/workspace/errors";
import { matchTicketsByEmail } from "@/lib/workspace/components/tickets";
import { commandSender } from "@/lib/workspace/server/send";
import { workspaceStore } from "@/lib/workspace/server/store";
import { processAfter } from "@/lib/workspace/process/after";

export const runtime = "nodejs";
export const maxDuration = 60;

// "Match tickets by email": links each person on a list to the registration with the same email.
export const POST = workspaceRoute(async (request, { eventId }) => {
  const body = await readJson(request);
  if (body.action !== "match_email") throw new WorkspaceError("invalid_input", 400, "Unknown action.");
  const context = await workspaceContext(request, eventId, WORKSPACE_KEYS.update);
  const result = await matchTicketsByEmail(context, body, { send: commandSender(workspaceStore) });
  processAfter(context);
  return result;
});
