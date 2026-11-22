import { withControl } from "@/lib/control/http";
import { OPS_PERMISSIONS } from "@/lib/control/ops/scope";
import { projectSummary } from "@/lib/control/ops/summary";
import { must, projectScope } from "@/lib/control/scope";
import { selectAll } from "@/lib/supabase/select_all";

// GET — the cross-event picture: totals, the last 30 days of sales, and the events selling best.
export async function GET(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await projectScope(ctx, projectId, OPS_PERMISSIONS.analytics);
    const [events, orders, attendance] = await Promise.all([
      selectAll(() => scope.db.from("events").select("id,name,status,event_date,capacity").eq("project_id", projectId).is("deleted_at", null).order("id")),
      selectAll(() =>
        scope.db
          .from("event_orders")
          .select("id,event_id,created_at,total,refunded_total,quantity,ticket_name,cancelled_at")
          .eq("project_id", projectId)
          .order("id"),
      ),
      selectAll(() =>
        scope.db
          .from("checkin_attendance")
          .select("id,event_id,registration_id,order_id")
          .eq("project_id", projectId)
          .eq("status", "in")
          .is("session_id", null)
          .is("deleted_at", null)
          .order("id"),
      ),
    ]);
    return projectSummary({
      events: must(events, "analytics.events"),
      orders: must(orders, "analytics.orders"),
      attendance: must(attendance, "analytics.attendance"),
    });
  });
}
