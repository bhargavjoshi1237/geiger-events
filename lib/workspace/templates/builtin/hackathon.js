import { block, blocksPage, f, is, list, optionId, ref, stages, toField, toLinked, where } from "../dsl.js";

// Registration, teams, project submissions, judging per challenge and results.
const SKILLS = ["Frontend", "Backend", "Design", "Data", "Hardware"];
const me = (listKey, key) => is(ref.field(listKey, key), "has_any", ["@me"]);

const template = {
  key: "hackathon",
  name: "Hackathon",
  icon: "code-xml",
  description: "Participants register and form teams, teams submit projects to challenges, judges score the projects in their challenge, and everyone gets their results.",
  lists: [
    list("people", "Person", "People", { icon: "users", prefix: "PER", title: "name", fields: [
      f.text("name", "Name", { required: true }), f.email("email", "Email", { required: true, isUnique: true }),
      f.multi("roles", "Roles", [["Participant", "blue"], ["Judge", "violet"], ["Mentor", "teal"]]), f.multi("skills", "Skills", SKILLS),
      f.link("team", "Team", "team"), f.link("judging", "Judges for", "challenge", { multiple: true }), f.ticket("ticket", "Ticket"),
    ] }),
    list("team", "Team", "Teams", { icon: "users-round", prefix: "TEA", title: "name",
      statuses: [["forming", "Forming", "amber"], ["formed", "Team formed", "green"]],
      fields: [f.text("name", "Name", { required: true }), f.link("members", "Members", "people", { multiple: true }), f.link("challenge", "Challenge", "challenge"), f.long("idea", "Idea")] }),
    list("project", "Project", "Projects", { icon: "rocket", prefix: "PRJ", title: "title",
      statuses: [["draft", "Draft", "gray"], ["submitted", "Submitted", "blue"], ["judged", "Judged", "green"]],
      fields: [
        f.text("title", "Title", { required: true }), f.link("team", "Team", "team"), f.link("members", "Members", "people", { multiple: true }),
        f.link("challenge", "Challenge", "challenge"), f.long("description", "Description"), f.url("repo", "Code repository"), f.url("demo", "Demo"),
        f.files("slides", "Slides", { maxFiles: 2 }), f.long("feedback", "Feedback from the judges"),
      ] }),
    list("score", "Judging score", "Judging scores", { icon: "gavel", prefix: "SCO", title: "summary",
      statuses: [["assigned", "Assigned", "gray"], ["submitted", "Submitted", "green"]],
      fields: [
        f.text("summary", "Summary"), f.link("project", "Project", "project"), f.link("judge", "Judge", "people"),
        f.rating("innovation", "Innovation", { max: 10 }), f.rating("execution", "Execution", { max: 10 }), f.rating("impact", "Impact", { max: 10 }), f.long("notes", "Notes"),
      ] }),
    list("challenge", "Challenge", "Challenges", { icon: "trophy", prefix: "CHA", title: "name", fields: [
      f.text("name", "Name", { required: true }), f.long("brief", "Brief"), f.text("sponsor", "Sponsor"), f.text("prize", "Prize"),
    ] }),
  ],
  extras: {
    processes: [
      stages("team", [">forming", "forming>formed", "formed>forming"]),
      stages("project", [">draft", "draft>submitted", "submitted>draft", "submitted>judged"], { submitted: ["description", "repo"] }),
      stages("score", [">assigned", "assigned>submitted", "submitted>assigned"], { submitted: ["innovation", "execution", "impact"] }),
    ],
    reviewSetups: [{
      name: "Judging",
      config: {
        submissionsObjectId: ref.list("project"), reviewsObjectId: ref.list("score"),
        submissionFieldId: ref.field("score", "project"), reviewerFieldId: ref.field("score", "judge"),
        submissionFilter: where(is("status", "eq", "submitted")), reviewerFilter: where(is(ref.field("people", "roles"), "has_any", [optionId("Judge")])),
        perSubmission: 3, maxPerReviewer: 15,
        topics: { submissionFieldId: ref.field("project", "challenge"), reviewerFieldId: ref.field("people", "judging") },
        conflicts: { authorsFieldId: ref.field("project", "members"), reviewerConflictsFieldId: null, sameValue: [] },
        rubric: [{ fieldId: ref.field("score", "innovation"), weight: 1 }, { fieldId: ref.field("score", "execution"), weight: 1 }, { fieldId: ref.field("score", "impact"), weight: 1 }],
        doneStatuses: ["submitted"], newStatus: "assigned", decisions: ["judged"], disagreement: 3,
      },
    }],
    documents: [
      { kind: "email", name: "Results", objectId: ref.list("project"), config: {
        subject: "Your results for {{event.name}}",
        body: "<p>Hi {{members.name}},</p><p>Judging is done. Here's what the judges said about <strong>{{title}}</strong>:</p><p>{{feedback}}</p><p>Thanks for building with us!</p>",
      } },
      { kind: "pdf", name: "Participation certificate", objectId: ref.list("people"), config: {
        page: { size: "A4", orientation: "landscape", margin: 25, font: "sans", color: "#111827", accent: "#111827" },
        certificate: { enabled: true, holder: "{{name}}", fields: [ref.field("people", "team")] },
        blocks: [
          { kind: "heading", text: "{{event.name}}", level: 2, align: "center" },
          { kind: "heading", text: "Certificate of participation", level: 1, align: "center" },
          { kind: "text", text: "Awarded to {{name}} of team {{team.name}}.", align: "center", size: 14 },
          { kind: "spacer", height: 12 },
          { kind: "qr", source: "verify", size: 24, caption: "{{certificate.code}}", align: "center" },
        ],
      } },
    ],
    automations: [
      { name: "Welcome new participants", trigger: { kind: "record.created", objectId: ref.list("people"), source: "portal" },
        steps: [{ kind: "send_email", to: [toField("people", "email")], subject: "You're registered for {{event.name}}",
          body: "<p>Hi {{name}},</p><p>You're in. Find or start a team on the portal: {{record.link}}</p>" }] },
      { name: "Team is formed with three members", trigger: { kind: "record.updated", objectId: ref.list("team"), fields: [ref.field("team", "members")] },
        steps: [{ kind: "run_code", code: "const size = (record.members ?? []).length;\nif (size >= 3 && record.status === \"forming\") return { status: \"formed\", output: { size } };\nreturn { output: { size } };" }] },
      { name: "Assign judges when a project is submitted", trigger: { kind: "status.changed", objectId: ref.list("project"), from: [], to: ["submitted"] },
        steps: [{ kind: "assign_reviewers", setupId: ref.review("Judging") }] },
      { name: "Send results", trigger: { kind: "status.changed", objectId: ref.list("project"), from: [], to: ["judged"] },
        steps: [{ kind: "send_email", to: [toLinked("project", "members", "people", "email")], templateId: ref.doc("Results"), subject: "", body: "" }] },
    ],
    portal: {
      patch: { enabled: true, peopleObjectId: ref.list("people"), emailFieldId: ref.field("people", "email"), nameFieldId: ref.field("people", "name"), signupEnabled: true,
        settings: { welcome: "Register, form your team and submit your project.", contact: "" } },
      roles: [
        { ref: "participant", name: "Participant", icon: "user", color: "blue", membership: where(is(ref.field("people", "roles"), "has_any", [optionId("Participant")])),
          access: {
            [ref.list("team")]: { view: { mode: "all" }, create: { mode: "all" }, edit: { mode: "where", filter: where(me("team", "members")) }, delete: { mode: "none" }, comment: true,
              fields: { [ref.field("team", "members")]: "edit", [ref.field("team", "idea")]: "edit", [ref.field("team", "challenge")]: "edit" } },
            [ref.list("project")]: { view: { mode: "where", filter: where(me("project", "members")) }, create: { mode: "all" },
              edit: { mode: "where", filter: where(me("project", "members"), is("status", "eq", "draft")) }, delete: { mode: "none" }, status: true, comment: true,
              fields: { [ref.field("project", "feedback")]: "read" } },
            [ref.list("challenge")]: { view: { mode: "all" }, create: { mode: "none" }, edit: { mode: "none" }, delete: { mode: "none" } },
          } },
        { ref: "judge", name: "Judge", icon: "gavel", color: "violet", membership: where(is(ref.field("people", "roles"), "has_any", [optionId("Judge")])),
          access: {
            [ref.list("score")]: { view: { mode: "where", filter: where(me("score", "judge")) }, create: { mode: "none" },
              edit: { mode: "where", filter: where(me("score", "judge"), is("status", "eq", "assigned")) }, delete: { mode: "none" }, status: true,
              fields: { [ref.field("score", "project")]: "read", [ref.field("score", "judge")]: "read" } },
            [ref.list("project")]: { view: { mode: "where", filter: where({ related: ref.field("score", "project"), direction: "back", match: where(me("score", "judge")) }) },
              create: { mode: "none" }, edit: { mode: "none" }, delete: { mode: "none" }, fields: { [ref.field("project", "members")]: "hidden" } },
          } },
      ],
      pages: [
        blocksPage({ slug: "register", title: "Register", icon: "user-plus", audience: { public: true }, blocks: [
          block("form", { title: "Start a team", intro: "Register and start a team. Teammates can join it from the Teams page.", mode: "create", objectId: ref.list("team"),
            sections: [{ title: "", description: "", fields: [{ fieldId: ref.field("team", "name"), required: true }, { fieldId: ref.field("team", "challenge"), required: false }, { fieldId: ref.field("team", "idea"), required: false }] }],
            defaults: [{ fieldId: ref.field("team", "members"), value: ["@me"] }], submitLabel: "Register", success: { message: "You're registered. Welcome!", page: "teams" }, drafts: true,
            signup: { enabled: true, objectId: ref.list("people"), personFields: [{ fieldId: ref.field("people", "name"), required: true }, { fieldId: ref.field("people", "skills"), required: false }],
              personDefaults: [{ fieldId: ref.field("people", "roles"), value: [optionId("Participant")] }] } }),
        ] }),
        blocksPage({ slug: "teams", title: "Teams", icon: "users-round", audience: { roles: [ref.role("participant")] }, blocks: [
          block("cards", { title: "Teams", source: { objectId: ref.list("team"), filter: null, sort: [] }, cover: null, fields: ["status", ref.field("team", "challenge"), ref.field("team", "members")],
            columns: 3, search: true, filters: [], pageSize: 24, open: true, emptyText: "No teams yet — start one." }),
        ] }),
        blocksPage({ slug: "submit", title: "Submit a project", icon: "rocket", audience: { roles: [ref.role("participant")] }, blocks: [
          block("form", { title: "Your project", intro: "Save it as a draft and move it to Submitted when you're done.", mode: "create", objectId: ref.list("project"),
            sections: [{ title: "", description: "", fields: [{ fieldId: ref.field("project", "title"), required: true }, { fieldId: ref.field("project", "challenge"), required: true },
              { fieldId: ref.field("project", "description"), required: false }, { fieldId: ref.field("project", "repo"), required: false }, { fieldId: ref.field("project", "demo"), required: false }] }],
            defaults: [{ fieldId: ref.field("project", "members"), value: ["@me"] }], submitLabel: "Save project", success: { message: "Saved. Open it to finish and submit.", page: "my-projects" }, drafts: true }),
        ] }),
        blocksPage({ slug: "my-projects", title: "My projects", icon: "folder-kanban", audience: { roles: [ref.role("participant")] }, blocks: [
          block("table", { title: "My projects", source: { objectId: ref.list("project"), filter: where(me("project", "members")), sort: [] },
            columns: [ref.field("project", "title"), "status", ref.field("project", "challenge")], search: false, filters: [], pageSize: 20, open: true }),
        ] }),
        blocksPage({ slug: "judging", title: "Judging", icon: "gavel", audience: { roles: [ref.role("judge")] }, blocks: [
          block("table", { title: "Projects to score", source: { objectId: ref.list("score"), filter: where(me("score", "judge")), sort: [] },
            columns: [ref.field("score", "project"), "status"], search: false, filters: ["status"], pageSize: 30, open: true }),
        ] }),
      ],
    },
  },
};

export default template;
