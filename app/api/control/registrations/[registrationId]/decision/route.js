import { withControl } from "@/lib/control/http";
import { CONTROL_CAPABILITIES } from "@/lib/control/profile";
import { REGISTRATION_COLUMNS, registrationView } from "@/lib/control/records";
import { must, readJson, recordScope } from "@/lib/control/scope";
import { ApiError } from "@/lib/staff_access/errors";

// POST { approve: boolean } — decide a Pending registration. Like the dashboard, the guest isn't emailed.
export async function POST(request, { params }) {
  const { registrationId } = await params;
  return withControl(request, async (ctx) => {
    const body = await readJson(request);
    if (typeof body.approve !== "boolean") throw new ApiError("invalid_input", 400, "Say whether to approve or decline.");
    const scope = await recordScope(ctx, {
      table: "registrations",
      id: registrationId,
      columns: "id,event_id,status",
      permission: CONTROL_CAPABILITIES.edit,
      notFound: "Registration not found.",
    });
    if (scope.row.status !== "Pending") {
      throw new ApiError("invalid_state", 409, `This registration is ${scope.row.status}, so there's nothing to decide.`);
    }
    must(
      await scope.db.rpc("approve_registration", { p_id: registrationId, p_approve: body.approve, p_by: ctx.principal.id }),
      "registration.decide",
    );
    const row = must(await scope.db.from("registrations").select(REGISTRATION_COLUMNS).eq("id", registrationId).single(), "registration.reload");
    return { guest: registrationView(row, false) };
  });
}
