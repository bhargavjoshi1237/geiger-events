import { REGISTRATIONS, projectRow } from "@/lib/control/guests/access";
import { formView, parseFormStatus } from "@/lib/control/guests/views";
import { withControl } from "@/lib/control/http";
import { must, readJson } from "@/lib/control/scope";

// PATCH { status: "Published" | "Draft" } — the dashboard's Publish / Unpublish toggle.
export async function PATCH(request, { params }) {
  const { formId } = await params;
  return withControl(request, async (ctx) => {
    const patch = parseFormStatus(await readJson(request));
    const scope = await projectRow(ctx, {
      table: "registration_forms",
      id: formId,
      columns: "id,project_id",
      permission: REGISTRATIONS,
      notFound: "Form not found.",
    });
    const row = must(
      await scope.db.from("registration_forms").update(patch).eq("id", formId).select("id,name,description,status,fields,updated_at,created_at").single(),
      "forms.update",
    );
    return { form: formView(row) };
  });
}
