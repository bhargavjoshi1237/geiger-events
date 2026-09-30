import { readRecord, updateRecord, transitionRecord, archiveRecord } from "@/lib/operations/records/service";
import { readOperationsJson } from "@/lib/operations/server/commands";
import { withRecordRoute } from "@/lib/operations/server/record_route";

export async function GET(request, { params }) {
  const archived = new URL(request.url).searchParams.get("archived") === "true";
  return withRecordRoute(request, params,
    archived ? "events.operations.records.archive" : "events.operations.view",
    (context, path) => readRecord(context, { ...path, archived }));
}

export async function PUT(request, { params }) {
  return withRecordRoute(request, params, "events.operations.records.update", async (context, path) =>
    updateRecord(context, { ...await readOperationsJson(request), ...path }));
}

export async function PATCH(request, { params }) {
  return withRecordRoute(request, params, "events.operations.records.update", async (context, path) =>
    transitionRecord(context, { ...await readOperationsJson(request), ...path }));
}

export async function DELETE(request, { params }) {
  return withRecordRoute(request, params, "events.operations.records.archive", async (context, path) =>
    archiveRecord(context, { ...await readOperationsJson(request), ...path }));
}
