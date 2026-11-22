import { withControl } from "@/lib/control/http";
import { CONTROL_CAPABILITIES } from "@/lib/control/profile";
import { listOrderPage } from "@/lib/control/queries";
import { eventScope } from "@/lib/control/scope";

// GET ?status=all|paid|refunded|cancelled&q=&before=<created_at>
export async function GET(request, { params }) {
  const { eventId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await eventScope(ctx, eventId, CONTROL_CAPABILITIES.orders);
    const query = new URL(request.url).searchParams;
    return listOrderPage(scope.db, {
      eventId,
      filter: query.get("status"),
      q: query.get("q"),
      before: query.get("before"),
    });
  });
}
