import { withControl } from "@/lib/control/http";
import { CONTROL_CAPABILITIES } from "@/lib/control/profile";
import { listOrderPage } from "@/lib/control/queries";
import { projectScope } from "@/lib/control/scope";

// GET ?status=all|paid|refunded|cancelled&q=&before=<created_at>
export async function GET(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await projectScope(ctx, projectId, CONTROL_CAPABILITIES.orders);
    const query = new URL(request.url).searchParams;
    return listOrderPage(scope.db, {
      projectId,
      filter: query.get("status"),
      q: query.get("q"),
      before: query.get("before"),
    });
  });
}
