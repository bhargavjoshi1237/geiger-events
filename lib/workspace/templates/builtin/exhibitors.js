import { block, blocksPage, f, is, list, ref, stages, toLinked, toTeam, where } from "../dsl.js";

// Exhibitor applications with approval, contracts, payment and booth placement, plus deliveries.
const SIZES = ["3 × 3 m", "3 × 6 m", "6 × 6 m"];
const me = (listKey, key) => is(ref.field(listKey, key), "has_any", ["@me"]);

const template = {
  key: "exhibitors",
  name: "Exhibitors",
  icon: "store",
  description: "Companies apply for a stand, the team approves, contracts go out automatically, payment is tracked and booths are placed by size with capacity.",
  lists: [
    list("contact", "Contact", "Contacts", { icon: "contact", prefix: "CON", title: "name", fields: [
      f.text("name", "Name", { required: true }), f.email("email", "Email", { required: true, isUnique: true }), f.phone("phone", "Phone"),
      f.link("company", "Company", "company"), f.ticket("ticket", "Exhibitor pass"),
    ] }),
    list("company", "Company", "Companies", { icon: "building-2", prefix: "COM", title: "name", fields: [
      f.text("name", "Name", { required: true }), f.url("website", "Website"), f.long("description", "Description"),
      f.files("logo", "Logo", { maxFiles: 1, accept: ["image/*"] }), f.select("sector", "Sector", ["Software", "Hardware", "Services", "Research", "Media"]),
    ] }),
    list("application", "Booth application", "Booth applications", { icon: "clipboard-list", prefix: "APP", title: "title",
      statuses: [["applied", "Applied", "blue"], ["approved", "Approved", "teal"], ["contract_sent", "Contract sent", "amber"], ["paid", "Paid", "green"], ["placed", "Placed", "violet"], ["declined", "Declined", "red"]],
      fields: [
        f.text("title", "Stand name", { required: true }), f.link("company", "Company", "company"), f.link("contact", "Contact", "contact"),
        f.select("size", "Stand size", SIZES), f.long("products", "What you'll show"), f.currency("fee", "Stand fee"),
        f.files("contract", "Contract", { maxFiles: 3, accept: ["application/pdf"] }), f.checkbox("paid", "Paid"), f.link("booth", "Booth", "booth"),
      ] }),
    list("booth", "Booth", "Booths", { icon: "layout-grid", prefix: "BOO", title: "name", fields: [
      f.text("name", "Name", { required: true }), f.select("hall", "Hall", ["Hall A", "Hall B"]), f.select("size", "Size", SIZES),
      f.number("capacity", "Exhibitors"), f.currency("price", "Price"),
    ] }),
    list("delivery", "Delivery", "Deliveries", { icon: "truck", prefix: "DEL", title: "reference",
      statuses: [["expected", "Expected", "amber"], ["received", "Received", "green"]],
      fields: [f.text("reference", "Reference", { required: true }), f.link("application", "Stand", "application"), f.text("carrier", "Carrier"), f.date("expected", "Expected on"), f.long("items", "Items")] }),
  ],
  extras: {
    processes: [
      stages("application", [">applied", "applied>approved", "applied>declined", "approved>contract_sent", "contract_sent>paid", "paid>placed", "placed>paid"], { contract_sent: ["contract"] }),
      stages("delivery", [">expected", "expected>received"]),
    ],
    documents: [
      { kind: "email", name: "Application received", objectId: ref.list("application"), config: {
        subject: "We've received your application for {{event.name}}", body: "<p>Hi {{contact.name}},</p><p>Thanks for applying for a {{size}} stand. We'll be in touch soon.</p><p>Follow your application here: {{record.link}}</p>",
      } },
      { kind: "pdf", name: "Exhibitor contract", objectId: ref.list("application"), config: {
        page: { size: "A4", orientation: "portrait", margin: 22, font: "sans", color: "#111827", accent: "#111827" },
        certificate: { enabled: false, holder: "", fields: [] },
        blocks: [
          { kind: "heading", text: "Exhibitor agreement", level: 1 }, { kind: "text", text: "{{event.name}} · {{record.number}} · {{today}}", muted: true, size: 10 },
          { kind: "divider" },
          { kind: "field", fieldId: ref.field("application", "company"), label: true }, { kind: "field", fieldId: ref.field("application", "title"), label: true },
          { kind: "field", fieldId: ref.field("application", "size"), label: true }, { kind: "field", fieldId: ref.field("application", "fee"), label: true },
          { kind: "text", text: "The exhibitor agrees to the event's exhibitor terms. The stand fee is due within 14 days of this agreement.", size: 10 },
          { kind: "spacer", height: 16 },
          { kind: "columns", left: [{ kind: "signature", name: "{{contact.name}}", role: "{{company.name}}" }], right: [{ kind: "signature", name: "Exhibitions team", role: "{{event.name}}", align: "right" }] },
        ],
      } },
    ],
    automations: [
      { name: "Approve new applications", trigger: { kind: "record.created", objectId: ref.list("application"), source: "any" },
        steps: [
          { kind: "send_email", to: [toLinked("application", "contact", "contact", "email")], templateId: ref.doc("Application received"), subject: "", body: "" },
          { kind: "ask_approval", approvers: [ref.me], rule: "any", title: "Approve {{title}}", message: "{{company.name}} asked for a {{size}} stand: {{products}}",
            approve: { status: "approved", values: [] }, reject: { status: "declined", values: [] } },
        ] },
      { name: "Send the contract when approved", trigger: { kind: "status.changed", objectId: ref.list("application"), from: [], to: ["approved"] },
        steps: [
          { kind: "generate_document", documentId: ref.doc("Exhibitor contract"), fieldId: ref.field("application", "contract"), replace: true },
          { kind: "update_record", values: [], status: "contract_sent" },
          { kind: "send_email", to: [toLinked("application", "contact", "contact", "email")], subject: "Your exhibitor agreement for {{event.name}}",
            body: "<p>Hi {{contact.name}},</p><p>Your stand is approved. Your agreement is attached as a link below and on your application page: {{record.link}}</p>",
            attachDocumentId: ref.doc("Exhibitor contract") },
        ] },
      { name: "Thank exhibitors for paying", trigger: { kind: "record.updated", objectId: ref.list("application"), fields: [ref.field("application", "paid")] },
        condition: where(is(ref.field("application", "paid"), "is_true"), is("status", "eq", "contract_sent")),
        steps: [{ kind: "update_record", values: [], status: "paid" },
          { kind: "send_email", to: [toLinked("application", "contact", "contact", "email")], subject: "Payment received", body: "<p>Thanks — we've received payment for {{title}}.</p>" }] },
      { name: "Tell the team about deliveries", trigger: { kind: "record.created", objectId: ref.list("delivery"), source: "portal" },
        steps: [{ kind: "send_email", to: [toTeam()], subject: "Delivery expected: {{reference}}", body: "<p>{{application.title}} expects a delivery on {{expected}} by {{carrier}}.</p>" }] },
    ],
    portal: {
      patch: { enabled: true, peopleObjectId: ref.list("contact"), emailFieldId: ref.field("contact", "email"), nameFieldId: ref.field("contact", "name"), signupEnabled: true,
        settings: { welcome: "Apply for a stand, sign your agreement and manage your stand details.", contact: "" } },
      roles: [
        { ref: "exhibitor", name: "Exhibitor", icon: "store", color: "blue", membership: where(is(ref.field("contact", "email"), "is_not_empty")),
          access: {
            [ref.list("application")]: { view: { mode: "where", filter: where(me("application", "contact")) }, create: { mode: "all" },
              edit: { mode: "where", filter: where(me("application", "contact"), is("status", "eq", "applied")) }, delete: { mode: "none" }, comment: true,
              fields: { [ref.field("application", "fee")]: "read", [ref.field("application", "contract")]: "read", [ref.field("application", "paid")]: "read", [ref.field("application", "booth")]: "read" } },
            [ref.list("company")]: { view: { mode: "where", filter: where({ related: ref.field("contact", "company"), direction: "back", match: where(is(ref.field("contact", "email"), "eq", "@my_email")) }) },
              create: { mode: "all" }, edit: { mode: "where", filter: where({ related: ref.field("contact", "company"), direction: "back", match: where(is(ref.field("contact", "email"), "eq", "@my_email")) }) }, delete: { mode: "none" } },
            [ref.list("delivery")]: { view: { mode: "where", filter: where({ related: ref.field("delivery", "application"), direction: "forward", match: where(me("application", "contact")) }) },
              create: { mode: "all" }, edit: { mode: "none" }, delete: { mode: "none" } },
            [ref.list("booth")]: { view: { mode: "all" }, create: { mode: "none" }, edit: { mode: "none" }, delete: { mode: "none" }, fields: { [ref.field("booth", "price")]: "read" } },
          } },
      ],
      pages: [
        blocksPage({ slug: "apply", title: "Apply for a stand", icon: "clipboard-list", audience: { public: true, roles: [ref.role("exhibitor")] }, blocks: [
          block("form", { title: "Apply for a stand", intro: "Tell us about your stand. You can change it until we approve it.", mode: "create", objectId: ref.list("application"),
            sections: [{ title: "", description: "", fields: [{ fieldId: ref.field("application", "title"), required: true }, { fieldId: ref.field("application", "size"), required: true },
              { fieldId: ref.field("application", "products"), required: true }] }],
            defaults: [{ fieldId: ref.field("application", "contact"), value: ["@me"] }], submitLabel: "Apply", success: { message: "Thanks — we'll review your application shortly.", page: "my-stand" }, drafts: true,
            signup: { enabled: true, objectId: ref.list("contact"), personFields: [{ fieldId: ref.field("contact", "name"), required: true }, { fieldId: ref.field("contact", "phone"), required: false }], personDefaults: [] } }),
        ] }),
        blocksPage({ slug: "my-stand", title: "My stand", icon: "store", audience: { roles: [ref.role("exhibitor")] }, blocks: [
          block("table", { title: "My applications", source: { objectId: ref.list("application"), filter: where(me("application", "contact")), sort: [] },
            columns: [ref.field("application", "title"), "status", ref.field("application", "size"), ref.field("application", "booth")], search: false, filters: [], pageSize: 10, open: true }),
          block("table", { title: "Deliveries", source: { objectId: ref.list("delivery"), filter: null, sort: [] },
            columns: [ref.field("delivery", "reference"), "status", ref.field("delivery", "expected")], search: false, filters: [], pageSize: 10, open: true, emptyText: "No deliveries yet." }),
        ] }),
        blocksPage({ slug: "floor", title: "Booth placement", icon: "layout-grid", audience: { team: true, nav: true }, blocks: [
          block("placement", { title: "Booths", source: { objectId: ref.list("application"), filter: where(is("status", "any_of", ["paid", "placed"])), sort: [] },
            linkField: ref.field("application", "booth"), placesFilter: null, capacityField: ref.field("booth", "capacity"), startField: null, endField: null,
            match: { itemField: ref.field("application", "size"), placeField: ref.field("booth", "size") }, fields: [ref.field("application", "company")], autoPlace: true, open: true }),
        ] }),
      ],
    },
  },
};

export default template;
