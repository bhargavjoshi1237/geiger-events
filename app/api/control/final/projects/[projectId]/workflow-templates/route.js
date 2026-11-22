import { randomUUID } from "node:crypto";

import { templateView, workflowFromTemplate, WORKFLOW_TEMPLATES } from "@/lib/control/final/workflow_templates";
import { withControl } from "@/lib/control/http";
import { must, projectScope, readJson } from "@/lib/control/scope";
import { ApiError } from "@/lib/staff_access/errors";

const PERMISSION = "events.workflows.view";

export async function GET(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    await projectScope(ctx, projectId, PERMISSION);
    return { templates: WORKFLOW_TEMPLATES.map(templateView) };
  });
}

// POST { templateId } — creates a Draft workflow from the template, exactly as the dashboard's "Use template" does.
export async function POST(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const { templateId } = await readJson(request);
    const template = WORKFLOW_TEMPLATES.find((t) => t.id === templateId);
    if (!template) throw new ApiError("not_found", 404, "That template doesn't exist.");
    const scope = await projectScope(ctx, projectId, PERMISSION);
    const row = workflowFromTemplate(template, { projectId, userId: ctx.principal.id, newId: randomUUID });
    const created = must(await scope.db.from("workflows").insert(row).select("id,name,status").single(), "workflowTemplates.use");
    return { workflow: created };
  });
}
