import { block, blocksPage, f, is, list, ref, stages, toField, where } from "../dsl.js";

// Public nominations, a shortlist, judges scoring their categories with conflicts, and winner certificates.
const me = (listKey, key) => is(ref.field(listKey, key), "has_any", ["@me"]);

const template = {
  key: "awards",
  name: "Awards",
  icon: "award",
  description: "Anyone can nominate, the team shortlists, judges score the nominees in their categories (skipping conflicts), winners get an email and a certificate anyone can check.",
  lists: [
    list("nominee", "Nominee", "Nominees", { icon: "star", prefix: "NOM", title: "name",
      statuses: [["nominated", "Nominated", "blue"], ["shortlisted", "Shortlisted", "amber"], ["winner", "Winner", "green"], ["not_shortlisted", "Not shortlisted", "gray"]],
      fields: [
        f.text("name", "Name", { required: true }), f.email("email", "Email"), f.text("organisation", "Organisation"), f.link("category", "Category", "category"),
        f.long("citation", "Why they deserve it", { required: true }), f.text("nominator", "Nominated by"), f.email("nominator_email", "Nominator's email"),
        f.files("certificate", "Certificate", { maxFiles: 2, accept: ["application/pdf"] }),
      ] }),
    list("category", "Category", "Categories", { icon: "folder", prefix: "CAT", title: "name", fields: [f.text("name", "Name", { required: true }), f.long("criteria", "Criteria")] }),
    list("judge", "Judge", "Judges", { icon: "scale", prefix: "JUD", title: "name", fields: [
      f.text("name", "Name", { required: true }), f.email("email", "Email", { required: true, isUnique: true }), f.link("categories", "Categories", "category", { multiple: true }),
      f.link("conflicts", "Conflicts of interest", "nominee", { multiple: true }),
    ] }),
    list("score", "Score", "Scores", { icon: "gauge", prefix: "SCO", title: "summary",
      statuses: [["assigned", "Assigned", "gray"], ["submitted", "Submitted", "green"]],
      fields: [
        f.text("summary", "Summary"), f.link("nominee", "Nominee", "nominee"), f.link("judge", "Judge", "judge"),
        f.rating("impact", "Impact", { max: 10 }), f.rating("originality", "Originality", { max: 10 }), f.rating("evidence", "Evidence", { max: 10 }), f.long("notes", "Notes"),
      ] }),
  ],
  extras: {
    processes: [
      stages("nominee", [">nominated", "nominated>shortlisted", "nominated>not_shortlisted", "shortlisted>winner", "shortlisted>not_shortlisted", "not_shortlisted>shortlisted"]),
      stages("score", [">assigned", "assigned>submitted", "submitted>assigned"], { submitted: ["impact", "originality", "evidence"] }),
    ],
    reviewSetups: [{
      name: "Judging",
      config: {
        submissionsObjectId: ref.list("nominee"), reviewsObjectId: ref.list("score"),
        submissionFieldId: ref.field("score", "nominee"), reviewerFieldId: ref.field("score", "judge"),
        submissionFilter: where(is("status", "eq", "shortlisted")), reviewerFilter: null, perSubmission: 3, maxPerReviewer: 25,
        topics: { submissionFieldId: ref.field("nominee", "category"), reviewerFieldId: ref.field("judge", "categories") },
        conflicts: { authorsFieldId: null, reviewerConflictsFieldId: ref.field("judge", "conflicts"), sameValue: [] },
        rubric: [{ fieldId: ref.field("score", "impact"), weight: 2 }, { fieldId: ref.field("score", "originality"), weight: 1 }, { fieldId: ref.field("score", "evidence"), weight: 1 }],
        doneStatuses: ["submitted"], newStatus: "assigned", decisions: ["winner", "not_shortlisted"], disagreement: 3,
      },
    }],
    documents: [
      { kind: "email", name: "You've won", objectId: ref.list("nominee"), config: {
        subject: "Congratulations — you've won at {{event.name}}", body: "<p>Dear {{name}},</p><p>We're thrilled to tell you that you've won <strong>{{category.name}}</strong>.</p><p>Your certificate will follow by email.</p>",
      } },
      { kind: "pdf", name: "Winner certificate", objectId: ref.list("nominee"), config: {
        page: { size: "A4", orientation: "landscape", margin: 28, font: "serif", color: "#1f2937", accent: "#92400e" },
        certificate: { enabled: true, holder: "{{name}}", fields: [ref.field("nominee", "category"), ref.field("nominee", "organisation")] },
        blocks: [
          { kind: "text", text: "{{event.name}}", align: "center", size: 12, muted: true },
          { kind: "heading", text: "{{category.name}}", level: 1, align: "center" },
          { kind: "text", text: "awarded to", align: "center", size: 12, muted: true },
          { kind: "heading", text: "{{name}}", level: 2, align: "center" },
          { kind: "text", text: "{{organisation}}", align: "center", size: 12 },
          { kind: "spacer", height: 14 },
          { kind: "columns", left: [{ kind: "signature", name: "Chair of the judges", role: "{{event.name}}" }], right: [{ kind: "qr", source: "verify", size: 24, caption: "{{certificate.code}}", align: "right" }] },
        ],
      } },
    ],
    automations: [
      { name: "Thank the nominator", trigger: { kind: "record.created", objectId: ref.list("nominee"), source: "portal" },
        condition: where(is(ref.field("nominee", "nominator_email"), "is_not_empty")),
        steps: [{ kind: "send_email", to: [toField("nominee", "nominator_email")], subject: "Thanks for your nomination", body: "<p>Thank you for nominating {{name}} for {{category.name}}.</p>" }] },
      { name: "Assign judges to the shortlist", trigger: { kind: "status.changed", objectId: ref.list("nominee"), from: [], to: ["shortlisted"] },
        steps: [{ kind: "assign_reviewers", setupId: ref.review("Judging") }] },
      { name: "Winner email and certificate", trigger: { kind: "status.changed", objectId: ref.list("nominee"), from: [], to: ["winner"] },
        condition: where(is(ref.field("nominee", "email"), "is_not_empty")),
        steps: [
          { kind: "generate_document", documentId: ref.doc("Winner certificate"), fieldId: ref.field("nominee", "certificate"), replace: true },
          { kind: "send_email", to: [toField("nominee", "email")], templateId: ref.doc("You've won"), subject: "", body: "", attachDocumentId: ref.doc("Winner certificate") },
        ] },
    ],
    portal: {
      patch: { enabled: true, peopleObjectId: ref.list("judge"), emailFieldId: ref.field("judge", "email"), nameFieldId: ref.field("judge", "name"), signupEnabled: false,
        settings: { welcome: "Nominate someone, or sign in to judge your categories.", contact: "" } },
      roles: [
        { ref: "public", name: "Public visitor", builtin: true, access: {
          [ref.list("nominee")]: { view: { mode: "where", filter: where(is("status", "eq", "winner")) }, create: { mode: "all" }, edit: { mode: "none" }, delete: { mode: "none" },
            fields: { [ref.field("nominee", "email")]: "edit", [ref.field("nominee", "nominator")]: "edit", [ref.field("nominee", "nominator_email")]: "edit",
              [ref.field("nominee", "citation")]: "edit", [ref.field("nominee", "certificate")]: "hidden" } },
          [ref.list("category")]: { view: { mode: "all" }, create: { mode: "none" }, edit: { mode: "none" }, delete: { mode: "none" } },
        } },
        { ref: "judge", name: "Judge", icon: "scale", color: "violet", membership: where(is(ref.field("judge", "email"), "is_not_empty")),
          access: {
            [ref.list("score")]: { view: { mode: "where", filter: where(me("score", "judge")) }, create: { mode: "none" },
              edit: { mode: "where", filter: where(me("score", "judge"), is("status", "eq", "assigned")) }, delete: { mode: "none" }, status: true,
              fields: { [ref.field("score", "nominee")]: "read", [ref.field("score", "judge")]: "read" } },
            [ref.list("nominee")]: { view: { mode: "where", filter: where({ related: ref.field("score", "nominee"), direction: "back", match: where(me("score", "judge")) }) },
              create: { mode: "none" }, edit: { mode: "none" }, delete: { mode: "none" },
              fields: { [ref.field("nominee", "nominator")]: "hidden", [ref.field("nominee", "nominator_email")]: "hidden", [ref.field("nominee", "email")]: "hidden" } },
          } },
      ],
      pages: [
        blocksPage({ slug: "nominate", title: "Nominate", icon: "star", audience: { public: true }, blocks: [
          block("form", { title: "Nominate someone", intro: "Tell us who deserves recognition and why.", mode: "create", objectId: ref.list("nominee"),
            sections: [{ title: "Nominee", description: "", fields: [{ fieldId: ref.field("nominee", "name"), required: true }, { fieldId: ref.field("nominee", "organisation"), required: false },
              { fieldId: ref.field("nominee", "email"), required: false }, { fieldId: ref.field("nominee", "category"), required: true }, { fieldId: ref.field("nominee", "citation"), required: true }] },
            { title: "You", description: "", fields: [{ fieldId: ref.field("nominee", "nominator"), required: true }, { fieldId: ref.field("nominee", "nominator_email"), required: true }] }],
            defaults: [], status: "nominated", submitLabel: "Send nomination", success: { message: "Thank you — your nomination is in.", page: null }, drafts: false }),
        ] }),
        blocksPage({ slug: "winners", title: "Winners", icon: "trophy", audience: { public: true }, blocks: [
          block("cards", { title: "Winners", source: { objectId: ref.list("nominee"), filter: where(is("status", "eq", "winner")), sort: [] }, cover: null,
            fields: [ref.field("nominee", "category"), ref.field("nominee", "organisation")], columns: 3, search: false, filters: [], pageSize: 24, open: false, emptyText: "Winners are announced at the ceremony." }),
        ] }),
        blocksPage({ slug: "judging", title: "Judging", icon: "scale", audience: { roles: [ref.role("judge")] }, blocks: [
          block("table", { title: "Nominees to score", source: { objectId: ref.list("score"), filter: where(me("score", "judge")), sort: [] },
            columns: [ref.field("score", "nominee"), "status"], search: false, filters: ["status"], pageSize: 30, open: true }),
        ] }),
      ],
    },
  },
};

export default template;
