import { copyService } from "@/lib/workspace/server/copy_instance";
import { readJson } from "@/lib/workspace/server/http";
import { WORKSPACE_KEYS, workspaceContext, workspaceRoute } from "@/lib/workspace/server/route";
import { templateService } from "@/lib/workspace/templates/service";
import { processAfter } from "@/lib/workspace/process/after";

export const runtime = "nodejs";
export const maxDuration = 60;

// The project's saved templates and the built-in ones (with what each contains).
export const GET = workspaceRoute(async (request, { eventId }) => {
  const context = await workspaceContext(request, eventId, WORKSPACE_KEYS.view);
  return { templates: await copyService.templates(context), builtins: templateService.builtins() };
});

// Saves this workspace (lists, fields, shared views, stage rules, automations, review, documents, portal draft; no records)
// as a template for the project, or installs a built-in template ({ action: "install", key }).
export const POST = workspaceRoute(async (request, { eventId }) => {
  const body = await readJson(request);
  const context = await workspaceContext(request, eventId, WORKSPACE_KEYS.configure);
  if (body.action === "install") {
    const result = await templateService.install(context, body.key);
    processAfter(context);
    return result;
  }
  return { template: await copyService.saveTemplate(context, body) };
});

export const DELETE = workspaceRoute(async (request, { eventId }) => {
  const context = await workspaceContext(request, eventId, WORKSPACE_KEYS.configure);
  return copyService.deleteTemplate(context, new URL(request.url).searchParams.get("id"));
});
