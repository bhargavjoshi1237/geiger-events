import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { createWorkspaceService } from "../lib/workspace/server/service.js";
import { createCopyService } from "../lib/workspace/server/copy.js";
import { createPortalStaff } from "../lib/workspace/portal/staff.js";
import { newBlockId, newRowId } from "../lib/workspace/portal/pages.js";
import { createProcessService } from "../lib/workspace/process/service.js";
import { createDocumentService } from "../lib/workspace/documents/service.js";

// Showcase Workspace: a research conference (ICAML 2026) that exercises every Workspace feature —
// all 22 field types, every event-data link, statuses, formulas, lookups, rollups, saved views (shared,
// personal, board, grouped), files, comments, history, bulk edits, the trash and a template — plus the
// portal: blind peer review, author submissions with sign-up, session-chair attendance and a team desk —
// and the process: stage rules, a review setup, automations (email, code, webhook), documents and a certificate.
// Built through the same service layer the API uses. Re-runnable: it deletes and rebuilds the workspace.
// Usage: node scripts/seed-workspace-showcase.mjs

const PROJECT = "ebcc7910-1a0e-4e91-8c3b-752f3c4292d3";
const EVENT = "ac3a2026-1208-4a10-9e00-000000000001";
const VENUE = "ac3a2026-1208-4a10-9c00-000000000001";
const id = (block, n) => `ac3a2026-1208-4a10-${block}-${String(n).padStart(12, "0")}`;
const SITE = process.env.NEXT_PUBLIC_SUITE_ORIGIN || "https://geiger.studio";
// Links made while seeding (certificate QR codes, record links) point at the live app, not localhost.
process.env.GEIGER_EVENTS_PUBLIC_URL ||= `${SITE}/events`;

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: "events" }, auth: { persistSession: false, autoRefreshToken: false },
});
const service = createWorkspaceService();
const copy = createCopyService({ recomputeObject: (ctx, objectId) => service.recomputeObject(ctx, objectId) });
const log = (...parts) => console.log("·", ...parts);
const fail = (message) => { throw new Error(message); };
const checked = ({ data, error }) => { if (error) throw error; return data; };

// Upserts, dropping project_id if this table doesn't have it.
async function upsert(table, rows) {
  let result = await db.from(table).upsert(rows, { onConflict: "id" });
  if (result.error && /project_id/.test(result.error.message)) {
    result = await db.from(table).upsert(rows.map(({ project_id: _drop, ...row }) => row), { onConflict: "id" });
  }
  if (result.error) throw result.error;
}

// ---------------------------------------------------------------- event data
const SPACES = [
  ["Auditorium Tejo", "hall", "Ground", { theatre: 900 }],
  ["Room 1.01", "room", "Level 1", { theatre: 180 }],
  ["Room 1.02", "room", "Level 1", { theatre: 160 }],
  ["Poster Hall", "hall", "Ground", { standing: 400 }],
  ["Workshop Lab", "room", "Level 2", { classroom: 60 }],
];

const PEOPLE = [
  // name, affiliation, country, roles, expertise, ticket?, grant
  ["Inês Carvalho", "University of Porto", "Portugal", ["Author", "Session chair"], ["Computer vision"], true, 0],
  ["Lukas Brandt", "TU Munich", "Germany", ["Author"], ["ML systems"], true, 650],
  ["Priya Raghavan", "IIT Madras", "India", ["Author", "Reviewer"], ["NLP"], true, 900],
  ["Daniel Okafor", "University of Nairobi", "Kenya", ["Author"], ["Responsible AI"], true, 1200],
  ["Haruto Sato", "University of Tokyo", "Japan", ["Author"], ["Reinforcement learning"], true, 0],
  ["Camila Duarte", "University of São Paulo", "Brazil", ["Author"], ["NLP", "Responsible AI"], true, 800],
  ["Emily Chen", "Stanford University", "United States", ["Author", "Keynote"], ["ML systems"], true, 0],
  ["Ravi Menon", "National University of Singapore", "Singapore", ["Author"], ["Computer vision"], true, 0],
  ["Sofia Almeida", "NOVA University Lisbon", "Portugal", ["Author", "Volunteer"], ["Responsible AI"], true, 0],
  ["Jonas Weber", "ETH Zürich", "Germany", ["Author"], ["Reinforcement learning", "ML systems"], true, 0],
  ["Aisha Bello", "Strathmore University", "Kenya", ["Author"], ["NLP"], true, 700],
  ["Tom Gallagher", "University of Edinburgh", "United Kingdom", ["Author"], ["Computer vision"], false, 0],
  ["Mei Lin", "University of Toronto", "Canada", ["Author"], ["NLP"], true, 0],
  ["Arjun Kapoor", "IISc Bangalore", "India", ["Author"], ["ML systems"], false, 500],
  ["Margaret Hughes", "University of Cambridge", "United Kingdom", ["Reviewer", "Session chair", "Programme chair"], ["NLP", "Responsible AI"], true, 0],
  ["Kenji Yamamoto", "RIKEN AIP", "Japan", ["Reviewer"], ["Reinforcement learning"], true, 0],
  ["Laura Fischer", "Max Planck Institute for Informatics", "Germany", ["Reviewer", "Session chair"], ["Computer vision"], true, 0],
  ["Marcus Johnson", "Carnegie Mellon University", "United States", ["Reviewer"], ["ML systems"], false, 0],
  ["Ana Ribeiro", "University of Coimbra", "Portugal", ["Reviewer"], ["Responsible AI", "NLP"], true, 0],
  ["Samuel Mwangi", "Kenyatta University", "Kenya", ["Reviewer"], ["Computer vision"], false, 0],
  ["Olivia Martin", "Mila – Quebec AI Institute", "Canada", ["Reviewer", "Keynote"], ["Reinforcement learning"], true, 0],
  ["Rui Costa", "University of Minho", "Portugal", ["Volunteer"], [], true, 0],
  ["Beatriz Sousa", "University of Lisbon", "Portugal", ["Volunteer"], [], true, 0],
  ["David Tan", "Nanyang Technological University", "Singapore", ["Session chair", "Programme chair"], ["ML systems"], true, 0],
];
const emailOf = (name) => `${name.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "")}@example.edu`;

async function seedEventData() {
  await upsert("venues", [{
    id: VENUE, project_id: PROJECT, name: "Harbourfront Congress Centre", type: "Indoor", status: "Active",
    address: "Avenida da Índia 1", city: "Lisbon", country: "Portugal", timezone: "Europe/Lisbon",
    seated_capacity: 1200, standing_capacity: 1600, spaces: SPACES.length,
    description: "Riverside congress centre with a 900-seat auditorium, breakout rooms and a poster hall.",
  }]);
  await upsert("venue_spaces", SPACES.map(([name, kind, floor, capacities], i) => ({
    id: id("9c01", i + 1), project_id: PROJECT, venue_id: VENUE, name, kind, floor, capacities, sort_order: i,
  })));
  await upsert("events", [{
    id: EVENT, project_id: PROJECT, venue_id: VENUE,
    name: "ICAML 2026 — International Conference on Applied Machine Learning",
    status: "Scheduled", type: "In-person", event_date: "2026-12-08", event_time: "09:00", timezone: "Europe/Lisbon",
    venue: "Harbourfront Congress Centre", address: "Avenida da Índia 1", city: "Lisbon", capacity: 900,
    sold: 0, revenue: 0, visibility: "Private", organizer: "ICAML Steering Committee", is_listable: false,
    summary: "Three days of peer-reviewed research on applied machine learning: keynotes, oral and poster sessions, and hands-on workshops. Workspace showcase event.",
    metadata: { showcase: "workspace" },
  }]);
  await upsert("contacts", PEOPLE.map(([name, affiliation, country], i) => ({
    id: id("9c10", i + 1), project_id: PROJECT, name, email: emailOf(name), company: affiliation, location: country,
    status: "Active", tags: ["ICAML 2026"],
  })));
  const ticketed = PEOPLE.map((person, i) => ({ person, i })).filter(({ person }) => person[5]);
  await upsert("registrations", ticketed.map(({ person: [name, , , roles], i }) => ({
    id: id("9c11", i + 1), project_id: PROJECT, event_id: EVENT, name, email: emailOf(name),
    status: roles.includes("Volunteer") ? "Confirmed" : i % 5 === 0 ? "Checked-in" : "Confirmed", source: "Online", party_size: 1,
  })));
  await upsert("event_orders", ticketed.map(({ person: [name, , , roles], i }) => {
    const ticket = roles.includes("Volunteer") ? ["Volunteer pass", 0] : roles.includes("Reviewer") && !roles.includes("Author") ? ["Reviewer pass", 120] : i % 3 === 0 ? ["Student", 220] : ["Full conference", 480];
    return { id: id("9c12", i + 1), project_id: PROJECT, event_id: EVENT, buyer_name: name, buyer_email: emailOf(name),
      ticket_name: ticket[0], ticket_price: ticket[1], quantity: 1, total: ticket[1], status: "confirmed" };
  }));
  const revenue = ticketed.reduce((sum, { person: [, , , roles], i }) => sum + (roles.includes("Volunteer") ? 0 : roles.includes("Reviewer") && !roles.includes("Author") ? 120 : i % 3 === 0 ? 220 : 480), 0);
  checked(await db.from("events").update({ sold: ticketed.length, revenue }).eq("id", EVENT));
  log(`event data: venue + ${SPACES.length} rooms, ${PEOPLE.length} contacts, ${ticketed.length} ticket holders and orders`);
}

// ---------------------------------------------------------------- actor
async function findActor() {
  const roles = checked(await db.schema("public").from("roles").select("id").eq("project_id", PROJECT).is("deleted_at", null));
  const grants = checked(await db.from("role_grants").select("user_id").eq("project_id", PROJECT).eq("status", "active")
    .is("deleted_at", null).in("role_id", roles.map((role) => role.id)));
  const candidates = [...new Set(grants.map((grant) => grant.user_id))];
  const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 });
  const preferred = users?.users?.find((user) => user.email === "bjoshi@vardaam.email")?.id;
  candidates.sort((a, b) => (a === preferred ? -1 : b === preferred ? 1 : 0));
  for (const user of candidates) {
    const allowed = checked(await db.rpc("workspace_can", { p_project: PROJECT, p_event: EVENT, p_actor: user, p_permission: "events.workspace.configure" }));
    if (allowed) return user;
  }
  return fail("No project member can build workspaces here (needs a role with events.workspace.configure).");
}

// ---------------------------------------------------------------- helpers over the service
let context;
let definition;
async function run(action, payload) {
  const { result, after = [] } = await service.runCommand(context, { action, ...payload });
  for (const task of after) await task();
  return result;
}
const refresh = async () => { definition = await service.getDefinition(context); return definition; };
const objectByKey = (key) => definition.objects.find((object) => object.key === key && !object.deletedAt);
const fieldOf = (objectKey, fieldKey) => definition.fields.find((field) => field.objectId === objectByKey(objectKey).id && field.key === fieldKey && !field.deletedAt);
const fid = (objectKey, fieldKey) => fieldOf(objectKey, fieldKey)?.id ?? fail(`No field ${objectKey}.${fieldKey}`);
const opt = (label) => `opt_${label.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24)}`;
const options = (labels, colors = []) => labels.map((label, i) => ({ id: opt(label), label, color: colors[i] ?? ["blue", "green", "violet", "amber", "teal", "pink", "red", "gray"][i % 8] }));
const statuses = (pairs) => pairs.map(([label, color]) => ({ label, color }));
const statusKey = (objectKey, label) => objectByKey(objectKey).statuses.find((status) => status.label === label)?.key ?? fail(`No status ${label}`);
const field = (name, type, config = {}, extra = {}) => ({ name, type, config, ...extra });

async function createRecord(objectKey, values, status) {
  const body = { objectId: objectByKey(objectKey).id, values: {} };
  for (const [key, value] of Object.entries(values)) if (value !== undefined) body.values[fid(objectKey, key)] = value;
  if (status) body.status = statusKey(objectKey, status);
  return (await run("record.create", body)).record;
}
async function updateRecord(objectKey, record, values = {}, status) {
  const current = (await service.getRecord(context, record.id)).record;
  const body = { recordId: record.id, expectedRevision: current.revision, values: {} };
  for (const [key, value] of Object.entries(values)) body.values[fid(objectKey, key)] = value;
  if (status) body.status = statusKey(objectKey, status);
  return (await run("record.update", body)).record;
}

// A one-page PDF with a title line, so attachment fields hold real files.
function pdf(title, subtitle) {
  const esc = (text) => text.replace(/[\\()]/g, (c) => `\\${c}`);
  const stream = `BT /F1 20 Tf 72 760 Td (${esc(title)}) Tj ET\nBT /F1 12 Tf 72 730 Td (${esc(subtitle)}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(body)); body += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body);
}
async function upload(objectKey, fieldKey, name, bytes) {
  const signed = await service.signUpload(context, { fieldId: fid(objectKey, fieldKey), name, size: bytes.length, type: "application/pdf" });
  const { error } = await db.storage.from("workspace").uploadToSignedUrl(signed.path, signed.token, bytes, { contentType: "application/pdf" });
  if (error) throw error;
  return signed.file;
}

// ---------------------------------------------------------------- the workspace
const TRACKS = ["Computer vision", "NLP", "Reinforcement learning", "ML systems", "Responsible AI"];
const COUNTRIES = ["Portugal", "Germany", "India", "Kenya", "Japan", "Brazil", "United States", "Singapore", "United Kingdom", "Canada"];

async function buildStructure() {
  await run("object.create", {
    object: { name: "Person", plural: "People", icon: "users", numberPrefix: "PER", statuses: statuses([["Invited", "gray"], ["Confirmed", "green"], ["Declined", "red"]]) },
    fields: [
      field("Name", "short_text", {}, { required: true }),
      field("Email", "email", {}, { isUnique: true }),
      field("Affiliation", "short_text"),
      field("Country", "single_select", { options: options(COUNTRIES) }),
      field("Roles", "multi_select", { options: options(["Author", "Reviewer", "Session chair", "Keynote", "Volunteer", "Programme chair"], ["blue", "violet", "amber", "green", "teal", "red"]) }),
      field("Expertise", "multi_select", { options: options(TRACKS) }),
      field("Phone", "phone"),
      field("Website", "url"),
      field("Bio", "rich_text"),
      field("Travel grant", "currency", { currency: "EUR", min: 0 }),
      field("Contact", "link_event", { target: "contact", multiple: false }),
      field("Ticket", "link_event", { target: "ticket", multiple: false }),
      field("Order", "link_event", { target: "order", multiple: false }),
    ],
    titleFieldKey: "name",
  });
  await run("object.create", {
    object: { name: "Paper", plural: "Papers", icon: "file-text", numberPrefix: "PAP",
      statuses: statuses([["Submitted", "gray"], ["Under review", "blue"], ["Accepted", "green"], ["Revise", "amber"], ["Rejected", "red"], ["Withdrawn", "gray"]]) },
    fields: [
      field("Title", "short_text", { maxLength: 200 }, { required: true }),
      field("Submission ID", "short_text", { maxLength: 20 }, { isUnique: true }),
      field("Abstract", "long_text", { maxWords: 250 }, { required: true }),
      field("Track", "single_select", { options: options(TRACKS) }),
      field("Keywords", "multi_select", { options: options(["Transformers", "Diffusion", "Robotics", "Fairness", "Efficiency", "Healthcare", "Benchmarks", "Federated learning"]) }),
      field("Format", "single_select", { options: options(["Oral", "Poster", "Lightning", "Workshop"], ["green", "blue", "amber", "violet"]) }),
      field("Submitted on", "date"),
      field("Pages", "number", { decimals: 0, min: 1, max: 20 }),
      field("Similarity", "percent", { decimals: 0, min: 0, max: 100 }),
      field("Camera-ready", "checkbox"),
      field("Paper PDF", "attachments", { maxFiles: 2, accept: ["application/pdf"] }),
      field("Decision note", "rich_text"),
      field("Award", "single_select", { options: options(["Best paper", "Best student paper", "Honourable mention"], ["amber", "violet", "teal"]) }),
      field("Corresponding author", "link_event", { target: "contact", multiple: false }),
      field("Days since submission", "formula", { expression: "DATEDIFF({Submitted on}, TODAY())", result: "number" }),
      field("Slot label", "formula", { expression: "IF(ISBLANK({Format}), \"Not placed\", {Format} & \" · \" & {Track})", result: "text" }),
    ],
    titleFieldKey: "title",
  });
  await run("object.create", {
    object: { name: "Review", plural: "Reviews", icon: "star", numberPrefix: "REV", statuses: statuses([["Assigned", "gray"], ["In progress", "blue"], ["Submitted", "green"]]) },
    fields: [
      field("Originality", "rating", { max: 5 }),
      field("Clarity", "rating", { max: 5 }),
      field("Relevance", "rating", { max: 5 }),
      field("Overall score", "formula", { expression: "IF(ISBLANK({Originality}), BLANK(), ROUND(({Originality} + {Clarity} + {Relevance}) / 15 * 100))", result: "number" }),
      field("Headline", "formula", { expression: "IF(ISBLANK({Overall score}), \"Awaiting scores\", \"Scored \" & {Overall score} & \" of 100\")", result: "text" }),
      field("Recommendation", "single_select", { options: options(["Strong accept", "Accept", "Weak accept", "Weak reject", "Reject"], ["green", "green", "teal", "amber", "red"]) }),
      field("Comments to authors", "long_text", { maxWords: 600 }),
      field("Confidential note", "long_text"),
      field("No conflict of interest", "checkbox"),
      field("Due", "date"),
      field("Time spent", "duration"),
    ],
    titleFieldKey: "headline",
  });
  await run("object.create", {
    object: { name: "Session", plural: "Sessions", icon: "presentation", numberPrefix: "SES", statuses: statuses([["Draft", "gray"], ["Scheduled", "blue"], ["Live", "green"], ["Done", "gray"]]) },
    fields: [
      field("Title", "short_text", {}, { required: true }),
      field("Type", "single_select", { options: options(["Keynote", "Oral session", "Poster session", "Workshop", "Panel"], ["green", "blue", "teal", "violet", "amber"]) }),
      field("Track", "single_select", { options: options(["Plenary", ...TRACKS]) }),
      field("Starts", "datetime"),
      field("Length", "duration"),
      field("Room", "link_event", { target: "venue_space", multiple: false }),
      field("Capacity", "number", { decimals: 0, min: 0 }),
      field("Livestream", "url"),
      field("Room setup", "long_text"),
    ],
    titleFieldKey: "title",
  });
  await run("object.create", {
    object: { name: "Attendance mark", plural: "Attendance", icon: "user-check", numberPrefix: "ATT", statuses: statuses([["Present", "green"], ["Absent", "red"], ["Excused", "amber"]]) },
    fields: [
      field("Role in session", "single_select", { options: options(["Presenter", "Chair", "Attendee"], ["blue", "amber", "gray"]) }),
      field("Marked at", "datetime"),
      field("Marked by", "link_event", { target: "team_member", multiple: false }),
      field("Note", "short_text"),
    ],
  });
  await run("object.create", {
    object: { name: "Certificate", plural: "Certificates", icon: "award", numberPrefix: "CERT", statuses: statuses([["Draft", "gray"], ["Issued", "green"], ["Revoked", "red"]]) },
    fields: [
      field("Certificate no.", "short_text", { maxLength: 30 }, { required: true, isUnique: true }),
      field("Kind", "single_select", { options: options(["Attendance", "Presenter", "Reviewer", "Best paper"], ["gray", "blue", "violet", "amber"]) }),
      field("CPD hours", "number", { decimals: 1, min: 0 }),
      field("Issued on", "date"),
      field("Verify at", "url"),
      field("Sent", "checkbox"),
      field("PDF", "attachments", { maxFiles: 1, accept: ["application/pdf"] }),
    ],
    titleFieldKey: "certificate_no",
  });
  await run("object.create", {
    object: { name: "Task", plural: "Tasks", icon: "list-checks", numberPrefix: "TSK", statuses: statuses([["To do", "gray"], ["Doing", "blue"], ["Done", "green"]]) },
    fields: [
      field("Task", "short_text", {}, { required: true }),
      field("Owner", "link_event", { target: "team_member", multiple: false }),
      field("Due", "date"),
      field("Priority", "single_select", { options: options(["High", "Medium", "Low"], ["red", "amber", "gray"]) }),
      field("Notes", "long_text"),
    ],
    titleFieldKey: "task",
  });
  await refresh();

  // Attendance has no text title: records are known by number (ATT-1, ATT-2…).
  const attendance = objectByKey("attendance_mark");
  await run("object.update", { objectId: attendance.id, expectedRevision: attendance.revision, patch: { titleFieldId: null } });
  await refresh();

  // Links between lists, then the lookups and rollups that read through them.
  const link = async (objectKey, name, target, multiple) => run("field.create", { objectId: objectByKey(objectKey).id,
    field: field(name, "link_record", { targetObjectId: objectByKey(target).id, multiple }) });
  await link("paper", "Authors", "person", true);
  await link("paper", "Reviews", "review", true);
  await link("review", "Paper", "paper", false);
  await link("review", "Reviewer", "person", false);
  await link("session", "Chair", "person", false);
  await link("session", "Papers", "paper", true);
  await link("attendance_mark", "Person", "person", false);
  await link("attendance_mark", "Session", "session", false);
  await link("certificate", "Recipient", "person", false);
  await link("task", "Related session", "session", false);
  await refresh();
  const computed = async (objectKey, name, type, config) => { await run("field.create", { objectId: objectByKey(objectKey).id, field: field(name, type, config) }); await refresh(); };
  await computed("paper", "Review count", "rollup", { linkFieldId: fid("paper", "reviews"), fn: "count" });
  await computed("paper", "Average score", "rollup", { linkFieldId: fid("paper", "reviews"), targetFieldId: fid("review", "overall_score"), fn: "avg" });
  await computed("paper", "Highest score", "rollup", { linkFieldId: fid("paper", "reviews"), targetFieldId: fid("review", "overall_score"), fn: "max" });
  await computed("paper", "Recommendations", "lookup", { linkFieldId: fid("paper", "reviews"), targetFieldId: fid("review", "recommendation") });
  await computed("review", "Paper track", "lookup", { linkFieldId: fid("review", "paper"), targetFieldId: fid("paper", "track") });
  await computed("session", "Paper count", "rollup", { linkFieldId: fid("session", "papers"), fn: "count" });
  await computed("session", "Paper titles", "lookup", { linkFieldId: fid("session", "papers"), targetFieldId: fid("paper", "title") });
  await refresh();
  log(`structure: ${definition.objects.length} lists, ${definition.fields.filter((f) => !f.deletedAt).length} fields`);
}

const PAPERS = [
  // title, track, format, status, keywords, authors (people index), pages, similarity, award, cameraReady
  ["Sparse Mixture-of-Experts for Low-Power Vision Transformers", "Computer vision", "Oral", "Accepted", ["Transformers", "Efficiency"], [0, 7], 9, 6, "Best paper", true],
  ["Auditing Toxicity Filters Across 40 African Languages", "NLP", "Oral", "Accepted", ["Fairness", "Benchmarks"], [3, 10], 11, 4, "Best student paper", true],
  ["Offline RL for Warehouse Robots with Safety Constraints", "Reinforcement learning", "Oral", "Accepted", ["Robotics"], [4, 9], 10, 8, null, true],
  ["Serving 70B Models on Commodity GPUs with Paged Attention", "ML systems", "Oral", "Accepted", ["Transformers", "Efficiency"], [1, 6], 12, 3, "Honourable mention", true],
  ["Clinical Note Summarisation Without Patient Data Leaving the Hospital", "NLP", "Poster", "Accepted", ["Healthcare", "Federated learning"], [5, 12], 8, 11, null, false],
  ["Diffusion-Based Data Augmentation for Rare Skin Lesions", "Computer vision", "Poster", "Accepted", ["Diffusion", "Healthcare"], [11, 0], 7, 9, null, true],
  ["Measuring Disparate Impact in Credit-Scoring Pipelines", "Responsible AI", null, "Under review", ["Fairness"], [8, 3], 9, 14, null, false],
  ["Curriculum Learning for Multi-Agent Traffic Control", "Reinforcement learning", null, "Under review", ["Robotics", "Benchmarks"], [9], 10, 5, null, false],
  ["Quantised Speech Recognition for Low-Resource Languages", "NLP", null, "Under review", ["Efficiency"], [2, 12], 8, 7, null, false],
  ["Energy Accounting for Distributed Training Jobs", "ML systems", "Lightning", "Revise", ["Efficiency", "Benchmarks"], [13], 6, 18, null, false],
  ["Self-Supervised Depth Estimation from Dashcam Video", "Computer vision", null, "Revise", ["Robotics"], [7], 9, 22, null, false],
  ["A Benchmark That Mostly Measures Prompt Length", "NLP", null, "Rejected", ["Benchmarks"], [12], 5, 31, null, false],
  ["Fairness Constraints That Do Not Transfer", "Responsible AI", null, "Rejected", ["Fairness"], [8], 6, 12, null, false],
  ["Federated Fine-Tuning on Mobile Keyboards", "ML systems", null, "Withdrawn", ["Federated learning"], [1], 8, 9, null, false],
];
const REVIEWERS = [14, 15, 16, 17, 18, 19, 20, 2];
const ABSTRACT = (title, track) => `We study ${title.charAt(0).toLowerCase()}${title.slice(1)} within ${track.toLowerCase()}. Our method is evaluated on public benchmarks and two industrial datasets, where it improves accuracy while reducing compute. We release code, trained models and an evaluation protocol so others can reproduce the results, and discuss limitations and the conditions under which the approach should not be used.`;

async function buildRecords(team) {
  const people = [];
  for (const [i, [name, affiliation, country, roles, expertise, ticket, grant]] of PEOPLE.entries()) {
    people.push(await createRecord("person", {
      name, email: emailOf(name), affiliation, country: opt(country), roles: roles.map(opt), expertise: expertise.length ? expertise.map(opt) : undefined,
      phone: `+351 21 ${String(4000000 + i * 1371).slice(0, 3)} ${String(1000 + i * 37).slice(0, 4)}`,
      website: `https://example.edu/~${emailOf(name).split("@")[0]}`,
      bio: roles.includes("Keynote") ? `<p><strong>${name}</strong> leads research at ${affiliation}.</p><ul><li>Area chair at three major venues</li><li>Advises on AI policy</li></ul>` : undefined,
      travel_grant: grant || undefined,
      contact: [id("9c10", i + 1)],
      ticket: ticket ? [id("9c11", i + 1)] : undefined,
      order: ticket ? [id("9c12", i + 1)] : undefined,
    }, roles.includes("Reviewer") || roles.includes("Keynote") || i % 4 ? "Confirmed" : "Invited"));
  }
  log(`people: ${people.length}`);

  const papers = [];
  for (const [i, [title, track, , , keywords, authors, pages, similarity]] of PAPERS.entries()) {
    const files = i < 6 ? [await upload("paper", "paper_pdf", `ICAML26-${String(i + 1).padStart(3, "0")}.pdf`, pdf(title, `ICAML 2026 submission ${i + 1} · ${track}`))] : undefined;
    papers.push(await createRecord("paper", {
      title, submission_id: `ICAML26-${String(i + 1).padStart(3, "0")}`, abstract: ABSTRACT(title, track), track: opt(track),
      keywords: keywords.map(opt), submitted_on: `2026-07-${String(1 + i * 2).padStart(2, "0")}`, pages, similarity,
      authors: authors.map((n) => people[n].id), corresponding_author: [id("9c10", authors[0] + 1)], paper_pdf: files,
    }, "Submitted"));
  }
  log(`papers: ${papers.length}`);

  const reviews = [];
  const RECS = ["Strong accept", "Accept", "Weak accept", "Weak reject", "Reject"];
  for (const [p, [, , , status]] of PAPERS.entries()) {
    if (status === "Withdrawn") continue;
    const count = status === "Under review" ? 2 : 3;
    const mine = [];
    for (let r = 0; r < count; r++) {
      const reviewer = people[REVIEWERS[(p + r * 3) % REVIEWERS.length]];
      const done = !(status === "Under review" && r === 1);
      const base = status === "Accepted" ? 4 : status === "Rejected" ? 2 : 3;
      const score = (k) => Math.max(1, Math.min(5, base + ((p * 5 + r * 3 + k * k + p * k) % 4) - 1));
      const rec = status === "Accepted" ? RECS[(p + r) % 3] : status === "Rejected" ? RECS[3 + ((p + r) % 2)] : RECS[1 + ((p + r) % 3)];
      const review = await createRecord("review", {
        paper: [papers[p].id], reviewer: [reviewer.id], due: "2026-09-15", no_conflict_of_interest: true,
        ...(done ? {
          originality: score(0), clarity: score(1), relevance: score(2), recommendation: opt(rec), time_spent: 3600 + ((p * 7 + r * 13) % 6) * 900,
          comments_to_authors: "Clear motivation and a careful evaluation. Please add an ablation on the main design choice and report variance over seeds.",
          confidential_note: r === 0 ? "Strong submission; would champion it in the discussion." : undefined,
        } : {}),
      }, done ? "Submitted" : "In progress");
      mine.push(review);
      reviews.push(review);
    }
    await updateRecord("paper", papers[p], { reviews: mine.map((review) => review.id) }, "Under review");
  }
  log(`reviews: ${reviews.length}`);

  // Decisions: the status history now reads Submitted → Under review → decision.
  for (const [p, [, , format, status, , , , , award, cameraReady]] of PAPERS.entries()) {
    if (status === "Under review") continue;
    await updateRecord("paper", papers[p], {
      ...(format ? { format: opt(format) } : {}),
      ...(award ? { award: opt(award) } : {}),
      ...(cameraReady ? { camera_ready: true } : {}),
      ...(status === "Accepted" ? { decision_note: `<p>Accepted as <strong>${format.toLowerCase()}</strong>. The programme committee praised the evaluation; please address reviewer 2's ablation request in the camera-ready.</p>` } : {}),
      ...(status === "Revise" ? { decision_note: "<p>Major revision. Resubmit with the additional experiments by <em>30 October</em>.</p>" } : {}),
    }, status);
  }

  const DAY = (d, time) => `2026-12-${String(d).padStart(2, "0")}T${time}:00+00:00`;
  const SESSIONS = [
    ["Opening keynote: Machine learning that ships", "Keynote", "Plenary", DAY(8, "09:00"), 3600, 1, 14, [], "Scheduled", "Stage with lectern, two lapel mics, confidence monitor."],
    ["Efficient models", "Oral session", "ML systems", DAY(8, "11:00"), 5400, 2, 23, [0, 3], "Scheduled", "Theatre style, projector, timer for 15+5 minute talks."],
    ["Language and fairness", "Oral session", "NLP", DAY(8, "14:00"), 5400, 2, 14, [1], "Scheduled", null],
    ["Robots and agents", "Oral session", "Reinforcement learning", DAY(9, "10:00"), 5400, 3, 16, [2], "Scheduled", null],
    ["Poster session A", "Poster session", "Plenary", DAY(9, "15:00"), 7200, 4, 0, [4, 5], "Scheduled", "40 poster boards, A0 portrait. Pins and tape at the help desk."],
    ["Hands-on: Evaluating LLMs responsibly", "Workshop", "Responsible AI", DAY(10, "09:30"), 10800, 5, 18, [], "Draft", "Laptops required. 60 seats, power at every desk."],
    ["Closing panel: What should we stop benchmarking?", "Panel", "Plenary", DAY(10, "16:00"), 3600, 1, 20, [], "Draft", null],
  ];
  const rooms = SPACES.map((_, i) => id("9c01", i + 1));
  const sessions = [];
  for (const [title, type, track, starts, length, room, chair, paperIdx, status, setup] of SESSIONS) {
    sessions.push(await createRecord("session", {
      title, type: opt(type), track: opt(track), starts, length, room: [rooms[room - 1]],
      chair: [people[chair].id], papers: paperIdx.length ? paperIdx.map((n) => papers[n].id) : undefined,
      capacity: [900, 180, 160, 400, 60][room - 1], livestream: type === "Keynote" || type === "Panel" ? "https://stream.example.edu/icaml26/plenary" : undefined,
      room_setup: setup ?? undefined,
    }, status));
  }
  log(`sessions: ${sessions.length}`);

  const marks = [];
  const markedBy = team[0] ? [team[0]] : undefined;
  const presence = [
    [6, 0, "Presenter", "Present"], [23, 1, "Chair", "Present"], [0, 1, "Presenter", "Present"], [1, 1, "Presenter", "Present"],
    [14, 2, "Chair", "Present"], [3, 2, "Presenter", "Present"], [10, 2, "Presenter", "Absent"], [16, 3, "Chair", "Present"],
    [4, 3, "Presenter", "Present"], [9, 3, "Presenter", "Excused"], [5, 4, "Presenter", "Present"], [11, 4, "Presenter", "Present"],
    [21, 4, "Attendee", "Present"], [22, 4, "Attendee", "Present"],
  ];
  for (const [person, session, role, status] of presence) {
    marks.push(await createRecord("attendance_mark", {
      person: [people[person].id], session: [sessions[session].id], role_in_session: opt(role),
      marked_at: SESSIONS[session][3], marked_by: markedBy,
      note: status === "Absent" ? "Flight cancelled; co-author presented instead." : status === "Excused" ? "Visa delay, recorded talk played." : undefined,
    }, status));
  }
  log(`attendance marks: ${marks.length}`);

  const certificates = [];
  const certs = [
    [0, "Best paper", 3, "Issued"], [3, "Best student paper", 3, "Issued"], [0, "Presenter", 6, "Issued"], [1, "Presenter", 6, "Issued"],
    [3, "Presenter", 6, "Issued"], [4, "Presenter", 6, "Issued"], [14, "Reviewer", 4, "Issued"], [15, "Reviewer", 4, "Issued"],
    [21, "Attendance", 18, "Draft"], [22, "Attendance", 18, "Draft"], [10, "Presenter", 0, "Revoked"],
  ];
  for (const [n, [person, kind, hours, status]] of certs.entries()) {
    const no = `ICAML26-${kind.slice(0, 3).toUpperCase()}-${String(n + 1).padStart(4, "0")}`;
    const file = n < 2 ? [await upload("certificate", "pdf", `${no}.pdf`, pdf(`Certificate — ${kind}`, `${PEOPLE[person][0]} · ICAML 2026, Lisbon`))] : undefined;
    certificates.push(await createRecord("certificate", {
      certificate_no: no, recipient: [people[person].id], kind: opt(kind === "Best student paper" ? "Best paper" : kind), cpd_hours: hours || undefined,
      issued_on: status === "Draft" ? undefined : "2026-12-10", verify_at: `https://verify.example.edu/icaml26/${no}`, pdf: file,
    }, status));
  }
  log(`certificates: ${certificates.length}`);

  const TASKS = [
    ["Send acceptance emails", "2026-09-30", "High", null, "Done"], ["Collect camera-ready PDFs", "2026-10-31", "High", null, "Doing"],
    ["Print 40 poster boards", "2026-11-25", "Medium", 4, "To do"], ["Brief session chairs on timing", "2026-12-07", "Medium", 1, "To do"],
    ["Test livestream in Auditorium Tejo", "2026-12-07", "High", 0, "To do"], ["Order workshop laptops", "2026-11-20", "Low", 5, "Doing"],
    ["Publish the proceedings", "2026-12-20", "Medium", null, "To do"], ["Issue attendance certificates", "2026-12-12", "High", null, "To do"],
  ];
  for (const [i, [task, due, priority, session, status]] of TASKS.entries()) {
    await createRecord("task", {
      task, due, priority: opt(priority), owner: team.length ? [team[i % team.length]] : undefined,
      related_session: session !== null ? [sessions[session].id] : undefined,
      notes: i === 1 ? "Two papers still missing; chase the corresponding authors." : undefined,
    }, status);
  }
  log(`tasks: ${TASKS.length}`);
  return { people, papers, reviews, sessions, certificates };
}

async function buildViewsAndHistory({ papers, reviews, certificates }) {
  const view = (objectKey, name, config, shared = true) => run("view.save", { objectId: objectByKey(objectKey).id, name, shared, config });
  const cols = (objectKey, keys, widths = {}) => keys.map((key) => ({ fieldId: fid(objectKey, key), ...(widths[key] ? { width: widths[key] } : {}) }));
  await view("paper", "Review pipeline", { kind: "board", columns: cols("paper", ["track", "format", "average_score", "review_count"]) });
  await view("paper", "Accepted orals", {
    kind: "table", columns: cols("paper", ["title", "track", "average_score", "highest_score", "award", "camera_ready", "authors"], { title: 320 }),
    filter: { op: "and", items: [{ field: "status", operator: "eq", value: statusKey("paper", "Accepted") }, { field: fid("paper", "format"), operator: "any_of", value: [opt("Oral")] }] },
    sort: [{ field: fid("paper", "average_score"), dir: "desc" }],
  });
  await view("paper", "Needs a decision", {
    kind: "table", columns: cols("paper", ["title", "track", "review_count", "average_score", "recommendations"]),
    filter: { op: "and", items: [{ field: "status", operator: "any_of", value: [statusKey("paper", "Under review"), statusKey("paper", "Revise")] }] },
    sort: [{ field: fid("paper", "average_score"), dir: "desc" }],
  });
  await view("paper", "By track", { kind: "table", columns: cols("paper", ["title", "format", "average_score"]), groupBy: fid("paper", "track") });
  await view("paper", "My shortlist", { kind: "table", columns: cols("paper", ["title", "award", "average_score"]), filter: { op: "or", items: [{ field: fid("paper", "award"), operator: "is_not_empty" }, { field: fid("paper", "average_score"), operator: "gte", value: 80 }] } }, false);
  await view("review", "Outstanding", { kind: "table", columns: cols("review", ["paper", "reviewer", "due"]), filter: { op: "and", items: [{ field: "status", operator: "neq", value: statusKey("review", "Submitted") }] }, sort: [{ field: fid("review", "due"), dir: "asc" }] });
  await view("review", "By recommendation", { kind: "board", columns: cols("review", ["paper", "reviewer", "overall_score"]), groupBy: fid("review", "recommendation") });
  await view("person", "Reviewers", { kind: "table", columns: cols("person", ["name", "affiliation", "expertise", "country"]), filter: { op: "and", items: [{ field: fid("person", "roles"), operator: "has_any", value: [opt("Reviewer")] }] } });
  await view("person", "Travel grants", { kind: "table", columns: cols("person", ["name", "country", "travel_grant", "ticket"]), filter: { op: "and", items: [{ field: fid("person", "travel_grant"), operator: "gt", value: 0 }] }, sort: [{ field: fid("person", "travel_grant"), dir: "desc" }] });
  await view("session", "Programme by day", { kind: "table", columns: cols("session", ["starts", "length", "room", "type", "paper_count", "chair"]), sort: [{ field: fid("session", "starts"), dir: "asc" }] });
  await view("session", "By type", { kind: "board", columns: cols("session", ["starts", "room"]), groupBy: fid("session", "type") });
  await view("attendance_mark", "Not present", { kind: "table", columns: cols("attendance_mark", ["person", "session", "note"]), filter: { op: "and", items: [{ field: "status", operator: "neq", value: statusKey("attendance_mark", "Present") }] } });
  await view("certificate", "To send", { kind: "table", columns: cols("certificate", ["recipient", "kind", "issued_on"]), filter: { op: "and", items: [{ field: "status", operator: "eq", value: statusKey("certificate", "Issued") }, { field: fid("certificate", "sent"), operator: "is_false" }] } });
  await view("task", "Task board", { kind: "board", columns: cols("task", ["owner", "due", "priority"]) });
  log("saved views: 14 (13 shared, 1 personal)");

  // Team conversation on records.
  await run("comment.add", { recordId: papers[0].id, body: "Programme committee agreed this is our best-paper pick. Can we give it the first oral slot?" });
  await run("comment.add", { recordId: papers[0].id, body: "Done — moved to the first talk of Efficient models." });
  await run("comment.add", { recordId: papers[9].id, body: "Authors asked for a one-week extension on the revision. Approved." });
  await run("comment.add", { recordId: reviews[0].id, body: "Thanks for the quick turnaround on this one." });

  // A bulk edit: mark the issued certificates as sent.
  const issued = certificates.slice(0, 6).map((record) => record.id);
  await run("records.bulk", { recordIds: issued, values: { [fid("certificate", "sent")]: true } });

  // The trash: a spam submission and a field that was added and then removed.
  const spam = await createRecord("paper", { title: "Buy followers now", submission_id: "ICAML26-999", abstract: "Spam submission received through the form.", track: opt("NLP") }, "Submitted");
  await run("records.delete", { recordIds: [spam.id] });
  await run("field.create", { objectId: objectByKey("paper").id, field: field("Legacy CMS ID", "short_text") });
  await refresh();
  await run("field.delete", { fieldId: fid("paper", "legacy_cms_id") });
  await refresh();
  log("comments, a bulk edit and two items in the trash");

  const templates = await copy.templates(context);
  if (!templates.some((template) => template.name === "Research conference (ICAML)")) {
    await copy.saveTemplate(context, { name: "Research conference (ICAML)", description: "Papers, reviews, sessions, attendance, certificates and tasks, with the review pipeline and programme views." });
  }
  log("template: Research conference (ICAML)");
}

// ---------------------------------------------------------------- the portal
const portalStaff = createPortalStaff();
async function portalRun(action, payload) {
  return portalStaff.command(context, { action, ...payload });
}

// Blocks for a stacked page: rows of columns, each column a list of blocks.
function stacked(rows) {
  const out = { rows: [], blocks: [] };
  for (const columns of rows) {
    const row = { id: newRowId(), widths: columns.map((column) => column.width) };
    out.rows.push(row);
    columns.forEach((column, col) => column.blocks.forEach((block, order) => out.blocks.push({ id: newBlockId(), ...block, at: { row: row.id, col, order } })));
  }
  return out;
}
const full = (...blocks) => [{ width: 12, blocks }];

async function buildPortal() {
  const people = objectByKey("person");
  const me = (objectKey, fieldKey) => ({ field: fid(objectKey, fieldKey), operator: "has_any", value: ["@me"] });
  const roleIs = (label) => ({ op: "and", items: [{ field: fid("person", "roles"), operator: "has_any", value: [opt(label)] }] });
  const levels = (objectKey, map) => Object.fromEntries(Object.entries(map).map(([key, level]) => [fid(objectKey, key), level]));
  const where = (...items) => ({ mode: "where", filter: { op: "and", items } });
  const related = (fieldId, direction, ...items) => ({ related: fieldId, direction, match: { op: "and", items } });
  const ALL = { mode: "all" };
  const NONE = { mode: "none" };
  const access = (view, extra = {}) => ({ view, create: NONE, edit: NONE, delete: NONE, comment: false, status: false, fields: {}, ...extra });

  await portalRun("portal.update", { patch: {
    peopleObjectId: people.id, emailFieldId: fid("person", "email"), nameFieldId: fid("person", "name"), signupEnabled: true,
    settings: { welcome: "Reviewers, authors and session chairs: sign in with the email the programme committee has for you. We'll send you a code — no password needed.", contact: "programme@icaml.example.org" },
  } });

  const ownProfile = access(where({ field: fid("person", "email"), operator: "eq", value: "@my_email" }), {
    edit: where({ field: fid("person", "email"), operator: "eq", value: "@my_email" }),
    fields: levels("person", { name: "read", email: "read", affiliation: "edit", phone: "edit", website: "edit", bio: "edit", country: "edit", expertise: "edit",
      roles: "read", travel_grant: "hidden", contact: "hidden", ticket: "hidden", order: "hidden" }),
  });
  const publicPaper = levels("paper", { submission_id: "hidden", abstract: "read", keywords: "read", submitted_on: "hidden", pages: "hidden", similarity: "hidden",
    camera_ready: "hidden", paper_pdf: "hidden", decision_note: "hidden", corresponding_author: "hidden", authors: "hidden", reviews: "hidden",
    days_since_submission: "hidden", review_count: "hidden", average_score: "hidden", highest_score: "hidden", recommendations: "hidden" });
  const programme = access(ALL, { fields: levels("session", { chair: "hidden", capacity: "hidden", room_setup: "hidden", papers: "hidden" }) });

  const roleId = async (role) => (await portalRun("role.save", { role })).role.id;
  const state = await portalStaff.state(context);
  const publicRole = state.roles.find((role) => role.key === "public");
  const signedIn = state.roles.find((role) => role.key === "signed_in");
  await portalRun("role.save", { role: { id: publicRole.id, access: {
    [objectByKey("session").id]: programme,
    [objectByKey("paper").id]: access(where({ field: "status", operator: "eq", value: statusKey("paper", "Accepted") }), { fields: publicPaper }),
  } } });
  await portalRun("role.save", { role: { id: signedIn.id, access: { [people.id]: ownProfile } } });

  // Blind review: reviewers see their own reviews and the papers they review, never who wrote them.
  const reviewer = await roleId({ name: "Reviewer", icon: "glasses", color: "violet", membership: roleIs("Reviewer"), access: {
    [objectByKey("review").id]: access(where(me("review", "reviewer")), {
      edit: where(me("review", "reviewer"), { field: "status", operator: "neq", value: statusKey("review", "Submitted") }),
      status: true, comment: true,
      fields: levels("review", { originality: "edit", clarity: "edit", relevance: "edit", recommendation: "edit", comments_to_authors: "edit", confidential_note: "edit",
        no_conflict_of_interest: "edit", time_spent: "edit", due: "read", paper: "read", reviewer: "hidden" }),
    }),
    [objectByKey("paper").id]: access(where(related(fid("review", "paper"), "back", me("review", "reviewer"))), {
      fields: levels("paper", { authors: "hidden", corresponding_author: "hidden", decision_note: "hidden", award: "hidden", reviews: "hidden", similarity: "hidden",
        recommendations: "hidden", average_score: "hidden", highest_score: "hidden", review_count: "hidden", camera_ready: "hidden", submission_id: "hidden" }),
    }),
  } });

  // Authors: their own papers (editable while submitted or in revision) and the finished reviews of them, anonymised.
  const author = await roleId({ name: "Author", icon: "pen-line", color: "blue", membership: roleIs("Author"), access: {
    [objectByKey("paper").id]: access(where(me("paper", "authors")), {
      create: ALL, comment: true,
      edit: where(me("paper", "authors"), { field: "status", operator: "any_of", value: [statusKey("paper", "Submitted"), statusKey("paper", "Revise")] }),
      fields: levels("paper", { title: "edit", abstract: "edit", keywords: "edit", track: "edit", paper_pdf: "edit", pages: "edit", camera_ready: "edit",
        reviews: "hidden", recommendations: "hidden", average_score: "hidden", highest_score: "hidden", review_count: "hidden", similarity: "hidden", corresponding_author: "hidden" }),
    }),
    [objectByKey("review").id]: access(where({ field: "status", operator: "eq", value: statusKey("review", "Submitted") }, related(fid("review", "paper"), "forward", me("paper", "authors"))), {
      fields: levels("review", { reviewer: "hidden", confidential_note: "hidden", no_conflict_of_interest: "hidden", time_spent: "hidden", due: "hidden" }),
    }),
    [objectByKey("session").id]: access(ALL, { fields: levels("session", { capacity: "hidden", room_setup: "hidden" }) }),
  } });

  // Session chairs: every session, attendance for the ones they chair, and the names of the people in them.
  const chairsSession = related(fid("attendance_mark", "session"), "forward", me("session", "chair"));
  const chair = await roleId({ name: "Session chair", icon: "mic", color: "amber", membership: roleIs("Session chair"), access: {
    [objectByKey("session").id]: access(ALL, { edit: where(me("session", "chair")), fields: levels("session", { room_setup: "edit" }) }),
    [objectByKey("attendance_mark").id]: access(where(chairsSession), {
      create: ALL, status: true, edit: where(chairsSession),
      fields: levels("attendance_mark", { note: "edit", marked_at: "edit", role_in_session: "read", marked_by: "hidden" }),
    }),
    [people.id]: access(where(related(fid("attendance_mark", "person"), "back", chairsSession)), {
      fields: levels("person", { email: "hidden", phone: "hidden", website: "hidden", bio: "hidden", travel_grant: "hidden", roles: "hidden", expertise: "hidden", contact: "hidden", ticket: "hidden", order: "hidden" }),
    }),
  } });

  const pc = await roleId({ name: "Programme chair", icon: "gavel", color: "red", membership: roleIs("Programme chair"), access: {
    [objectByKey("paper").id]: access(ALL, { edit: ALL, status: true, comment: true,
      fields: levels("paper", { decision_note: "edit", award: "edit", format: "edit", corresponding_author: "hidden" }) }),
    [objectByKey("review").id]: access(ALL, { comment: true }),
    [people.id]: access(ALL, { fields: levels("person", { travel_grant: "hidden", contact: "hidden", ticket: "hidden", order: "hidden", phone: "hidden" }) }),
  } });
  log("portal roles: public, signed in, Reviewer, Author, Session chair, Programme chair");

  const page = async (input) => (await portalRun("page.save", { page: { layout: "blocks", icon: "file", ...input } })).page;
  const audience = (roles, extra = {}) => ({ roles, public: false, team: false, nav: true, ...extra });
  const sessions = objectByKey("session").id;
  const reviews = objectByKey("review").id;
  const papers = objectByKey("paper").id;
  // A person has several roles at once (everyone is also a public visitor), so "my" lists filter to their own records.
  const mine = { op: "and", items: [me("review", "reviewer")] };

  // The programme as a schedule block: sessions by start, length and room, with the track as a coloured dot and the type as a tag.
  const programmeOf = (view, extra = {}) => ({
    kind: "schedule", config: {
      title: "", source: { objectId: sessions, filter: null, sort: [] }, startField: fid("session", "starts"), endField: null, durationField: fid("session", "length"),
      laneField: fid("session", "room"), peopleField: null, startDate: "first", days: 3, open: false, fields: [fid("session", "track"), fid("session", "type")], view, more: null, ...extra,
    },
  });
  const help = (extra = "") => ({ kind: "text", config: { html: `<h3>Need help?</h3><p>Write to <a href="mailto:programme@icaml.example.org">programme@icaml.example.org</a>.${extra}</p>`, align: "left", card: true } });

  // Home opens with a Welcome block, so the page's own heading is off.
  await page({ title: "Home", slug: "home", icon: "house", audience: audience([], { public: true }), body: { ...stacked([
    full({ kind: "hero", config: {
      image: "", badge: "countdown", heading: "Welcome to ICAML 2026",
      text: "The International Conference on Applied Machine Learning, 8–10 December in Lisbon. Use this space to submit late-breaking posters, review papers, follow the programme and run your sessions.",
      buttons: [{ label: "Submit a poster", kind: "page", target: "submit", style: "primary" }, { label: "See the programme", kind: "page", target: "programme", style: "outline" }],
      facts: [
        { icon: "calendar", label: "When", value: "Mon 8 – Wed 10 December 2026" },
        { icon: "map-pin", label: "Where", value: "Harbourfront Congress Centre, Lisbon" },
        { icon: "clock", label: "Poster submissions close", value: "30 November, 11:59 PM" },
      ],
    } }),
    full({ kind: "notice", config: { icon: "megaphone", html: "<p><strong>New:</strong> registration for the workshop day opens on 20 November.</p>" } }),
    [
      { width: 8, blocks: [programmeOf("glance", { title: "Programme at a glance", fields: [fid("session", "track")], more: { label: "Full programme", page: "programme" } })] },
      { width: 4, blocks: [
        { kind: "dates", config: { title: "Key dates", items: [
          { date: "2026-11-20", label: "Workshop day registration opens", note: "" },
          { date: "2026-11-30", label: "Poster submissions close", note: "" },
          { date: "2026-12-08", label: "Conference opens in Lisbon", note: "" },
        ] } },
        help(" Reviewers: please finish by 15 September."),
      ] },
    ],
  ]), header: { hidden: true } } });

  await page({ title: "My reviews", slug: "my-reviews", icon: "glasses", audience: audience([reviewer]), body: stacked([
    full({ kind: "text", config: { html: "<p>Papers are anonymous: you won't see the authors, and they won't see you. Scores and comments are saved as you go; set the status to <strong>Submitted</strong> when you're done.</p>", align: "left" } }),
    full({ kind: "stats", config: { title: "", tiles: [
      { label: "Assigned to me", objectId: reviews, fn: "count", filter: mine },
      { label: "Submitted", objectId: reviews, fn: "percent", filter: mine, part: { op: "and", items: [{ field: "status", operator: "eq", value: statusKey("review", "Submitted") }] } },
      { label: "My average score", objectId: reviews, fn: "avg", fieldId: fid("review", "overall_score"), filter: mine },
    ] } }),
    full({ kind: "table", config: { title: "Reviews", source: { objectId: reviews, filter: mine, sort: [{ field: fid("review", "due"), dir: "asc" }] },
      columns: [fid("review", "paper"), "status", fid("review", "due"), fid("review", "recommendation"), fid("review", "overall_score")],
      search: false, filters: ["status"], pageSize: 20, open: true, emptyText: "No reviews assigned to you yet." } }),
  ]) });

  await page({ title: "Review", kind: "record", objectId: reviews, icon: "star", body: stacked([[
    { width: 8, blocks: [{ kind: "record", config: { title: "Your review", target: "page", objectId: reviews, files: true, comments: true, activity: true, edit: true, sections: [
      { title: "Scores", fields: ["originality", "clarity", "relevance", "recommendation"].map((key) => fid("review", key)) },
      { title: "Comments", fields: ["comments_to_authors", "confidential_note"].map((key) => fid("review", key)) },
      { title: "Declaration", fields: ["no_conflict_of_interest", "time_spent", "due"].map((key) => fid("review", key)) },
    ] } }] },
    { width: 4, blocks: [{ kind: "cards", config: { title: "The paper", source: { objectId: papers, filter: { op: "and", items: [{ field: fid("paper", "reviews"), operator: "has_any", value: ["@record"] }] }, sort: [] },
      cover: null, fields: ["track", "keywords", "abstract"].map((key) => fid("paper", key)), columns: 1, search: false, filters: [], pageSize: 3, open: true } }] },
  ]]) });

  // The form's title and intro live in the page heading, which also shows when submissions close.
  await page({ title: "Submit a poster", slug: "submit", icon: "send", audience: audience([author], { public: true }), body: { ...stacked([[
    { width: 8, blocks: [{ kind: "form", config: {
      title: "", intro: "",
      mode: "create", objectId: papers, steps: true, drafts: true, status: statusKey("paper", "Submitted"),
      sections: [
        { title: "Your poster", description: "Shown in the programme and on the poster board.", fields: [
          { fieldId: fid("paper", "title"), required: true, help: "" }, { fieldId: fid("paper", "abstract"), required: true, help: "Up to 250 words." },
          { fieldId: fid("paper", "track"), required: true, help: "" }, { fieldId: fid("paper", "paper_pdf"), required: true, help: "Two pages, PDF." },
        ] },
      ],
      defaults: [{ fieldId: fid("paper", "authors"), value: ["@me"] }, { fieldId: fid("paper", "submitted_on"), value: "@today" }, { fieldId: fid("paper", "format"), value: opt("Poster") }],
      closesAt: "2026-11-30T23:59:00.000Z", submitLabel: "Submit poster",
      success: { message: "Thanks — your poster is in. We'll email you when the committee decides.", page: "my-submissions" },
      signup: { enabled: true, objectId: people.id,
        personFields: [{ fieldId: fid("person", "name"), required: true, help: "" }, { fieldId: fid("person", "affiliation"), required: true, help: "" }, { fieldId: fid("person", "country"), required: false, help: "" }],
        personDefaults: [{ fieldId: fid("person", "roles"), value: [opt("Author")] }] },
    } }] },
    { width: 4, blocks: [
      { kind: "facts", config: { title: "Where it's presented", items: [
        { icon: "users", label: "Session", value: "Poster session A · Plenary" },
        { icon: "calendar", label: "When", value: "Tue 9 December, from 15:00" },
        { icon: "map-pin", label: "Where", value: "Poster Hall, Lisbon" },
      ] } },
      help(),
    ] },
  ]]), header: { title: "Late-breaking poster", description: "Two pages, PDF. Posters are presented in Poster session A on 9 December. New here? Fill in your details and confirm your email." } } });

  await page({ title: "My submissions", slug: "my-submissions", icon: "files", audience: audience([author]), body: stacked([
    full({ kind: "table", config: { title: "Papers", source: { objectId: papers, filter: { op: "and", items: [me("paper", "authors")] }, sort: [{ field: fid("paper", "submitted_on"), dir: "desc" }] },
      columns: ["status", fid("paper", "track"), fid("paper", "format"), fid("paper", "award")], search: false, filters: [], pageSize: 20, open: true, emptyText: "You haven't submitted anything yet." } }),
  ]) });

  await page({ title: "Paper", kind: "record", objectId: papers, icon: "file-text", body: stacked([
    full({ kind: "record", config: { title: "", target: "page", objectId: papers, files: true, comments: true, activity: true, edit: true, sections: [
      { title: "Paper", fields: ["title", "abstract", "track", "keywords", "format", "authors"].map((key) => fid("paper", key)) },
      { title: "Files", fields: ["paper_pdf", "pages", "camera_ready"].map((key) => fid("paper", key)) },
      { title: "Decision", fields: ["decision_note", "award"].map((key) => fid("paper", key)) },
    ] } }),
    full({ kind: "table", config: { title: "Reviews", source: { objectId: reviews, filter: { op: "and", items: [{ field: fid("review", "paper"), operator: "has_any", value: ["@record"] }] }, sort: [] },
      columns: ["status", fid("review", "recommendation"), fid("review", "overall_score"), fid("review", "comments_to_authors")], search: false, filters: [], pageSize: 10, open: false,
      emptyText: "Reviews appear here once they're submitted." } }),
  ]) });

  await page({ title: "Programme", slug: "programme", icon: "calendar-days", audience: audience([], { public: true }), body: { ...stacked([
    full(programmeOf("agenda")),
  ]), header: { description: "Three days in Lisbon, 8–10 December. All times are local (WET)." } } });

  await page({ title: "Session attendance", slug: "attendance", icon: "user-check", audience: audience([chair]), body: stacked([
    full({ kind: "text", config: { html: "<p>Drag people between columns as they arrive. Only the sessions you chair are shown.</p>", align: "left" } }),
    full({ kind: "board", config: { title: "Attendance", source: { objectId: objectByKey("attendance_mark").id, filter: null, sort: [] }, groupBy: "status",
      fields: ["person", "session", "role_in_session"].map((key) => fid("attendance_mark", key)), open: false } }),
  ]) });

  await page({ title: "My profile", slug: "profile", icon: "circle-user", audience: audience([signedIn.id]), body: stacked([
    full({ kind: "record", config: { title: "", target: "mine", objectId: people.id, files: false, comments: false, activity: false, edit: true, sections: [
      { title: "About you", fields: ["name", "email", "affiliation", "country", "expertise"].map((key) => fid("person", key)) },
      { title: "Online", fields: ["website", "phone", "bio"].map((key) => fid("person", key)) },
    ] } }),
  ]) });

  // A free-canvas team page: the programme chairs' numbers at a glance, also in the dashboard sidebar.
  const canvasBlock = (kind, config, grid) => ({ id: newBlockId(), kind, config, grid });
  await page({ title: "Chair's desk", slug: "chairs-desk", icon: "gauge", layout: "canvas", audience: audience([pc], { team: true }), body: { rows: [], blocks: [
    canvasBlock("stats", { title: "", tiles: [
      { label: "Papers", objectId: papers, fn: "count" },
      { label: "Accepted", objectId: papers, fn: "percent", part: { op: "and", items: [{ field: "status", operator: "eq", value: statusKey("paper", "Accepted") }] } },
      { label: "Reviews in", objectId: reviews, fn: "count", filter: { op: "and", items: [{ field: "status", operator: "eq", value: statusKey("review", "Submitted") }] } },
      { label: "Average score", objectId: reviews, fn: "avg", fieldId: fid("review", "overall_score") },
    ] }, { x: 0, y: 0, w: 12, h: 5 }),
    canvasBlock("chart", { title: "Papers by status", objectId: papers, kind: "donut", groupBy: { field: "status" }, measure: { fn: "count" } }, { x: 0, y: 5, w: 5, h: 12 }),
    canvasBlock("chart", { title: "Recommendations", objectId: reviews, kind: "bar", groupBy: { field: fid("review", "recommendation") }, measure: { fn: "count" } }, { x: 5, y: 5, w: 7, h: 12 }),
    canvasBlock("board", { title: "Decisions", source: { objectId: papers, filter: null, sort: [] }, groupBy: "status", fields: [fid("paper", "track"), fid("paper", "average_score")], open: true }, { x: 0, y: 17, w: 12, h: 16 }),
  ] } });
  log("portal pages: 8 pages and 2 record pages (one canvas team page)");

  await portalRun("portal.update", { patch: { enabled: true } });
  const published = await portalRun("portal.publish", { note: "Opened late-breaking posters and reviews", confirm: true });
  log(`published portal version ${published.version.number}`);

  // One unpublished change, so the Publish tab has something to show.
  const programmePage = (await portalStaff.state(context)).pages.find((item) => item.slug === "programme");
  await portalRun("page.save", { page: { id: programmePage.id, body: { ...programmePage.body, header: {
    ...programmePage.body.header, description: "Three days in Lisbon, 8–10 December. All times are local (WET). Workshops on day three need their own registration.",
  } } }, expectedRevision: programmePage.revision });
  log("portal draft: one unpublished change on Programme");
}

// ---------------------------------------------------------------- process, automations and documents
async function buildProcess() {
  const process = createProcessService();
  const documents = createDocumentService();
  const status = (objectKey, label) => statusKey(objectKey, label);
  const move = (objectKey, from, to) => ({ from: from ? status(objectKey, from) : null, to: status(objectKey, to) });

  // Stage rules: papers move Submitted → Under review → a decision, and a decision needs a note.
  await process.saveProcess(context, { objectId: objectByKey("paper").id, config: {
    enforce: true,
    moves: [move("paper", null, "Submitted"), move("paper", "Submitted", "Under review"), move("paper", "Submitted", "Withdrawn"),
      move("paper", "Under review", "Accepted"), move("paper", "Under review", "Revise"), move("paper", "Under review", "Rejected"),
      move("paper", "Revise", "Under review"), move("paper", "Revise", "Withdrawn"), move("paper", "Accepted", "Withdrawn")],
    requires: { [status("paper", "Accepted")]: [fid("paper", "decision_note")], [status("paper", "Rejected")]: [fid("paper", "decision_note")] },
  } });
  await process.saveProcess(context, { objectId: objectByKey("review").id, config: {
    enforce: true,
    moves: [move("review", null, "Assigned"), move("review", "Assigned", "In progress"), move("review", "In progress", "Submitted"), move("review", "Assigned", "Submitted"), move("review", "Submitted", "In progress")],
    requires: { [status("review", "Submitted")]: [fid("review", "recommendation")] },
  } });
  log("stage rules: papers and reviews");

  const { setup } = await process.saveReviewSetup(context, { setup: { name: "ICAML peer review", config: {
    submissionsObjectId: objectByKey("paper").id, reviewsObjectId: objectByKey("review").id,
    submissionFieldId: fid("review", "paper"), reviewerFieldId: fid("review", "reviewer"),
    submissionFilter: { op: "and", items: [{ field: "status", operator: "eq", value: status("paper", "Under review") }] },
    reviewerFilter: { op: "and", items: [{ field: fid("person", "roles"), operator: "has_any", value: [opt("Reviewer")] }] },
    perSubmission: 3, maxPerReviewer: 6,
    topics: { submissionFieldId: fid("paper", "track"), reviewerFieldId: fid("person", "expertise") },
    conflicts: { authorsFieldId: fid("paper", "authors"), reviewerConflictsFieldId: null, sameValue: [] },
    rubric: [{ fieldId: fid("review", "originality"), weight: 1 }, { fieldId: fid("review", "clarity"), weight: 1 }, { fieldId: fid("review", "relevance"), weight: 2 }],
    doneStatuses: [status("review", "Submitted")], newStatus: status("review", "Assigned"),
    decisions: [status("paper", "Accepted"), status("paper", "Revise"), status("paper", "Rejected")], disagreement: 1.5,
  } } });
  log("review setup: ICAML peer review");

  const accepted = (await documents.save(context, { document: { kind: "email", name: "Decision: accepted", objectId: objectByKey("paper").id, config: {
    subject: "“{{title}}” has been accepted to {{event.name}}",
    body: "<p>Dear {{authors.name}},</p><p>Congratulations — <strong>{{title}}</strong> has been accepted as a {{format}} in the {{track}} track.</p><p>{{decision_note}}</p><p>Your paper's page: {{record.link}}</p>",
  } } })).document;
  const certificate = (await documents.save(context, { document: { kind: "pdf", name: "ICAML certificate", objectId: objectByKey("certificate").id, config: {
    page: { size: "A4", orientation: "landscape", margin: 24, font: "serif", color: "#1f2937", accent: "#1e3a8a" },
    certificate: { enabled: true, holder: "{{recipient.name}}", fields: [fid("certificate", "kind"), fid("certificate", "cpd_hours")] },
    blocks: [
      { kind: "text", text: "International Conference on Applied Machine Learning · Lisbon", align: "center", size: 11, muted: true },
      { kind: "heading", text: "Certificate of {{kind}}", level: 1, align: "center" },
      { kind: "text", text: "awarded to", align: "center", muted: true },
      { kind: "heading", text: "{{recipient.name}}", level: 2, align: "center" },
      { kind: "text", text: "{{cpd_hours}} CPD hours · issued {{today}}", align: "center" },
      { kind: "spacer", height: 12 },
      { kind: "columns", left: [{ kind: "signature", name: "Prof. Helena Rocha", role: "General chair, ICAML 2026" }],
        right: [{ kind: "qr", source: "verify", size: 26, caption: "Check it: {{certificate.code}}", align: "right" }] },
    ],
  } } })).document;
  log("documents: decision email and certificate PDF");

  const save = (automation) => process.saveAutomation(context, { automation: { enabled: true, ...automation } });
  await save({ name: "Assign reviewers when review starts", trigger: { kind: "status.changed", objectId: objectByKey("paper").id, from: [], to: [status("paper", "Under review")] },
    steps: [{ kind: "assign_reviewers", setupId: setup.id }] });
  await save({ name: "Email authors when accepted", trigger: { kind: "status.changed", objectId: objectByKey("paper").id, from: [], to: [status("paper", "Accepted")] },
    steps: [{ kind: "send_email", to: [{ kind: "linked", linkFieldId: fid("paper", "authors"), fieldId: fid("person", "email") }], templateId: accepted.id, subject: "", body: "" }] });
  await save({ name: "Issue the certificate", description: "Run it on a certificate: makes the PDF, issues a checkable code and marks it issued.",
    trigger: { kind: "manual", objectId: objectByKey("certificate").id },
    steps: [{ kind: "generate_document", documentId: certificate.id, fieldId: fid("certificate", "pdf"), replace: true },
      { kind: "update_record", values: [{ fieldId: fid("certificate", "issued_on"), value: "@today" }], status: status("certificate", "Issued") }] });
  await save({ name: "Remind reviewers two days before the due date", trigger: { kind: "date", objectId: objectByKey("review").id, fieldId: fid("review", "due"), offsetDays: -2, time: "09:00" },
    condition: { op: "and", items: [{ field: "status", operator: "any_of", value: [status("review", "Assigned"), status("review", "In progress")] }] },
    steps: [{ kind: "send_email", to: [{ kind: "linked", linkFieldId: fid("review", "reviewer"), fieldId: fid("person", "email") }],
      subject: "Your ICAML review is due in two days", body: "<p>Hello {{reviewer.name}},</p><p>Your review of <strong>{{paper.title}}</strong> is due on {{due}}.</p>" }] });
  await save({ name: "Count the abstract's words", description: "A code step: run it on a paper to see the word count in the run log.",
    trigger: { kind: "manual", objectId: objectByKey("paper").id },
    steps: [{ kind: "run_code", code: "const words = (record.abstract ?? \"\").split(/\\s+/).filter(Boolean).length;\nconsole.log(`${record.title}: ${words} words`);\nreturn { output: { words, over: words > 250 } };" }] });
  await save({ name: "Sessions from the scheduling tool", description: "POST { \"title\": …, \"starts\": … } to the webhook address to add or update a session.",
    trigger: { kind: "hook", objectId: null },
    steps: [{ kind: "upsert_record", objectId: objectByKey("session").id, matchFieldId: fid("session", "title"), matchValue: "{{payload.title}}",
      values: [{ fieldId: fid("session", "starts"), value: "{{payload.starts}}" }], create: true }] });
  log("automations: 6");

  // One issued certificate, so the Certificates tab and the public check page have a live example.
  const first = (await service.queryRecords(context, { objectId: objectByKey("certificate").id, spec: { limit: 1 } })).rows[0];
  if (first) {
    const { results } = await documents.generate(context, { documentId: certificate.id, recordIds: [first.id], fieldId: fid("certificate", "pdf"), replace: true });
    if (results[0]?.certificate) log(`certificate issued: ${results[0].certificate.url}`);
    else log(`certificate not issued: ${results[0]?.error ?? "no result"}`);
  }
}

// ---------------------------------------------------------------- main
await seedEventData();
const actor = await findActor();
context = { projectId: PROJECT, eventId: EVENT, principal: { kind: "staff", id: actor } };
log(`acting as ${actor}`);

const existing = await service.getDefinition(context);
if (existing.workspace) {
  await run("workspace.delete", {});
  log("removed the previous showcase workspace");
}
await run("workspace.create", { createdFrom: { kind: "template", id: "showcase" } });
await refresh();
await buildStructure();
const team = checked(await db.from("project_members").select("id").eq("project_id", PROJECT).is("deleted_at", null).limit(3)).map((row) => row.id);
const built = await buildRecords(team);
await buildViewsAndHistory(built);
await refresh();
await buildPortal();
await refresh();
await buildProcess();

const first = objectByKey("paper");
const base = `${SITE}/events/project/${PROJECT}/allevents?event=${EVENT}`;
console.log(`\nDone.\nPapers:   ${base}&section=ws-${first.id}\nSettings: ${base}&section=workspace-settings\nPortal builder: ${base}&section=workspace-portal\nPortal:   ${SITE}/events/e/${EVENT}/workspace\nLocal:    http://localhost:3000/project/${PROJECT}/allevents?event=${EVENT}&section=ws-${first.id}`);
