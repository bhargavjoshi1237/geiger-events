import { withControl } from "@/lib/control/http";
import { parseRecordInput, recordView } from "@/lib/control/records_engine";
import { recordScope } from "@/lib/control/records_route";
import { must, readJson } from "@/lib/control/scope";
import { ApiError } from "@/lib/staff_access/errors";

export async function GET(request, { params }) {
  const { module, id } = await params;
  return withControl(request, async (ctx) => {
    const scope = await recordScope(ctx, module, id);
    return { record: recordView(scope.descriptor, scope.row) };
  });
}

// PATCH — only the module's own fields; config keys merge into what's stored.
export async function PATCH(request, { params }) {
  const { module, id } = await params;
  return withControl(request, async (ctx) => {
    const body = await readJson(request);
    const scope = await recordScope(ctx, module, id);
    const patch = parseRecordInput(scope.descriptor, body, { current: scope.row });
    const updated = must(
      await scope.db.from(scope.table).update(patch).eq("id", id).is("deleted_at", null).select("*").maybeSingle(),
      `${scope.table}.update`,
    );
    if (!updated) throw new ApiError("not_found", 404, `${scope.descriptor.singular} not found.`);
    return { record: recordView(scope.descriptor, updated) };
  });
}

// Soft delete, as the dashboard does.
export async function DELETE(request, { params }) {
  const { module, id } = await params;
  return withControl(request, async (ctx) => {
    const scope = await recordScope(ctx, module, id);
    must(await scope.db.from(scope.table).update({ deleted_at: new Date().toISOString() }).eq("id", id), `${scope.table}.delete`);
    return { deleted: true };
  });
}
