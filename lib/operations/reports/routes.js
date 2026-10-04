import { OperationsError } from "../errors.js";
import { authorizeEventAction } from "../server/access.js";
import { handleOperationsRequest } from "../server/commands.js";
import { resolveStaffPrincipal } from "../server/staff_identity.js";
import { readWorkflow, readWorkflowHistory } from "../workflow/service.js";
import { workflowStore } from "../server/workflow_store.js";
import { createOperationsReport, REPORT_KINDS } from "./csv.js";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createExportHandler({ resolvePrincipal = resolveStaffPrincipal, authorize = authorizeEventAction, store = workflowStore } = {}) {
  return async function GET(request, { params }) {
    let report;
    let kind;
    const response = await handleOperationsRequest(async () => {
      const { eventId } = await params;
      if (!uuid.test(eventId ?? "")) throw new OperationsError("invalid_path", 400, "Invalid event ID.");
      const query = new URL(request.url).searchParams;
      kind = query.get("kind");
      if ([...query.keys()].some((key) => key !== "kind") || query.getAll("kind").length !== 1 || !REPORT_KINDS.includes(kind)) {
        throw new OperationsError("invalid_input", 400, "Choose an available report.");
      }
      const principal = await resolvePrincipal(request);
      const context = await authorize(principal, eventId, "events.operations.record_archive");
      const snapshot = await readWorkflow(context, store);
      const history = ["attendance", "evaluations"].includes(kind) ? await readWorkflowHistory(context, store) : {};
      if ((history.attendanceRevisions ?? []).some((row) => !snapshot.attendance.some((mark) => mark.id === row.attendanceId)) ||
          (history.evaluationRevisions ?? []).some((row) => !snapshot.evaluations.some((evaluation) => evaluation.id === row.evaluationId))) {
        throw new OperationsError("revision_conflict", 409, "This workflow changed while exporting. Try again.");
      }
      report = createOperationsReport({ ...snapshot, ...history, truncated: snapshot.truncated || history.truncated }, kind);
      return { ok: true };
    });
    if (!response.ok) return response;
    return new Response(`\uFEFF${report}`, { headers: {
      "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="operations-${kind}.csv"`,
      "X-Content-Type-Options": "nosniff",
    } });
  };
}
