import { withControl } from "@/lib/control/http";
import { CONTROL_CAPABILITIES } from "@/lib/control/profile";
import { parseMessage } from "@/lib/control/records";
import { eventScope, must, readJson } from "@/lib/control/scope";
import { selectAll } from "@/lib/supabase/select_all";
import { ApiError } from "@/lib/staff_access/errors";

// POST { subject?, body } — a message to everyone holding a live ticket or confirmed place, as a thread in their app inbox.
export async function POST(request, { params }) {
  const { eventId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await eventScope(ctx, eventId, CONTROL_CAPABILITIES.inbox);
    const input = await readJson(request);
    const body = parseMessage(input);
    const subject = String(input.subject ?? "").trim().slice(0, 160);

    const [orders, registrations] = await Promise.all([
      selectAll(() => scope.db.from("event_orders").select("id,buyer_email").eq("event_id", eventId).is("cancelled_at", null).order("id")),
      selectAll(() =>
        scope.db
          .from("registrations")
          .select("id,email")
          .eq("event_id", eventId)
          .is("deleted_at", null)
          .in("status", ["Confirmed", "Checked-in"])
          .order("id"),
      ),
    ]);
    const emails = new Set();
    for (const r of must(orders, "announce.orders")) if (r.buyer_email) emails.add(r.buyer_email.trim().toLowerCase());
    for (const r of must(registrations, "announce.guests")) if (r.email) emails.add(r.email.trim().toLowerCase());
    if (!emails.size) throw new ApiError("no_audience", 409, "Nobody holds a ticket for this event yet.");

    const reached = must(
      await scope.db.rpc("broadcast_message", {
        p_project_id: scope.projectId,
        p_emails: [...emails],
        p_subject: subject,
        p_body: body,
        p_event_id: eventId,
      }),
      "announce.send",
    );
    return { audience: emails.size, reached: Number(reached) || 0 };
  });
}
