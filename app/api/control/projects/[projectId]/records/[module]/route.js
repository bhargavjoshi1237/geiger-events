import { withControl } from "@/lib/control/http";
import { parseRecordInput, recordView } from "@/lib/control/records_engine";
import { listQuery, moduleScope } from "@/lib/control/records_route";
import { must, readJson } from "@/lib/control/scope";

// GET ?q=&status= — a module's records in this project, newest first.
export async function GET(request, { params }) {
  const { projectId, module } = await params;
  return withControl(request, async (ctx) => {
    const scope = await moduleScope(ctx, projectId, module);
    const rows = must(await listQuery(scope.db, scope, projectId, new URL(request.url).searchParams), `${scope.table}.list`);
    return { records: rows.map((row) => recordView(scope.descriptor, row)) };
  });
}

// POST { name, kind?, status?, active?, config? } — created from the module's defaults, like the dashboard's create dialog.
export async function POST(request, { params }) {
  const { projectId, module } = await params;
  return withControl(request, async (ctx) => {
    const scope = await moduleScope(ctx, projectId, module);
    const row = parseRecordInput(scope.descriptor, await readJson(request));
    const created = must(
      await scope.db.from(scope.table).insert({ ...row, project_id: projectId, created_by: ctx.principal.id }).select("*").single(),
      `${scope.table}.create`,
    );
    return { record: recordView(scope.descriptor, created) };
  });
}
