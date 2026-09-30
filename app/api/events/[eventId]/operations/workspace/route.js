import { OperationsError } from "@/lib/operations/errors";
import { authorizeEventAction } from "@/lib/operations/server/access";
import { handleOperationsRequest, readOperationsJson } from "@/lib/operations/server/commands";
import { resolveStaffPrincipal } from "@/lib/operations/server/staff_identity";
import {
  archiveModule, publishWorkspace, readWorkspace, saveWorkspaceDraft,
} from "@/lib/operations/workspaces/service";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function withWorkspace(request, params, permission, work) {
  return handleOperationsRequest(async () => {
    const { eventId } = await params;
    if (!uuid.test(eventId ?? "")) throw new OperationsError("invalid_event", 400, "Invalid event ID.");
    const principal = await resolveStaffPrincipal(request);
    const context = await authorizeEventAction(principal, eventId, permission);
    return work(context);
  });
}

export async function GET(request, { params }) {
  return withWorkspace(request, params, "events.operations.view", (context) => readWorkspace(context));
}

export async function PUT(request, { params }) {
  return withWorkspace(request, params, "events.operations.configure", async (context) =>
    saveWorkspaceDraft(context, await readOperationsJson(request)));
}

export async function POST(request, { params }) {
  return withWorkspace(request, params, "events.operations.configure", async (context) =>
    publishWorkspace(context, await readOperationsJson(request)));
}

export async function PATCH(request, { params }) {
  return withWorkspace(request, params, "events.operations.configure", async (context) =>
    archiveModule(context, await readOperationsJson(request)));
}
