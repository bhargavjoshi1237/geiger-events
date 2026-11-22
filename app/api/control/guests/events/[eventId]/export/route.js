import { GUESTS } from "@/lib/control/guests/access";
import { attendeeCsv, exportFilename } from "@/lib/control/guests/views";
import { withControl } from "@/lib/control/http";
import { eventScope, must } from "@/lib/control/scope";
import { selectAll } from "@/lib/supabase/select_all";

// GET — the event's attendee list as CSV text, enriched from the Contact Book by email like the dashboard's export.
export async function GET(request, { params }) {
  const { eventId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await eventScope(ctx, eventId, GUESTS);
    const [event, registrations, contacts] = await Promise.all([
      scope.db.from("events").select("name").eq("id", eventId).maybeSingle(),
      selectAll(() =>
        scope.db
          .from("registrations")
          .select("id,name,email,phone,status,party_size,dietary,accessibility,created_at")
          .eq("event_id", eventId)
          .is("deleted_at", null)
          .order("created_at")
          .order("id"),
      ),
      selectAll(() =>
        scope.db.from("contacts").select("email,name,phone,company,tags").eq("project_id", scope.projectId).is("deleted_at", null).order("id"),
      ),
    ]);
    const byEmail = new Map(must(contacts, "export.contacts").map((c) => [String(c.email || "").toLowerCase(), c]));
    const rows = must(registrations, "export.registrations")
      .filter((r) => r.email)
      .map((r) => {
        const contact = byEmail.get(String(r.email).toLowerCase());
        return { ...r, name: contact?.name || r.name, phone: contact?.phone || r.phone, company: contact?.company || "", tags: contact?.tags || [] };
      });
    return { filename: exportFilename(must(event, "export.event")?.name), csv: attendeeCsv(rows), count: rows.length };
  });
}
