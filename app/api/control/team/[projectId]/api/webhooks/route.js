import { PATCH as updateEndpoint } from "@/app/api/settings/webhooks/route";
import { requireId, withControl } from "@/lib/control/http";
import { readJson } from "@/lib/control/scope";
import { forwardToHandler } from "@/lib/control/team/forward";
import { ApiError } from "@/lib/staff_access/errors";

// PATCH { id, active } — pause or resume an endpoint through the dashboard's handler, which also clears an automatic shut-off.
export async function PATCH(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async () => {
    requireId(projectId);
    const { id, active } = await readJson(request);
    if (typeof active !== "boolean") throw new ApiError("invalid_input", 400, "Turn it on or off.");
    const data = await forwardToHandler(updateEndpoint, request, { method: "PATCH", body: { projectId, id, active } });
    return { webhook: { id: data.endpoint?.id, active: data.endpoint?.active !== false } };
  });
}
