import { controlBoundary } from "@/lib/control/boundary";
import { parseEventPatch } from "@/lib/control/event_fields";
import { arrangeEvents, toControlEvent } from "@/lib/control/events";
import { requireId, withControl } from "@/lib/control/http";
import { CONTROL_CAPABILITIES } from "@/lib/control/profile";
import { must, projectScope, readJson } from "@/lib/control/scope";
import { authorizeProjectAction } from "@/lib/staff_access/access";

export async function GET(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async ({ principal }) => {
    requireId(projectId);
    const boundary = await controlBoundary();
    await authorizeProjectAction(principal, projectId, CONTROL_CAPABILITIES.events, boundary);
    return { events: arrangeEvents(await boundary.listEvents(projectId), new Date()) };
  });
}

// New events start as a Draft, exactly like the dashboard's "New event".
export async function POST(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await projectScope(ctx, projectId, CONTROL_CAPABILITIES.edit);
    const { row } = parseEventPatch(await readJson(request), { create: true });
    const created = must(
      await scope.db
        .from("events")
        .insert({ type: "In-person", timezone: "Europe/London", visibility: "Public", ...row, status: "Draft", project_id: projectId, created_by: ctx.principal.id })
        .select("id,name,status,event_date,event_time,venue,city,timezone,capacity,sold,cover_url")
        .single(),
      "events.create",
    );
    return { event: toControlEvent(created, new Date()) };
  });
}
