import { GUESTS } from "@/lib/control/guests/access";
import { segmentView } from "@/lib/control/guests/views";
import { withControl } from "@/lib/control/http";
import { must, projectScope } from "@/lib/control/scope";
import { listGuests, normalizeContact } from "@/lib/supabase/contacts";
import { isSegmentMember, normalizeSegment } from "@/lib/supabase/segments";
import { selectAll } from "@/lib/supabase/select_all";

// GET — segments with live member counts, worked out exactly as the dashboard's Segments screen does.
export async function GET(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await projectScope(ctx, projectId, GUESTS);
    const [segments, contacts, guests] = await Promise.all([
      scope.db.from("contact_segments").select("*").eq("project_id", projectId).is("deleted_at", null).order("created_at", { ascending: false }),
      selectAll(() => scope.db.from("contacts").select("*").eq("project_id", projectId).is("deleted_at", null).order("id")),
      listGuests(projectId, { client: scope.db }),
    ]);
    const people = must(contacts, "segments.contacts").map(normalizeContact);
    // Attendance rules match on who's registered, by email.
    const attendingEmails = new Set();
    const eventsByEmail = new Map();
    for (const g of guests || []) {
      const key = String(g.email || "").toLowerCase();
      if (!key) continue;
      attendingEmails.add(key);
      eventsByEmail.set(key, g.eventIds || []);
    }
    const ctxForRules = { attendingEmails, eventsByEmail };
    return {
      segments: must(segments, "segments.list").map((row) => {
        const segment = normalizeSegment(row);
        return segmentView(row, people.filter((c) => isSegmentMember(segment, c, ctxForRules)).length);
      }),
    };
  });
}
