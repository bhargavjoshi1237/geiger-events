import { controlBoundary } from "@/lib/control/boundary";
import { withControl } from "@/lib/control/http";
import { loadControlEvent } from "@/lib/control/profile";

// One event plus what this team member may do at it, with event-scoped grants resolved against it.
export async function GET(request, { params }) {
  const { eventId } = await params;
  return withControl(request, async ({ principal }) =>
    loadControlEvent({ principal, eventId, boundary: await controlBoundary() }),
  );
}
