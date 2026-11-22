import { REGISTRATIONS } from "@/lib/control/guests/access";
import { formView } from "@/lib/control/guests/views";
import { withControl } from "@/lib/control/http";
import { must, projectScope } from "@/lib/control/scope";

// GET — the project's registration forms; building them stays on the dashboard.
export async function GET(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await projectScope(ctx, projectId, REGISTRATIONS);
    const rows = must(
      await scope.db.from("registration_forms").select("id,name,description,status,fields,updated_at,created_at").eq("project_id", projectId).is("deleted_at", null).order("created_at", { ascending: false }),
      "forms.list",
    );
    return { forms: rows.map(formView) };
  });
}
