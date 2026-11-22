import { REGISTRATIONS } from "@/lib/control/guests/access";
import { dietaryReport } from "@/lib/control/guests/views";
import { withControl } from "@/lib/control/http";
import { eventScope, must } from "@/lib/control/scope";
import { selectAll } from "@/lib/supabase/select_all";

// GET — the event's catering and access needs: totals, common dietary tags, inquiry answers and who needs what.
export async function GET(request, { params }) {
  const { eventId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await eventScope(ctx, eventId, REGISTRATIONS);
    const [registrations, config] = await Promise.all([
      selectAll(() =>
        scope.db.from("registrations").select("id,name,email,status,party_size,dietary,accessibility,answers").eq("event_id", eventId).is("deleted_at", null).order("id"),
      ),
      scope.db.from("dietary_config").select("questions").eq("project_id", scope.projectId).maybeSingle(),
    ]);
    return dietaryReport(must(registrations, "dietary.registrations"), must(config, "dietary.config")?.questions || []);
  });
}
