import { GUESTS } from "@/lib/control/guests/access";
import { parseTagRename } from "@/lib/control/guests/views";
import { withControl } from "@/lib/control/http";
import { must, projectScope, readJson } from "@/lib/control/scope";

// POST { from, to, catalogId? } — renames the tag on every contact, then its catalog row, like the dashboard.
export async function POST(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const { from, to, catalogId } = parseTagRename(await readJson(request));
    const scope = await projectScope(ctx, projectId, GUESTS);
    const touched = must(await scope.db.rpc("rewrite_contact_tags", { p_project: projectId, p_from: [from], p_to: to }), "tags.rename");
    if (catalogId) {
      must(await scope.db.from("contact_tags").update({ name: to }).eq("id", catalogId).eq("project_id", projectId), "tags.renameCatalog");
    }
    return { renamed: true, contacts: Number(touched) || 0 };
  });
}
