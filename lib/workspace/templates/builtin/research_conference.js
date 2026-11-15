import { block, blocksPage, f, is, list, optionId, ref, stages, toLinked, toTeam, where } from "../dsl.js";

// Call for papers with blind peer review, decisions, a programme of sessions and certificates of presentation.
const TOPICS = ["Machine learning", "Computer vision", "Language", "Systems", "Theory"];
const me = (listKey, key) => is(ref.field(listKey, key), "has_any", ["@me"]);

const template = {
  key: "research_conference",
  name: "Research conference",
  icon: "graduation-cap",
  description: "Call for papers, blind peer review with topic matching and conflicts, decisions, a session programme with attendance, and certificates of presentation.",
  lists: [
    list("people", "Person", "People", { icon: "users", prefix: "PER", title: "name", fields: [
      f.text("name", "Name", { required: true }), f.email("email", "Email", { required: true, isUnique: true }), f.text("affiliation", "Affiliation"),
      f.multi("roles", "Roles", [["Author", "blue"], ["Reviewer", "violet"], ["Session chair", "teal"], ["Organiser", "gray"]]),
      f.multi("topics", "Topics", TOPICS), f.link("conflicts", "Conflicts of interest", "paper", { multiple: true }), f.ticket("ticket", "Ticket"),
    ] }),
    list("paper", "Paper", "Papers", { icon: "file-text", prefix: "PAP", title: "title",
      statuses: [["submitted", "Submitted", "blue"], ["under_review", "Under review", "amber"], ["accepted", "Accepted", "green"], ["rejected", "Rejected", "red"], ["withdrawn", "Withdrawn", "gray"]],
      fields: [
        f.text("title", "Title", { required: true }), f.long("abstract", "Abstract", { required: true }), f.link("authors", "Authors", "people", { multiple: true }),
        f.multi("topics", "Topics", TOPICS), f.files("pdf", "Paper PDF", { maxFiles: 1, accept: ["application/pdf"] }),
        f.long("decision_note", "Decision note"), f.link("session", "Session", "session"), f.checkbox("presented", "Presented"),
        f.files("certificate", "Certificate", { maxFiles: 3, accept: ["application/pdf"] }),
      ] }),
    list("review", "Review", "Reviews", { icon: "clipboard-check", prefix: "REV", title: "summary",
      statuses: [["assigned", "Assigned", "gray"], ["in_progress", "In progress", "amber"], ["submitted", "Submitted", "green"]],
      fields: [
        f.text("summary", "Summary"), f.link("paper", "Paper", "paper"), f.link("reviewer", "Reviewer", "people"),
        f.rating("originality", "Originality"), f.rating("quality", "Quality"), f.rating("relevance", "Relevance"),
        f.select("recommendation", "Recommendation", [["Accept", "green"], ["Weak accept", "teal"], ["Weak reject", "amber"], ["Reject", "red"]]),
        f.long("comments", "Comments for the authors"), f.long("confidential", "Confidential comments"),
      ] }),
    list("topic", "Topic", "Topics", { icon: "tag", prefix: "TOP", title: "name", fields: [f.text("name", "Name", { required: true }), f.long("description", "Description")] }),
    list("session", "Session", "Sessions", { icon: "presentation", prefix: "SES", title: "name", fields: [
      f.text("name", "Name", { required: true }), f.datetime("starts", "Starts"), f.datetime("ends", "Ends"), f.link("room", "Room", "room"),
      f.link("chair", "Chair", "people"), f.select("track", "Track", TOPICS),
    ] }),
    list("room", "Room", "Rooms", { icon: "door-open", prefix: "ROO", title: "name", fields: [f.text("name", "Name", { required: true }), f.number("capacity", "Capacity")] }),
    list("attendance", "Attendance", "Attendance", { icon: "scan-line", prefix: "ATT", fields: [
      f.link("person", "Person", "people"), f.link("session", "Session", "session"), f.datetime("checked_in", "Checked in"),
    ] }),
  ],
  extras: {
    processes: [
      stages("paper", [">submitted", "submitted>under_review", "submitted>withdrawn", "under_review>accepted", "under_review>rejected", "under_review>withdrawn", "accepted>withdrawn"],
        { accepted: ["decision_note"], rejected: ["decision_note"] }),
      stages("review", [">assigned", "assigned>in_progress", "assigned>submitted", "in_progress>submitted", "submitted>in_progress"], { submitted: ["recommendation"] }),
    ],
    reviewSetups: [{
      name: "Paper review",
      config: {
        submissionsObjectId: ref.list("paper"), reviewsObjectId: ref.list("review"),
        submissionFieldId: ref.field("review", "paper"), reviewerFieldId: ref.field("review", "reviewer"),
        submissionFilter: where(is("status", "eq", "under_review")),
        reviewerFilter: where(is(ref.field("people", "roles"), "has_any", [optionId("Reviewer")])),
        perSubmission: 3, maxPerReviewer: 8,
        topics: { submissionFieldId: ref.field("paper", "topics"), reviewerFieldId: ref.field("people", "topics") },
        conflicts: { authorsFieldId: ref.field("paper", "authors"), reviewerConflictsFieldId: ref.field("people", "conflicts"), sameValue: [] },
        rubric: [{ fieldId: ref.field("review", "originality"), weight: 1 }, { fieldId: ref.field("review", "quality"), weight: 2 }, { fieldId: ref.field("review", "relevance"), weight: 1 }],
        doneStatuses: ["submitted"], newStatus: "assigned", decisions: ["accepted", "rejected"], disagreement: 1.5,
      },
    }],
    documents: [
      { kind: "email", name: "Paper accepted", objectId: ref.list("paper"), config: {
        subject: "“{{title}}” has been accepted to {{event.name}}",
        body: "<p>Dear authors,</p><p>We're delighted to tell you that <strong>{{title}}</strong> has been accepted.</p><p>{{decision_note}}</p><p>Follow your paper and upload the final version here: {{record.link}}</p>",
      } },
      { kind: "email", name: "Paper not accepted", objectId: ref.list("paper"), config: {
        subject: "Your submission to {{event.name}}",
        body: "<p>Dear authors,</p><p>Thank you for submitting <strong>{{title}}</strong>. We're sorry that we couldn't accept it this year.</p><p>{{decision_note}}</p><p>The reviewers' comments are on your paper's page: {{record.link}}</p>",
      } },
      { kind: "pdf", name: "Certificate of presentation", objectId: ref.list("paper"), config: {
        page: { size: "A4", orientation: "landscape", margin: 25, font: "serif", color: "#1f2937", accent: "#1e3a8a" },
        certificate: { enabled: true, holder: "{{authors.name}}", fields: [ref.field("paper", "title"), ref.field("paper", "session")] },
        blocks: [
          { kind: "heading", text: "Certificate of presentation", level: 1, align: "center" },
          { kind: "spacer", height: 10 },
          { kind: "text", text: "This certifies that", align: "center", size: 12, muted: true },
          { kind: "heading", text: "{{authors.name}}", level: 2, align: "center" },
          { kind: "text", text: "presented the paper", align: "center", size: 12, muted: true },
          { kind: "text", text: "{{title}}", align: "center", size: 15, bold: true },
          { kind: "text", text: "at {{event.name}} on {{today}}", align: "center", size: 12 },
          { kind: "spacer", height: 12 },
          { kind: "columns", left: [{ kind: "signature", name: "Programme chair", role: "{{event.name}}", align: "left" }],
            right: [{ kind: "qr", source: "verify", size: 26, caption: "Check this certificate: {{certificate.code}}", align: "right" }] },
        ],
      } },
    ],
    automations: [
      { name: "Assign reviewers when review starts", description: "Picks three reviewers by topic, skipping conflicts.",
        trigger: { kind: "status.changed", objectId: ref.list("paper"), from: [], to: ["under_review"] },
        steps: [{ kind: "assign_reviewers", setupId: ref.review("Paper review") }] },
      { name: "Tell authors their paper was accepted", trigger: { kind: "status.changed", objectId: ref.list("paper"), from: [], to: ["accepted"] },
        steps: [{ kind: "send_email", to: [toLinked("paper", "authors", "people", "email")], templateId: ref.doc("Paper accepted"), subject: "", body: "" }] },
      { name: "Tell authors their paper wasn't accepted", trigger: { kind: "status.changed", objectId: ref.list("paper"), from: [], to: ["rejected"] },
        steps: [{ kind: "send_email", to: [toLinked("paper", "authors", "people", "email")], templateId: ref.doc("Paper not accepted"), subject: "", body: "" }] },
      { name: "Certificate after the talk", description: "When a paper is marked as presented, its certificate is made and saved on the paper.",
        trigger: { kind: "record.updated", objectId: ref.list("paper"), fields: [ref.field("paper", "presented")] },
        condition: where(is(ref.field("paper", "presented"), "is_true")),
        steps: [{ kind: "generate_document", documentId: ref.doc("Certificate of presentation"), fieldId: ref.field("paper", "certificate"), replace: true }] },
      { name: "Weekly reminder to reviewers", trigger: { kind: "schedule", objectId: ref.list("review"), every: "week", weekday: 1, time: "09:00" },
        condition: where(is("status", "any_of", ["assigned", "in_progress"])),
        steps: [{ kind: "send_email", to: [toLinked("review", "reviewer", "people", "email")], subject: "A review is waiting for you",
          body: "<p>Hello {{reviewer.name}},</p><p>Your review of <strong>{{paper.title}}</strong> isn't finished yet. You can continue here: {{record.link}}</p>" }] },
      { name: "Note new submissions for the chairs", trigger: { kind: "record.created", objectId: ref.list("paper"), source: "portal" },
        steps: [{ kind: "send_email", to: [toTeam()], subject: "New submission: {{title}}", body: "<p>{{authors.name}} submitted <strong>{{title}}</strong>.</p>" }] },
    ],
    portal: {
      patch: { enabled: true, peopleObjectId: ref.list("people"), emailFieldId: ref.field("people", "email"), nameFieldId: ref.field("people", "name"), signupEnabled: true,
        settings: { welcome: "Submit and follow your papers, and review the papers assigned to you.", contact: "" } },
      roles: [
        { ref: "author", name: "Author", icon: "pen-line", color: "blue", membership: where(is(ref.field("people", "roles"), "has_any", [optionId("Author")])),
          access: {
            [ref.list("paper")]: {
              view: { mode: "where", filter: where(me("paper", "authors")) }, create: { mode: "all" },
              edit: { mode: "where", filter: where(me("paper", "authors"), is("status", "eq", "submitted")) }, delete: { mode: "none" }, comment: true, status: false,
              fields: { [ref.field("paper", "decision_note")]: "read", [ref.field("paper", "session")]: "read", [ref.field("paper", "presented")]: "hidden",
                [ref.field("paper", "certificate")]: "read", [ref.field("paper", "title")]: "edit", [ref.field("paper", "abstract")]: "edit",
                [ref.field("paper", "authors")]: "edit", [ref.field("paper", "topics")]: "edit", [ref.field("paper", "pdf")]: "edit" },
            },
            [ref.list("review")]: {
              view: { mode: "where", filter: where(
                { related: ref.field("review", "paper"), direction: "forward", match: where(me("paper", "authors"), is("status", "any_of", ["accepted", "rejected"])) },
                is("status", "eq", "submitted"),
              ) },
              create: { mode: "none" }, edit: { mode: "none" }, delete: { mode: "none" },
              fields: { [ref.field("review", "reviewer")]: "hidden", [ref.field("review", "confidential")]: "hidden", [ref.field("review", "comments")]: "read" },
            },
          } },
        { ref: "reviewer", name: "Reviewer", icon: "glasses", color: "violet", membership: where(is(ref.field("people", "roles"), "has_any", [optionId("Reviewer")])),
          access: {
            [ref.list("review")]: {
              view: { mode: "where", filter: where(me("review", "reviewer")) }, create: { mode: "none" },
              edit: { mode: "where", filter: where(me("review", "reviewer"), is("status", "any_of", ["assigned", "in_progress"])) }, delete: { mode: "none" }, comment: true, status: true,
              fields: { [ref.field("review", "paper")]: "read", [ref.field("review", "reviewer")]: "read", [ref.field("review", "originality")]: "edit",
                [ref.field("review", "quality")]: "edit", [ref.field("review", "relevance")]: "edit", [ref.field("review", "recommendation")]: "edit",
                [ref.field("review", "comments")]: "edit", [ref.field("review", "confidential")]: "edit" },
            },
            [ref.list("paper")]: {
              view: { mode: "where", filter: where({ related: ref.field("review", "paper"), direction: "back", match: where(me("review", "reviewer")) }) },
              create: { mode: "none" }, edit: { mode: "none" }, delete: { mode: "none" },
              fields: { [ref.field("paper", "authors")]: "hidden", [ref.field("paper", "decision_note")]: "hidden", [ref.field("paper", "certificate")]: "hidden" },
            },
          } },
        { ref: "chair", name: "Session chair", icon: "mic", color: "teal", membership: where(is(ref.field("people", "roles"), "has_any", [optionId("Session chair")])),
          access: {
            [ref.list("session")]: { view: { mode: "where", filter: where(me("session", "chair")) }, create: { mode: "none" }, edit: { mode: "none" }, delete: { mode: "none" } },
            [ref.list("attendance")]: { view: { mode: "where", filter: where({ related: ref.field("attendance", "session"), direction: "forward", match: where(me("session", "chair")) }) },
              create: { mode: "all" }, edit: { mode: "none" }, delete: { mode: "none" } },
          } },
      ],
      pages: [
        blocksPage({ slug: "submit", title: "Submit a paper", icon: "upload", audience: { roles: [ref.role("author")], public: true }, blocks: [
          block("form", { title: "Submit a paper", intro: "Fill in the details and upload your PDF. You can edit it until review starts.", mode: "create", objectId: ref.list("paper"),
            sections: [{ title: "", description: "", fields: [{ fieldId: ref.field("paper", "title"), required: true }, { fieldId: ref.field("paper", "abstract"), required: true },
              { fieldId: ref.field("paper", "topics"), required: false }, { fieldId: ref.field("paper", "pdf"), required: true }] }],
            defaults: [{ fieldId: ref.field("paper", "authors"), value: ["@me"] }], status: "submitted", submitLabel: "Submit paper",
            success: { message: "Thanks — your paper is in. You'll hear from us when review is done.", page: "my-papers" }, drafts: true,
            signup: { enabled: true, objectId: ref.list("people"), personFields: [{ fieldId: ref.field("people", "name"), required: true }, { fieldId: ref.field("people", "affiliation"), required: false }],
              personDefaults: [{ fieldId: ref.field("people", "roles"), value: [optionId("Author")] }] } }),
        ] }),
        blocksPage({ slug: "my-papers", title: "My papers", icon: "file-text", audience: { roles: [ref.role("author")] }, blocks: [
          block("table", { title: "My papers", source: { objectId: ref.list("paper"), filter: where(me("paper", "authors")), sort: [] },
            columns: [ref.field("paper", "title"), "status", ref.field("paper", "session")], search: false, filters: [], pageSize: 20, open: true, emptyText: "You haven't submitted a paper yet." }),
        ] }),
        blocksPage({ slug: "my-reviews", title: "My reviews", icon: "clipboard-check", audience: { roles: [ref.role("reviewer")] }, blocks: [
          block("table", { title: "Papers to review", source: { objectId: ref.list("review"), filter: where(me("review", "reviewer")), sort: [] },
            columns: [ref.field("review", "paper"), "status", ref.field("review", "recommendation")], search: false, filters: ["status"], pageSize: 20, open: true, emptyText: "No reviews assigned to you yet." }),
        ] }),
        blocksPage({ slug: "programme", title: "Programme", icon: "calendar-range", audience: { public: true, roles: [ref.role("author"), ref.role("reviewer"), ref.role("chair")] }, blocks: [
          block("schedule", { title: "Programme", source: { objectId: ref.list("session"), filter: null, sort: [] }, startField: ref.field("session", "starts"),
            endField: ref.field("session", "ends"), laneField: ref.field("session", "room"), peopleField: ref.field("session", "chair"), startDate: "first", days: 3, open: false, fields: [ref.field("session", "track")] }),
        ] }),
        blocksPage({ slug: "record-session", title: "Session", kind: "record", list: "session", audience: {}, blocks: [
          block("record", { title: "", target: "page", objectId: ref.list("session"), sections: [], files: false, comments: false, activity: false, edit: false }),
          block("scanner", { title: "Take attendance", objectId: ref.list("attendance"), personField: ref.field("attendance", "person"), contextField: ref.field("attendance", "session"),
            context: "page", timeField: ref.field("attendance", "checked_in"), camera: true, search: true }),
        ] }),
        blocksPage({ slug: "my-pass", title: "My pass", icon: "qr-code", audience: { roles: [ref.role("author"), ref.role("reviewer"), ref.role("chair")] }, blocks: [
          block("pass", { title: "Your conference pass", text: "Session chairs scan this to record that you attended." }),
        ] }),
      ],
    },
  },
};

export default template;
