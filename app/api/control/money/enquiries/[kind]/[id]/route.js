import { userDb } from "@/lib/control/boundary";
import { requireId, withControl } from "@/lib/control/http";
import { enquiryKind } from "@/lib/control/money/enquiries";
import { eventsById } from "@/lib/control/money/queries";
import { parseEnquiryStatus } from "@/lib/control/money/views";
import { must, projectScope, readJson } from "@/lib/control/scope";
import { ApiError } from "@/lib/staff_access/errors";

// PATCH { status } — triage an enquiry; read as the user first, so one from another project is simply not found.
export async function PATCH(request, { params }) {
  const { kind, id } = await params;
  return withControl(request, async (ctx) => {
    const spec = enquiryKind(kind);
    requireId(id);
    const status = parseEnquiryStatus(kind, await readJson(request));
    const current = must(
      await userDb(ctx.token).from(spec.table).select("id,project_id,status").eq("id", id).is("deleted_at", null).maybeSingle(),
      `money.${kind}.load`,
    );
    if (!current?.project_id) throw new ApiError("not_found", 404, "Enquiry not found.");
    if (kind === "sponsors" && current.status === "converted") {
      throw new ApiError("invalid_state", 409, "This enquiry became a sponsor; change it on the dashboard.");
    }
    const scope = await projectScope(ctx, current.project_id, spec.permission);
    const row = must(await scope.db.from(spec.table).update({ status }).eq("id", id).select("*").single(), `money.${kind}.update`);
    const events = await eventsById(scope.db, [row.event_id]);
    return { enquiry: spec.view(row, events.get(row.event_id)) };
  });
}
