import test from "node:test";
import assert from "node:assert/strict";
import { createOperationsReport } from "./csv.js";

const snapshot = { people: [{ id: "p1", name: "=IMPORTXML(\"evil\")", email: "person@example.com", roles: ["presenter"] }],
  resources: [{ id: "r1", name: "Room, 1" }], activities: [{ id: "a1", title: "Talk", resourceId: "r1", timezone: "Asia/Kolkata" }],
  assignments: [{ id: "as1", personId: "p1", activityId: "a1", status: "active", role: "presenter" }],
  attendance: [{ activityId: "a1", personId: "p1", purpose: "delivery", status: "absent", notes: "+danger" }],
  cycles: [], evaluations: [] };

test("reports join people and programme and prevent spreadsheet formulas and broken CSV cells", () => {
  const csv = createOperationsReport(snapshot, "programme");
  assert.ok(csv.includes('"Room, 1"'));
  assert.ok(csv.includes("Talk"));
  const people = createOperationsReport(snapshot, "people");
  assert.ok(people.includes("'=IMPORTXML"));
  assert.ok(people.includes('""evil""'));
  assert.ok(createOperationsReport(snapshot, "attendance").includes("'+danger"));
});

test("reports reject unknown kinds and incomplete snapshots instead of exporting partial data", () => {
  assert.throws(() => createOperationsReport(snapshot, "private-sql"), { code: "invalid_input" });
  assert.throws(() => createOperationsReport({ ...snapshot, truncated: true }, "people"), { code: "export_too_large" });
  assert.equal(createOperationsReport({ ...snapshot, evaluations: [] }, "evaluations").split("\r\n").length, 2);
});

test("exports preserve frozen placements and all attendance/evaluation revisions", () => {
  const data={...snapshot,releases:[{id:"release-1",version:1,createdAt:"2026-10-02T09:00:00Z",items:[{activityId:"a1",title:"Original talk",resourceName:"Original hall",startsAt:"2026-10-02T10:00:00Z",endsAt:"2026-10-02T11:00:00Z",timezone:"UTC",assignments:[]}]}],
    attendance:[{id:"att-1",activityId:"a1",personId:"p1",purpose:"delivery",revision:2,status:"present",notes:"Corrected"}],
    attendanceRevisions:[{attendanceId:"att-1",revision:1,status:"absent",notes:"Initial absence",actorId:"staff-1",recordedAt:"2026-10-02T10:00:00Z"},{attendanceId:"att-1",revision:2,status:"present",notes:"Corrected",actorId:"staff-2",recordedAt:"2026-10-02T10:05:00Z"}],
    cycles:[{id:"cycle-1",title:"Live evaluation",state:"released",rubric:[{id:"quality",min:0,max:10,weight:1}]}],
    evaluations:[{id:"eval-1",assignmentId:"as1",cycleId:"cycle-1",activityId:"a1",personId:"p1",revision:2,status:"draft",scores:{quality:8},notes:"Reopened"}],
    evaluationRevisions:[{evaluationId:"eval-1",revision:1,scores:{quality:7},notes:"Original submission",submittedAt:"2026-10-02T10:00:00Z"}]};
  const programme=createOperationsReport(data,"programme");
  assert.ok(programme.includes("Original talk")); assert.ok(programme.includes("Original hall"));assert.ok(programme.includes("release-1"));
  const attendance=createOperationsReport(data,"attendance");
  assert.ok(attendance.includes("Initial absence"));assert.ok(attendance.includes("Corrected"));assert.ok(attendance.includes("staff-1"));
  const evaluations=createOperationsReport(data,"evaluations");
  assert.ok(evaluations.includes("Original submission"));assert.ok(evaluations.includes("Reopened"));assert.ok(evaluations.includes("released"));assert.ok(evaluations.includes("quality"));
});
