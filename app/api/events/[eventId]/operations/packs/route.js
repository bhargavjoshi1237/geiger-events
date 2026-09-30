import { OperationsError } from "@/lib/operations/errors";
import { listPacks, instantiatePack } from "@/lib/operations/modules/packs";
import { authorizeEventAction } from "@/lib/operations/server/access";
import { handleOperationsRequest } from "@/lib/operations/server/commands";
import { resolveStaffPrincipal } from "@/lib/operations/server/staff_identity";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request, { params }) {
  return handleOperationsRequest(async () => {
    const { eventId } = await params;
    if (!uuid.test(eventId ?? "")) throw new OperationsError("invalid_event", 400, "Invalid event ID.");
    const principal = await resolveStaffPrincipal(request);
    await authorizeEventAction(principal, eventId, "events.operations.configure");
    return listPacks().map((pack) => ({ ...pack, ...instantiatePack(pack.key) }));
  });
}
