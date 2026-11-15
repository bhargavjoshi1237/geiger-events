import { after } from "next/server";
import { WorkspaceError } from "@/lib/workspace/errors";
import { copyService } from "@/lib/workspace/server/copy_instance";
import { readJson } from "@/lib/workspace/server/http";
import { requireUuid, WORKSPACE_KEYS, workspaceContext, workspaceRoute } from "@/lib/workspace/server/route";

export const runtime = "nodejs";
export const maxDuration = 60;

// ?sources=1 lists events to copy from; ?event=<id> returns that event's lists; ?job=<id> advances and reports a copy.
export const GET = workspaceRoute(async (request, { eventId }) => {
  const params = new URL(request.url).searchParams;
  if (params.get("sources") === "1") {
    const context = await workspaceContext(request, eventId, WORKSPACE_KEYS.configure);
    return { events: await copyService.sources(context) };
  }
  if (params.get("event")) {
    const context = await workspaceContext(request, eventId, WORKSPACE_KEYS.configure);
    const source = await workspaceContext(request, requireUuid(params.get("event")), WORKSPACE_KEYS.view);
    if (source.projectId !== context.projectId) throw new WorkspaceError("not_found", 404, "Event not found.");
    const definition = await copyService.sourceDefinition(source);
    return {
      objects: definition.objects.filter((object) => !object.deletedAt),
      fields: definition.fields.filter((field) => !field.deletedAt),
      views: definition.views,
    };
  }
  const context = await workspaceContext(request, eventId, WORKSPACE_KEYS.configure);
  return { job: await copyService.advance(context, requireUuid(params.get("job"), "Choose a copy.")) };
});

// { mode: "plan" | "start", sourceEventId? , templateId?, choices }.
export const POST = workspaceRoute(async (request, { eventId }) => {
  const body = await readJson(request);
  const context = await workspaceContext(request, eventId, WORKSPACE_KEYS.configure);
  let sourceContext = null;
  if (body.sourceEventId) {
    const source = await workspaceContext(request, requireUuid(body.sourceEventId), WORKSPACE_KEYS.view);
    if (source.eventId === context.eventId) throw new WorkspaceError("invalid_input", 422, "Choose a different event to copy from.");
    if (source.projectId !== context.projectId) throw new WorkspaceError("not_found", 404, "Event not found.");
    sourceContext = { ...context, eventId: source.eventId };
  } else if (!body.templateId) {
    throw new WorkspaceError("invalid_input", 422, "Choose an event or a template to copy from.");
  }
  const input = { sourceContext, templateId: body.templateId, choices: body.choices ?? {} };
  if (body.mode === "plan") return copyService.plan(context, input);
  const started = await copyService.start(context, input);
  if (started.job?.status === "running") {
    after(() => copyService.advance(context, started.job.id, { budgetMs: 45_000 }).catch(() => {}));
  }
  return started;
});
