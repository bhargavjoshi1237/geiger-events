import { GUESTS, projectRow } from "@/lib/control/guests/access";
import { dataRequestView, parseDataRequestStatus } from "@/lib/control/guests/views";
import { withControl } from "@/lib/control/http";
import { must, readJson } from "@/lib/control/scope";

// PATCH { status } — moves the request along; the data work itself happens on the dashboard.
export async function PATCH(request, { params }) {
  const { requestId } = await params;
  return withControl(request, async (ctx) => {
    const patch = parseDataRequestStatus(await readJson(request));
    const scope = await projectRow(ctx, { table: "data_requests", id: requestId, permission: GUESTS, notFound: "Request not found." });
    const row = must(await scope.db.from("data_requests").update(patch).eq("id", requestId).select("*").single(), "dataRequests.update");
    return { request: dataRequestView(row) };
  });
}
