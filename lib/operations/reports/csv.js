import { OperationsError } from "../errors.js";

export const REPORT_KINDS = Object.freeze(["programme", "attendance", "evaluations", "people"]);

function cell(value) {
  let text = value === null || value === undefined ? "" : String(value);
  // Spreadsheet parsers trim whitespace/control characters before detecting formulas.
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function createOperationsReport(snapshot, kind) {
  if (!REPORT_KINDS.includes(kind)) throw new OperationsError("invalid_input", 400, "Choose an available report.");
  if (snapshot.truncated) throw new OperationsError("export_too_large", 409, "This report exceeds the snapshot limit. Export a smaller event or use an approved paginated export.");
  const people = new Map((snapshot.people ?? []).map((row) => [row.id, row]));
  const resources = new Map((snapshot.resources ?? []).map((row) => [row.id, row]));
  const activities = new Map((snapshot.activities ?? []).map((row) => [row.id, row]));
  const assignments = new Map((snapshot.assignments ?? []).map((row) => [row.id, row]));
  const cycles = new Map((snapshot.cycles ?? []).map((row) => [row.id, row]));
  let headings;
  let rows;
  if (kind === "people") {
    headings = ["Person ID", "Name", "Email", "Roles"];
    rows = [...people.values()].map((row) => [row.id, row.name, row.email, (row.roles ?? []).join("; ")]);
  } else if (kind === "programme") {
    headings = ["Release ID", "Release version", "Released at", "Activity ID", "Activity", "Kind", "Resource", "Starts at", "Ends at", "Time zone", "Assignments"];
    const releases = snapshot.releases ?? [];
    if (releases.length) {
      // Immutable placements remain reproducible after rooms, titles or assignments change.
      rows = releases.flatMap((release) => (release.items ?? []).map((row) => [release.id, release.version, release.createdAt,
        row.activityId, row.title, row.kind, row.resourceName, row.startsAt, row.endsAt, row.timezone,
        JSON.stringify(row.assignments ?? [])]));
    } else {
      const effectiveResource = (activity) => {
        const seen = new Set();
        while (activity && !seen.has(activity.id)) {
          seen.add(activity.id);
          if (activity.resourceId) return resources.get(activity.resourceId)?.name;
          activity = activities.get(activity.parentId);
        }
        return "";
      };
      rows = [...activities.values()].map((row) => ["", "draft", "", row.id, row.title, row.kind, effectiveResource(row),
        row.startsAt, row.endsAt, row.timezone, [...assignments.values()].filter((item) => item.activityId === row.id && item.status === "active")
          .map((item) => `${people.get(item.personId)?.name ?? "Unknown"} (${item.role})`).join("; ")]);
    }
  } else if (kind === "attendance") {
    headings = ["Attendance ID", "Activity ID", "Activity", "Person ID", "Person", "Purpose", "Revision", "Status", "Notes", "Recorded at", "Actor ID"];
    const marks = new Map((snapshot.attendance ?? []).map((row) => [row.id, row]));
    const revisions = snapshot.attendanceRevisions ?? [];
    const entries = [...revisions.map((row) => ({ ...marks.get(row.attendanceId), ...row, attendanceId: row.attendanceId })),
      ...[...marks.values()].filter((row) => !revisions.some((item) => item.attendanceId === row.id && item.revision === row.revision))
        .map((row) => ({ ...row, attendanceId: row.id }))];
    rows = entries.map((row) => [row.attendanceId, row.activityId, activities.get(row.activityId)?.title,
      row.personId, people.get(row.personId)?.name, row.purpose, row.revision, row.status, row.notes, row.recordedAt, row.actorId]);
  } else {
    headings = ["Evaluation ID", "Cycle ID", "Cycle", "Cycle state", "Activity ID", "Activity", "Evaluator ID", "Evaluator", "Revision", "Status", "Scores", "Rubric", "Aggregation policy", "Private notes", "Submitted at", "Approved feedback"];
    const evaluations = new Map((snapshot.evaluations ?? []).map((row) => [row.id, row]));
    const revisions = snapshot.evaluationRevisions ?? [];
    const entries = [...revisions.map((row) => ({ ...evaluations.get(row.evaluationId), ...row, evaluationId: row.evaluationId, status: "submitted", approvedFeedback: null })),
      ...[...evaluations.values()].filter((row) => !revisions.some((item) => item.evaluationId === row.id && item.revision === row.revision))
        .map((row) => ({ ...row, evaluationId: row.id }))];
    rows = entries.map((row) => {
      const assignment = assignments.get(row.assignmentId);
      const cycleId = row.cycleId ?? assignment?.cycleId;
      const cycle = cycles.get(cycleId);
      const activityId = row.activityId ?? assignment?.activityId;
      const personId = row.personId ?? assignment?.personId;
      return [row.evaluationId, cycleId, cycle?.title, cycle?.state, activityId, activities.get(activityId)?.title,
        personId, people.get(personId)?.name, row.revision, row.status, JSON.stringify(row.scores ?? {}),
        JSON.stringify(cycle?.rubric ?? []), "Weighted normalized 0-100; mean of complete submitted evaluations; missing excluded",
        row.notes, row.submittedAt, row.approvedFeedback];
    });
  }
  return [headings, ...rows].map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}
