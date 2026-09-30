import { OperationsError } from "@/lib/operations/errors";
import { createRecord, listRecords } from "@/lib/operations/records/service";
import { readOperationsJson } from "@/lib/operations/server/commands";
import { withRecordRoute } from "@/lib/operations/server/record_route";

export async function GET(request, { params }) {
  const query = new URL(request.url).searchParams;
  const archived = query.get("archived") === "true";
  const permission = archived ? "events.operations.records.archive" : "events.operations.view";
  return withRecordRoute(request, params, permission, (context, { moduleKey }) => {
    if ([...query.keys()].some((key) => !["cursor", "limit", "state", "archived"].includes(key)) ||
      (query.has("archived") && !["true", "false"].includes(query.get("archived")))) {
      throw new OperationsError("invalid_filter", 400, "Invalid record filter.");
    }
    return listRecords(context, { moduleKey, cursor: query.get("cursor") ?? undefined,
      limit: query.get("limit") ?? undefined, state: query.get("state") ?? undefined, archived });
  });
}

export async function POST(request, { params }) {
  return withRecordRoute(request, params, "events.operations.records.create", async (context, { moduleKey }) =>
    createRecord(context, { ...await readOperationsJson(request), moduleKey }));
}
