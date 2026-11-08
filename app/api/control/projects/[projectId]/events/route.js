import { controlBoundary } from "@/lib/control/boundary";
import { arrangeEvents } from "@/lib/control/events";
import { requireId, withControl } from "@/lib/control/http";
import { CONTROL_CAPABILITIES } from "@/lib/control/profile";
import { authorizeProjectAction } from "@/lib/operations/server/access";

export async function GET(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async ({ principal }) => {
    requireId(projectId);
    const boundary = await controlBoundary();
    await authorizeProjectAction(principal, projectId, CONTROL_CAPABILITIES.events, boundary);
    return { events: arrangeEvents(await boundary.listEvents(projectId), new Date()) };
  });
}
