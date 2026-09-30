import { STABLE_KEY } from "../contracts.js";
import { OperationsError } from "../errors.js";
import { authorizeEventAction } from "./access.js";
import { handleOperationsRequest } from "./commands.js";
import { resolveStaffPrincipal } from "./staff_identity.js";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function withRecordRoute(request, params, permission, work) {
  return handleOperationsRequest(async () => {
    const { eventId, moduleKey, recordId } = await params;
    if (!uuid.test(eventId ?? "") || (recordId && !uuid.test(recordId)) ||
      !STABLE_KEY.test(moduleKey ?? "")) {
      throw new OperationsError("invalid_path", 400, "Invalid operations path.");
    }
    const principal = await resolveStaffPrincipal(request);
    const context = await authorizeEventAction(principal, eventId, permission);
    return work(context, { moduleKey, recordId });
  });
}
