import { block, blocksPage, f, is, list, ref, stages, toField, toLinked, value, where } from "../dsl.js";

// Volunteer applications, a shift rota with placement by role and capacity, day-before reminders, passes and check-ins.
const ROLES = ["Registration", "Stage", "Catering", "First aid", "Tech"];
const me = (listKey, key) => is(ref.field(listKey, key), "has_any", ["@me"]);

const template = {
  key: "volunteers",
  name: "Volunteers",
  icon: "hand-heart",
  description: "Volunteers apply with the role they'd like, the team approves and places them into shifts by role and capacity, reminders go out the day before, and shift leads scan check-ins.",
  lists: [
    list("volunteer", "Volunteer", "Volunteers", { icon: "hand-heart", prefix: "VOL", title: "name",
      statuses: [["applied", "Applied", "blue"], ["approved", "Approved", "teal"], ["scheduled", "Scheduled", "green"], ["declined", "Declined", "red"]],
      fields: [
        f.text("name", "Name", { required: true }), f.email("email", "Email", { required: true, isUnique: true }), f.phone("phone", "Phone"),
        f.multi("skills", "Happy to do", ROLES), f.multi("availability", "Available", ["Friday", "Saturday", "Sunday"]),
        f.select("tshirt", "T-shirt", ["S", "M", "L", "XL", "XXL"]), f.checkbox("lead", "Shift lead"), f.ticket("ticket", "Ticket"),
      ] }),
    list("shift", "Shift", "Shifts", { icon: "clock", prefix: "SHI", title: "name", fields: [
      f.text("name", "Name", { required: true }), f.datetime("starts", "Starts"), f.datetime("ends", "Ends"), f.select("role", "Role", ROLES),
      f.number("capacity", "Volunteers needed"), f.link("lead", "Lead", "volunteer"), f.text("location", "Where"),
    ] }),
    list("assignment", "Assignment", "Assignments", { icon: "calendar-check", prefix: "ASG",
      statuses: [["requested", "Requested", "gray"], ["assigned", "Assigned", "blue"], ["confirmed", "Confirmed", "green"], ["cancelled", "Cancelled", "red"]],
      fields: [f.link("volunteer", "Volunteer", "volunteer"), f.link("shift", "Shift", "shift"), f.select("role", "Preferred role", ROLES), f.date("shift_day", "Shift day")] }),
    list("checkin", "Check-in", "Check-ins", { icon: "scan-line", prefix: "CHK", fields: [
      f.link("volunteer", "Volunteer", "volunteer"), f.link("shift", "Shift", "shift"), f.datetime("at", "Checked in"),
    ] }),
  ],
  extras: {
    processes: [
      stages("volunteer", [">applied", "applied>approved", "applied>declined", "approved>scheduled", "scheduled>approved", "declined>applied"]),
      stages("assignment", [">requested", "requested>assigned", "assigned>confirmed", "assigned>cancelled", "confirmed>cancelled", "cancelled>assigned"]),
    ],
    documents: [
      { kind: "email", name: "You're on the team", objectId: ref.list("volunteer"), config: {
        subject: "Welcome to the {{event.name}} volunteer team", body: "<p>Hi {{name}},</p><p>You're approved — thank you! We'll place you into shifts soon. Your pass and shifts are on the portal: {{record.link}}</p>",
      } },
    ],
    automations: [
      { name: "Welcome approved volunteers", trigger: { kind: "status.changed", objectId: ref.list("volunteer"), from: [], to: ["approved"] },
        steps: [{ kind: "send_email", to: [toField("volunteer", "email")], templateId: ref.doc("You're on the team"), subject: "", body: "" }] },
      { name: "Keep the shift day on each assignment", trigger: { kind: "record.updated", objectId: ref.list("assignment"), fields: [ref.field("assignment", "shift")] },
        steps: [{ kind: "update_record", values: [value("assignment", "shift_day", "{{shift.starts}}")] }] },
      { name: "Assign once placed into a shift", trigger: { kind: "record.updated", objectId: ref.list("assignment"), fields: [ref.field("assignment", "shift")] },
        condition: where(is("status", "eq", "requested"), is(ref.field("assignment", "shift"), "is_not_empty")),
        steps: [{ kind: "update_record", values: [], status: "assigned" }] },
      { name: "Mark volunteers as scheduled", trigger: { kind: "status.changed", objectId: ref.list("assignment"), from: ["requested"], to: ["assigned"] },
        steps: [{ kind: "update_linked", linkFieldId: ref.field("assignment", "volunteer"), values: [], status: "scheduled" }] },
      { name: "Reminder the day before a shift", trigger: { kind: "date", objectId: ref.list("assignment"), fieldId: ref.field("assignment", "shift_day"), offsetDays: -1, time: "18:00" },
        condition: where(is("status", "any_of", ["assigned", "confirmed"])),
        steps: [{ kind: "send_email", to: [toLinked("assignment", "volunteer", "volunteer", "email")], subject: "Tomorrow: {{shift.name}}",
          body: "<p>Hi {{volunteer.name}},</p><p>A reminder that you're on <strong>{{shift.name}}</strong> tomorrow ({{shift.starts}}) at {{shift.location}}. Bring your pass: {{record.link}}</p>" }] },
    ],
    portal: {
      patch: { enabled: true, peopleObjectId: ref.list("volunteer"), emailFieldId: ref.field("volunteer", "email"), nameFieldId: ref.field("volunteer", "name"), signupEnabled: true,
        settings: { welcome: "Apply to volunteer, see your shifts and show your pass when you arrive.", contact: "" } },
      roles: [
        { ref: "volunteer", name: "Volunteer", icon: "hand-heart", color: "green", membership: where(is("status", "any_of", ["approved", "scheduled"])),
          access: {
            [ref.list("assignment")]: { view: { mode: "where", filter: where(me("assignment", "volunteer")) }, create: { mode: "all" },
              edit: { mode: "where", filter: where(me("assignment", "volunteer"), is("status", "eq", "assigned")) }, delete: { mode: "none" }, status: true,
              fields: { [ref.field("assignment", "shift")]: "read", [ref.field("assignment", "volunteer")]: "read", [ref.field("assignment", "shift_day")]: "read" } },
            [ref.list("shift")]: { view: { mode: "all" }, create: { mode: "none" }, edit: { mode: "none" }, delete: { mode: "none" } },
          } },
        { ref: "lead", name: "Shift lead", icon: "flag", color: "amber", membership: where(is(ref.field("volunteer", "lead"), "is_true")),
          access: {
            [ref.list("shift")]: { view: { mode: "all" }, create: { mode: "none" }, edit: { mode: "none" }, delete: { mode: "none" } },
            [ref.list("checkin")]: { view: { mode: "where", filter: where({ related: ref.field("checkin", "shift"), direction: "forward", match: where(me("shift", "lead")) }) },
              create: { mode: "all" }, edit: { mode: "none" }, delete: { mode: "none" } },
          } },
      ],
      pages: [
        blocksPage({ slug: "apply", title: "Volunteer with us", icon: "hand-heart", audience: { public: true }, blocks: [
          block("form", { title: "Volunteer with us", intro: "Tell us about yourself and the role you'd most like. We'll place you into shifts.", mode: "create", objectId: ref.list("assignment"),
            sections: [{ title: "", description: "", fields: [{ fieldId: ref.field("assignment", "role"), required: true }] }],
            defaults: [{ fieldId: ref.field("assignment", "volunteer"), value: ["@me"] }], status: "requested", submitLabel: "Apply",
            success: { message: "Thanks for applying! We'll be in touch.", page: null }, drafts: false,
            signup: { enabled: true, objectId: ref.list("volunteer"), personFields: [{ fieldId: ref.field("volunteer", "name"), required: true }, { fieldId: ref.field("volunteer", "phone"), required: false },
              { fieldId: ref.field("volunteer", "skills"), required: false }, { fieldId: ref.field("volunteer", "availability"), required: true }, { fieldId: ref.field("volunteer", "tshirt"), required: false }],
              personDefaults: [] } }),
        ] }),
        blocksPage({ slug: "my-shifts", title: "My shifts", icon: "calendar-check", audience: { roles: [ref.role("volunteer")] }, blocks: [
          block("table", { title: "My shifts", source: { objectId: ref.list("assignment"), filter: where(me("assignment", "volunteer")), sort: [] },
            columns: [ref.field("assignment", "shift"), ref.field("assignment", "shift_day"), "status"], search: false, filters: [], pageSize: 20, open: true, emptyText: "No shifts yet — we'll place you soon." }),
          block("pass", { title: "Your volunteer pass", text: "Your shift lead scans this when you arrive." }),
        ] }),
        blocksPage({ slug: "record-shift", title: "Shift", kind: "record", list: "shift", audience: {}, blocks: [
          block("record", { title: "", target: "page", objectId: ref.list("shift"), sections: [], files: false, comments: false, activity: false, edit: false }),
          block("scanner", { title: "Check volunteers in", objectId: ref.list("checkin"), personField: ref.field("checkin", "volunteer"), contextField: ref.field("checkin", "shift"),
            context: "page", timeField: ref.field("checkin", "at"), camera: true, search: true }),
        ] }),
        blocksPage({ slug: "rota", title: "Rota", icon: "layout-dashboard", audience: { team: true, nav: true }, blocks: [
          block("placement", { title: "Place volunteers into shifts", source: { objectId: ref.list("assignment"), filter: where(is("status", "any_of", ["requested", "assigned", "confirmed"])), sort: [] },
            linkField: ref.field("assignment", "shift"), placesFilter: null, capacityField: ref.field("shift", "capacity"), startField: ref.field("shift", "starts"), endField: ref.field("shift", "ends"),
            match: { itemField: ref.field("assignment", "role"), placeField: ref.field("shift", "role") }, fields: [ref.field("assignment", "volunteer")], autoPlace: true, open: true }),
          block("timeline", { title: "Shifts", source: { objectId: ref.list("shift"), filter: null, sort: [] }, startField: ref.field("shift", "starts"), endField: ref.field("shift", "ends"),
            groupBy: ref.field("shift", "role"), scale: "day", startDate: "first", open: true }),
        ] }),
      ],
    },
  },
};

export default template;
