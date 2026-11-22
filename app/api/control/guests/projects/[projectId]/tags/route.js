import { GUESTS } from "@/lib/control/guests/access";
import { tagList } from "@/lib/control/guests/views";
import { withControl } from "@/lib/control/http";
import { must, projectScope } from "@/lib/control/scope";
import { selectAll } from "@/lib/supabase/select_all";

// GET — the tag catalog merged with tags that only exist on contacts, each with how many contacts carry it.
export async function GET(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await projectScope(ctx, projectId, GUESTS);
    const [catalog, contacts] = await Promise.all([
      scope.db.from("contact_tags").select("*").eq("project_id", projectId).is("deleted_at", null),
      selectAll(() => scope.db.from("contacts").select("id,tags").eq("project_id", projectId).is("deleted_at", null).order("id")),
    ]);
    return { tags: tagList(must(catalog, "tags.catalog"), must(contacts, "tags.contacts")) };
  });
}
