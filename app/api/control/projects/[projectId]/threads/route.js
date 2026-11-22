import { withControl } from "@/lib/control/http";
import { CONTROL_CAPABILITIES } from "@/lib/control/profile";
import { listThreads } from "@/lib/control/queries";
import { projectScope } from "@/lib/control/scope";

// GET ?status=open|closed — buyer conversations, newest activity first.
export async function GET(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await projectScope(ctx, projectId, CONTROL_CAPABILITIES.inbox);
    const status = new URL(request.url).searchParams.get("status");
    return { threads: await listThreads(scope.db, projectId, { status: status === "open" || status === "closed" ? status : null }) };
  });
}
