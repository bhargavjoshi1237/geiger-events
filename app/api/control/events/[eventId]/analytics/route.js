import { withControl } from "@/lib/control/http";
import { CONTROL_CAPABILITIES } from "@/lib/control/profile";
import { allOrderRows, loadDoorCounts } from "@/lib/control/queries";
import { eventScope } from "@/lib/control/scope";
import { salesByDay, salesByTicket, totals } from "@/lib/control/stats";

// GET — sales over the last 14 days, by ticket, and the door's check-in rate.
export async function GET(request, { params }) {
  const { eventId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await eventScope(ctx, eventId, CONTROL_CAPABILITIES.analytics);
    const [rows, attendance] = await Promise.all([allOrderRows(scope.db, { eventId }), loadDoorCounts(scope.db, eventId)]);
    const refunded = rows.reduce((sum, r) => sum + (r.cancelled_at ? 0 : Number(r.refunded_total ?? 0)), 0);
    return {
      totals: { ...totals(rows), refunded: Math.round(refunded * 100) / 100 },
      byDay: salesByDay(rows, new Date(), 14),
      byTicket: salesByTicket(rows),
      attendance,
    };
  });
}
