import { GUESTS } from "@/lib/control/guests/access";
import { notesFeed } from "@/lib/control/guests/views";
import { withControl } from "@/lib/control/http";
import { must, projectScope } from "@/lib/control/scope";
import { selectAll } from "@/lib/supabase/select_all";

// GET — every contact's notes as one newest-first feed (Guests → Notes).
export async function GET(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await projectScope(ctx, projectId, GUESTS);
    const rows = must(
      await selectAll(() =>
        scope.db.from("contacts").select("id,name,email,metadata").eq("project_id", projectId).is("deleted_at", null).order("id"),
      ),
      "notes.feed",
    );
    return { notes: notesFeed(rows).slice(0, 500) };
  });
}
