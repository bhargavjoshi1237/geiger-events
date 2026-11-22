import { arrangeEvents } from "@/lib/control/events";
import { withControl } from "@/lib/control/http";
import { CONTROL_CAPABILITIES } from "@/lib/control/profile";
import { allOrderRows, countRows } from "@/lib/control/queries";
import { projectScope } from "@/lib/control/scope";
import { projectTotals } from "@/lib/control/stats";
import { authorizeProjectAction } from "@/lib/staff_access/access";

const WEEK = 7 * 86400000;

// The Today tab: what's on, what sold, and what needs a decision. Figures a role can't see come back null.
export async function GET(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await projectScope(ctx, projectId, CONTROL_CAPABILITIES.events);
    const now = new Date();
    const may = async (key) =>
      authorizeProjectAction(ctx.principal, projectId, key, scope.boundary).then(
        () => true,
        () => false,
      );
    const [canOrders, canInbox, canAnalytics, canGuests] = await Promise.all([
      may(CONTROL_CAPABILITIES.orders),
      may(CONTROL_CAPABILITIES.inbox),
      may(CONTROL_CAPABILITIES.analytics),
      may(CONTROL_CAPABILITIES.guests),
    ]);

    const [events, sales, pending, unread] = await Promise.all([
      scope.boundary.listEvents(projectId, now),
      canOrders || canAnalytics
        ? allOrderRows(scope.db, { projectId, since: new Date(now.getTime() - WEEK).toISOString() })
        : null,
      canGuests
        ? countRows(scope.db, "registrations", (q) => q.eq("project_id", projectId).eq("status", "Pending").is("deleted_at", null))
        : null,
      canInbox ? countRows(scope.db, "portal_threads", (q) => q.eq("project_id", projectId).eq("organiser_unread", true)) : null,
    ]);
    const arranged = arrangeEvents(events, now);
    return {
      today: arranged.filter((e) => e.when === "today"),
      upcoming: arranged.filter((e) => e.when === "upcoming").slice(0, 5),
      drafts: arranged.filter((e) => e.status === "Draft").length,
      sales: sales ? projectTotals(sales, now) : null,
      pendingApprovals: pending,
      unreadThreads: unread,
    };
  });
}
