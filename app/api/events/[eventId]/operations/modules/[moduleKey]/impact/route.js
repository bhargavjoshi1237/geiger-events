import { readModuleImpact } from "@/lib/operations/workspaces/service";
import { withRecordRoute } from "@/lib/operations/server/record_route";

export async function GET(request, { params }) {
  return withRecordRoute(request, params, "events.operations.configure",
    (context, { moduleKey }) => readModuleImpact(context, moduleKey));
}
