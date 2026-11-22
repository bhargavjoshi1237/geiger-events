import { toControlEvent } from "@/lib/control/events";
import { withControl } from "@/lib/control/http";
import { EVENT_COLUMNS, OPS_PERMISSIONS, ownedScope } from "@/lib/control/ops/scope";
import { eventFromTemplate } from "@/lib/control/ops/views";
import { must } from "@/lib/control/scope";

// POST — a Draft event from the template's blueprint, as the dashboard's "Use template" does, and the template's use count goes up.
export async function POST(request, { params }) {
  const { templateId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await ownedScope(ctx, {
      table: "event_templates",
      id: templateId,
      permission: OPS_PERMISSIONS.edit,
      notFound: "Template not found.",
    });
    const created = must(
      await scope.db
        .from("events")
        .insert(eventFromTemplate(scope.row, { projectId: scope.projectId, userId: ctx.principal.id }))
        .select(EVENT_COLUMNS)
        .single(),
      "templates.use",
    );
    const bumped = await scope.db.from("event_templates").update({ uses: Number(scope.row.uses ?? 0) + 1 }).eq("id", templateId);
    if (bumped.error) console.error("[control.templates.uses]", bumped.error.message);
    return { event: toControlEvent(created, new Date()) };
  });
}
