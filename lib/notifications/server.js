import { createServerNotifier } from "@geiger/notify/server";
import { adminClient } from "@/lib/supabase/admin";
import { getEvent } from "@/lib/supabase/events";
import { EVENTS_NOTIFICATION_TYPES } from "./types";

// Org roles that hear about sales and approvals for their events.
const MANAGER_ROLES = ["Owner", "Admin", "Manager"];

// Service role: checkout runs without a staff session. Server-only.
async function notifyEventManagers(type, { event, eventId, ...data }) {
  try {
    const admin = adminClient();
    if (!admin) return null;
    const ev = event || (eventId ? await getEvent(eventId) : null);
    if (!ev?.projectId) return null;
    const { data: project, error } = await admin
      .schema("public")
      .from("projects")
      .select("organization_id")
      .eq("id", ev.projectId)
      .maybeSingle();
    if (error || !project?.organization_id) return null;
    const notifier = createServerNotifier({ supabase: admin, app: "events", types: EVENTS_NOTIFICATION_TYPES });
    return await notifier.notifyOrganization(project.organization_id, type, {
      roles: MANAGER_ROLES,
      organizationId: project.organization_id,
      projectId: ev.projectId,
      data: { eventId: ev.id, eventName: ev.name, projectId: ev.projectId, ...data },
    });
  } catch (error) {
    console.error(`[notifications.events] ${type}`, error);
    return null;
  }
}

export function notifyTicketSold({ event, eventId, orderId, buyerName, quantity, ticketName }) {
  return notifyEventManagers("ticket.sold", { event, eventId, orderId, buyerName, quantity, ticketName });
}

export function notifyRegistrationPending({ event, eventId, registrationId, name }) {
  return notifyEventManagers("registration.pending", { event, eventId, registrationId, name });
}
