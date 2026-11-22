import { GUESTS } from "@/lib/control/guests/access";
import { parseTagDelete } from "@/lib/control/guests/views";
import { withControl } from "@/lib/control/http";
import { must, projectScope, readJson } from "@/lib/control/scope";

// POST { name, catalogId? } — removes the tag from every contact and retires its catalog row.
export async function POST(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const { name, catalogId } = parseTagDelete(await readJson(request));
    const scope = await projectScope(ctx, projectId, GUESTS);
    const touched = must(await scope.db.rpc("rewrite_contact_tags", { p_project: projectId, p_from: [name], p_to: null }), "tags.delete");
    if (catalogId) {
      must(
        await scope.db.from("contact_tags").update({ deleted_at: new Date().toISOString() }).eq("id", catalogId).eq("project_id", projectId),
        "tags.deleteCatalog",
      );
    }
    return { deleted: true, contacts: Number(touched) || 0 };
  });
}
