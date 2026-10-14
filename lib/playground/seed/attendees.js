// Everyone who interacts with Halcyon's events: registrations (one per order, as checkout files
// them, plus RSVPs for free events), the Contact Book and its tags, segments, activity, notes
// and privacy requests, registration forms, dietary needs, and members-portal support threads.

import { personId } from "../cast.js";
import { EVENTS, EVENT } from "./catalog.js";
import { ORDER_ROWS } from "./orders.js";
import { GUESTS } from "./people.js";
import { PROJECT_ID, between, daysAgo, hoursAgo, noise, pick, sid, weighted } from "./helpers.js";

const DAY = 864e5;
export const FORM = { standard: sid("form", 1), summit: sid("form", 2), meetup: sid("form", 3), client: sid("form", 4), webinar: sid("form", 5) };

const DIETARY = ["Vegetarian", "Vegan", "Gluten-free", "Nut allergy", "Halal", "Kosher", "Dairy-free"];
const ACCESS = ["Wheelchair access", "Step-free seating near the front", "Hearing loop", "Large-print materials", "Quiet room access"];

function needs(n) {
  const dietary = noise(n * 31) < 0.14 ? pick(DIETARY, n * 5) : "";
  const accessibility = noise(n * 37) < 0.05 ? pick(ACCESS, n * 3) : "";
  return { dietary, accessibility };
}

function formFor(def) {
  if (def.key === "summit") return FORM.summit;
  if (def.key.startsWith("meetup")) return FORM.meetup;
  if (def.key === "meridian") return FORM.client;
  if (def.key === "webinar") return FORM.webinar;
  return FORM.standard;
}

const ENDED = new Set(EVENTS.filter((e) => e.status === "Ended").map((e) => e.id));

export const REGISTRATION_ROWS = (() => {
  const rows = [];
  let n = 0;

  // Checkout files a registration for every order.
  ORDER_ROWS.forEach((order) => {
    n += 1;
    const def = EVENTS.find((e) => e.id === order.event_id);
    const live = def.key === "brandWorkshop";
    const dead = order.cancelled_at || order.status === "refunded";
    const checkedIn = !dead && (ENDED.has(def.id) ? noise(n * 13) < 0.9 : live && noise(n * 13) < 0.72);
    const person = GUESTS.find((g) => g.email === order.buyer_email);
    rows.push({
      id: sid("registration", n), project_id: PROJECT_ID, event_id: order.event_id, form_id: formFor(def),
      name: order.buyer_name, email: order.buyer_email, phone: person?.phone ?? "",
      status: dead ? "Cancelled" : checkedIn ? "Checked-in" : "Confirmed", source: "Online",
      party_size: order.quantity, plus_ones: order.quantity > 1 ? Array.from({ length: order.quantity - 1 }, (_, i) => ({ name: `Guest ${i + 1} of ${order.buyer_name.split(" ")[0]}` })) : [],
      ...needs(n), answers: person?.company ? { company: person.company, role: person.title } : { role: person?.title ?? "" },
      waitlist_position: null, approved_by: null, approved_at: null, created_by: null,
      metadata: { orderId: order.id, ticket: order.ticket_name }, created_at: order.created_at, updated_at: order.created_at, deleted_at: null,
    });
  });

  // RSVPs for the free and approval-gated events.
  EVENTS.filter((e) => e.rsvps).forEach((def, ei) => {
    const eventAt = Date.now() + def.offset * DAY;
    const opensAt = eventAt - def.salesOpen * DAY;
    const closesAt = Math.min(Date.now() - 3600e3, eventAt - 3 * 3600e3);
    const plan = [
      ...Array(def.rsvps.confirmed).fill("Confirmed"),
      ...Array(def.rsvps.pending).fill("Pending"),
      ...Array(def.rsvps.declined).fill("Declined"),
      ...Array(def.rsvps.waitlisted).fill("Waitlisted"),
    ];
    let waitPos = 0;
    plan.forEach((status, i) => {
      n += 1;
      const person = GUESTS[(ei * 97 + i * 5 + 3) % GUESTS.length];
      const at = status === "Waitlisted" ? closesAt - (def.rsvps.waitlisted - waitPos) * 3 * 3600e3 : opensAt + Math.pow(noise(n * 7), 0.8) * (closesAt - opensAt);
      const ended = ENDED.has(def.id);
      rows.push({
        id: sid("registration", n), project_id: PROJECT_ID, event_id: def.id, form_id: formFor(def),
        name: person.name, email: person.email, phone: person.phone,
        status: ended && status === "Confirmed" ? (noise(n * 13) < 0.82 ? "Checked-in" : "Confirmed") : status,
        source: weighted(n, [["Online", 12], ["Organizer", 1], ["Import", 1]]),
        party_size: def.key.startsWith("meetup") && i % 9 === 0 ? 2 : 1, plus_ones: [],
        ...needs(n), answers: def.key === "meridian" ? { company: "Meridian Bank", role: pick(["Branch Lead", "Regional Director", "Partner"], i), [`dietary:q1`]: pick(["None", "Vegetarian", "Gluten-free"], i) } : person.company ? { company: person.company } : {},
        waitlist_position: status === "Waitlisted" ? ++waitPos : null,
        approved_by: def.key === "meridian" && status === "Confirmed" ? personId(2) : null,
        approved_at: def.key === "meridian" && status === "Confirmed" ? new Date(at + 6 * 3600e3).toISOString() : null,
        created_by: null, metadata: {}, created_at: new Date(at).toISOString(), updated_at: new Date(at).toISOString(), deleted_at: null,
      });
    });
  });
  return rows;
})();

const TAGS = [
  ["Speaker", "violet", "Has spoken at a Halcyon event."],
  ["Sponsor contact", "amber", "Point of contact at a sponsor."],
  ["Press", "sky", "Journalists and podcasters."],
  ["Alumni", "emerald", "Attended a workshop."],
  ["Client", "rose", "Works at a Halcyon client."],
  ["Volunteer", "emerald", "Helped run an event."],
  ["Newsletter", "slate", "Subscribed to the monthly newsletter."],
  ["Lisbon", "sky", "Based in or around Lisbon."],
  ["Brooklyn", "sky", "Based in or around New York."],
  ["Student", "slate", "Bought a student ticket."],
  ["Repeat buyer", "amber", "Three or more events."],
];

const NOTES = [
  "Met at the Summit afterparty — interested in sponsoring next year.",
  "Prefers WhatsApp for quick questions.",
  "Asked for an invoice in the company's name for every booking.",
  "Ran a great lightning talk in September; invite back.",
  "Needs step-free access — seat near the aisle.",
  "Potential speaker for the motion track.",
  "Requested the slides from the brand-systems workshop.",
  "Former Halcyon intern.",
];

export function attendeesSeed() {
  const registrations = REGISTRATION_ROWS;

  // One contact per person who has registered, plus a few leads who never have.
  const byEmail = new Map();
  registrations.forEach((r) => {
    const entry = byEmail.get(r.email) ?? { count: 0, first: r.created_at, events: new Set() };
    entry.count += 1;
    entry.events.add(r.event_id);
    if (r.created_at < entry.first) entry.first = r.created_at;
    byEmail.set(r.email, entry);
  });
  const leads = GUESTS.filter((g) => !byEmail.has(g.email)).slice(0, 24);

  const contacts = [...GUESTS.filter((g) => byEmail.has(g.email)), ...leads].map((g, i) => {
    const seen = byEmail.get(g.email);
    const tags = [];
    if (g.company && ["Kestrel Bikes", "Atlas Coffee Roasters", "Solace Hotels", "Meridian Bank", "Orbit Audio", "Lumen Health"].includes(g.company)) tags.push("Client");
    if (seen?.events.has(EVENT.atlasLab) || seen?.events.has(EVENT.brandWorkshop)) tags.push("Alumni");
    if (seen && seen.events.size >= 3) tags.push("Repeat buyer");
    if (g.city === "Lisbon" || g.city === "Porto") tags.push("Lisbon");
    if (g.city === "Brooklyn" || g.city === "New York") tags.push("Brooklyn");
    if (g.title === "Design Student") tags.push("Student");
    if (i % 4 === 0) tags.push("Newsletter");
    if (i % 41 === 7) tags.push("Press");
    if (i % 37 === 3) tags.push("Volunteer");
    const status = !seen ? "Lead" : i % 29 === 0 ? "Archived" : seen.events.size >= 3 || i % 23 === 0 ? "VIP" : "Active";
    const notes = i % 11 === 2
      ? [{ id: `cn${i}`, body: pick(NOTES, i), createdAt: daysAgo(between(i, 1, 60)), createdBy: personId(pick([2, 6, 10, 11], i)) }]
      : [];
    if (i % 33 === 5) notes.push({ id: `cn${i}b`, body: pick(NOTES, i + 3), createdAt: daysAgo(between(i + 1, 1, 20)), createdBy: personId(11) });
    const blocked = i % 97 === 50;
    return {
      id: sid("contact", i + 1), project_id: PROJECT_ID, name: g.name, email: g.email, phone: g.phone, company: g.company, title: g.title,
      location: `${g.city}, ${g.country}`, status, tags, consent_email: noise(i * 3) < 0.72, consent_sms: noise(i * 5) < 0.31,
      consent_updated_at: seen?.first ?? daysAgo(30), blocked, blocked_reason: blocked ? "Repeated chargebacks." : null,
      blocked_at: blocked ? daysAgo(19) : null, avatar_url: "", metadata: notes.length ? { notes } : {},
      created_by: seen ? null : personId(10), created_at: seen?.first ?? daysAgo(between(i, 5, 200)), updated_at: daysAgo(between(i + 7, 0, 30)), deleted_at: null,
    };
  });

  const contact_tags = TAGS.map(([name, color, description], i) => ({
    id: sid("tag", i + 1), project_id: PROJECT_ID, name, color, description, metadata: {}, created_by: personId(10),
    created_at: daysAgo(300 - i * 12), updated_at: daysAgo(30), deleted_at: null,
  }));

  const contact_segments = [
    ["VIP & repeat buyers", "Our most engaged guests — first to hear about the Summit.", "violet", [{ field: "status", op: "is", value: "VIP" }]],
    ["Lisbon creatives", "Anyone tagged Lisbon who's opted into email.", "sky", [{ field: "tag", op: "is", value: "Lisbon" }, { field: "consentEmail", op: "is", value: true }]],
    ["Brooklyn community", "Meetup regulars and Brooklyn-based contacts.", "emerald", [{ field: "tag", op: "is", value: "Brooklyn" }]],
    ["Summit 2026 attendees", "Everyone with a Summit ticket.", "amber", [{ field: "event", op: "is", value: EVENT.summit }]],
    ["Workshop alumni", "Past workshop attendees — good for the masterclass.", "rose", [{ field: "tag", op: "is", value: "Alumni" }]],
    ["Client teams", "People at Halcyon's clients.", "slate", [{ field: "tag", op: "is", value: "Client" }, { field: "blocked", op: "is", value: false }]],
    ["Not yet attending", "Leads with no registration — nurture sequence.", "amber", [{ field: "attending", op: "is", value: false }]],
  ].map(([name, description, color, rules], i) => ({
    id: sid("segment", i + 1), project_id: PROJECT_ID, name, description, color, rules,
    metadata: i === 0 ? { manualIds: [contacts[3].id, contacts[8].id] } : {}, created_by: personId(10),
    created_at: daysAgo(200 - i * 20), updated_at: daysAgo(4 + i), deleted_at: null,
  }));

  const ACTIVITY = [
    ["Email", "Outbound", "Your Summit ticket", "Thanks for booking — here's everything you need for Lisbon."],
    ["Email", "Inbound", "Re: invoice", "Could you re-issue the invoice to our Lisbon office?"],
    ["Call", "Outbound", "Sponsorship follow-up", "Walked through the Gold package; sending the deck."],
    ["SMS", "Outbound", "Doors open at 18:30", "See you tonight at the Brooklyn studio!"],
    ["Note", "Internal", "", "Wants to bring two colleagues to the masterclass."],
    ["System", "Internal", "Checked in", "Checked in at the door by QR scan."],
  ];
  const contact_activity = [];
  contacts.slice(0, 120).forEach((c, i) => {
    const count = 1 + (i % 4);
    for (let k = 0; k < count; k += 1) {
      const [channel, direction, subject, body] = pick(ACTIVITY, i * 3 + k);
      const at = daysAgo(between(i * 7 + k, 0, 90), between(k, 1, 20));
      contact_activity.push({
        id: sid("contactActivity", contact_activity.length + 1), project_id: PROJECT_ID, contact_id: c.id, channel, direction, subject, body,
        occurred_at: at, created_by: channel === "System" ? null : personId(pick([2, 6, 10, 11], i + k)), metadata: {}, created_at: at, updated_at: at, deleted_at: null,
      });
    }
  });

  const data_requests = [
    ["Export", "New", 0, 3, "Requested a copy of everything we hold.", null],
    ["Erasure", "In Progress", 8, 6, "Remove from all lists after the Solace refund.", null],
    ["Rectification", "Completed", 14, 20, "Wrong company on badge — fixed.", 18],
    ["Export", "Completed", 22, 40, "Sent the JSON export.", 35],
    ["Erasure", "New", 31, 1, "Via the portal privacy form.", null],
    ["Export", "Rejected", 45, 52, "Could not verify identity.", 50],
    ["Erasure", "In Progress", 57, 9, "Waiting on order history to clear the chargeback window.", null],
  ].map(([type, status, ci, age, note, resolvedAge], i) => ({
    id: sid("dataRequest", i + 1), project_id: PROJECT_ID, contact_id: contacts[ci].id, email: contacts[ci].email, type, status, note,
    due_at: daysAgo(age - 30), resolved_at: resolvedAge != null ? daysAgo(resolvedAge) : null, metadata: {}, created_by: personId(2),
    created_at: daysAgo(age), updated_at: daysAgo(Math.max(0, age - 2)), deleted_at: null,
  }));

  const field = (id, label, type, required = false, extra = {}) => ({ id, label, type, required, ...extra });
  const registration_forms = [
    [FORM.standard, "Standard ticket form", "Name, email and the basics — used by workshops and launch nights.", "Published",
      [field("name", "Full name", "text", true), field("email", "Email", "email", true), field("company", "Company", "text"), field("role", "Role", "text"), field("dietary", "Dietary requirements", "select", false, { options: ["None", ...DIETARY] })],
      { autofill: true, confirmation: { title: "You're in!", body: "We've emailed your ticket.", showCalendar: true, showShare: true } }],
    [FORM.summit, "Summit 2026 registration", "Pass holders pick workshop interests and badge details.", "Published",
      [field("name", "Full name", "text", true), field("email", "Email", "email", true), field("company", "Company", "text", true), field("role", "Job title", "text", true), field("badge", "Name on badge", "text"),
        field("tracks", "Workshop interests", "select", false, { options: ["Brand", "Motion", "Launch", "Strategy", "Type"] }), field("dietary", "Dietary requirements", "select", false, { options: ["None", ...DIETARY] }),
        field("access", "Accessibility needs", "textarea"), field("newsletter", "Send me the Halcyon newsletter", "checkbox")],
      { autofill: true, group: true, opensAt: daysAgo(120), closesAt: null, confirmation: { title: "See you in Lisbon", body: "Your pass and the workshop ballot are on their way.", showCalendar: true, showShare: true } }],
    [FORM.meetup, "Meetup RSVP", "Quick RSVP with an optional portfolio link for reviews.", "Published",
      [field("name", "Name", "text", true), field("email", "Email", "email", true), field("portfolio", "Portfolio link (for reviews)", "text"), field("talk", "Want to give a lightning talk?", "checkbox"),
        field("talkTitle", "Talk title", "text", false, { showWhen: { field: "talk", equals: true } })],
      { autofill: true, confirmation: { title: "See you Thursday", body: "Doors at 18:30. Pizza's on us.", showCalendar: true, showShare: false } }],
    [FORM.client, "Client preview — approval", "For private client events; every request is reviewed.", "Published",
      [field("name", "Full name", "text", true), field("email", "Work email", "email", true), field("company", "Company", "text", true), field("role", "Role", "text", true), field("reason", "Why would you like to attend?", "textarea")],
      { tokenGated: false, memberOnly: false, confirmation: { title: "Request received", body: "We'll confirm your place within two working days.", showCalendar: false, showShare: false } }],
    [FORM.webinar, "Webinar sign-up", "Email-only sign-up with a question for the speakers.", "Published",
      [field("name", "Name", "text", true), field("email", "Email", "email", true), field("question", "A question for Alex & Priya", "textarea")],
      { confirmation: { title: "You're registered", body: "The join link arrives an hour before.", showCalendar: true, showShare: true } }],
    [sid("form", 6), "Winter Gala — RSVP (draft)", "Plus-one, seating preferences and dietary choices.", "Draft",
      [field("name", "Full name", "text", true), field("email", "Email", "email", true), field("plusOne", "Bringing a plus-one?", "checkbox"), field("menu", "Menu choice", "select", true, { options: ["Fish", "Meat", "Vegetarian", "Vegan"] })],
      { memberOnly: false, confirmation: { title: "Thank you", body: "Seating plans go out in December.", showCalendar: true, showShare: false } }],
  ].map(([id, name, description, status, fields, settings], i) => ({
    id, project_id: PROJECT_ID, name, description, status, fields, settings, created_by: personId(11), metadata: {},
    created_at: daysAgo(260 - i * 30), updated_at: daysAgo(3 + i * 2), deleted_at: null,
  }));

  const dietary_config = [{
    project_id: PROJECT_ID, requests_enabled: true,
    request_prompt: "Anything we should know about food or access? Tell us and the team will follow up.",
    inquiry_title: "Food & access", inquiry_description: "We cater for every table — let us know what you need.",
    questions: [
      { id: "q1", label: "Dietary preference", type: "radio", options: [{ id: "o1", label: "None" }, { id: "o2", label: "Vegetarian" }, { id: "o3", label: "Vegan" }, { id: "o4", label: "Gluten-free" }] },
      { id: "q2", label: "Allergies", type: "multiselect", options: [{ id: "a1", label: "Nuts" }, { id: "a2", label: "Dairy" }, { id: "a3", label: "Shellfish" }, { id: "a4", label: "Gluten" }] },
    ],
    metadata: {}, created_at: daysAgo(200), updated_at: daysAgo(10),
  }];

  const needy = registrations.filter((r) => (r.dietary || r.accessibility) && r.status !== "Cancelled").slice(0, 14);
  const dietary_requests = needy.map((r, i) => ({
    id: sid("dietaryRequest", i + 1), project_id: PROJECT_ID, event_id: r.event_id, registration_id: r.id, name: r.name, email: r.email,
    message: r.accessibility ? `Could you confirm ${r.accessibility.toLowerCase()}?` : `I'm ${r.dietary.toLowerCase()} — is lunch covered?`,
    status: i % 3 === 0 ? "Resolved" : "Open", metadata: {}, created_at: r.created_at, updated_at: r.created_at, deleted_at: null,
  }));

  const THREADS = [
    ["Can I switch to a day pass?", EVENT.summit, "open", true, ["Hi! I bought a 2-day pass but can only make Friday. Can I switch to a day pass and get the difference back?", "Hi — yes, we can do that. I've started the swap; you'll see the partial refund in 5–7 days."]],
    ["Invoice with VAT number", EVENT.summit, "open", true, ["Could you add our VAT number PT509876543 to the invoice?"]],
    ["Test ride time slot", EVENT.kestrel, "open", false, ["Is there a way to pick an earlier test-ride slot? I have to leave by 21:00.", "Absolutely — come at 19:00 and ask for Pieter at the ride desk.", "Perfect, thanks!"]],
    ["Lost my ticket email", EVENT.kestrel, "closed", false, ["I can't find my ticket.", "Resent it just now — check your spam folder too.", "Got it, thank you."]],
    ["Refund for the Solace sessions", EVENT.solace, "closed", false, ["I was ill on Saturday — any chance of a partial refund?", "Sorry to hear that. We've refunded the Saturday portion as a one-off."]],
    ["Bringing my laptop?", EVENT.motion, "open", true, ["Do I need After Effects installed for the masterclass?"]],
    ["Wheelchair access at LX Factory", EVENT.summit, "open", false, ["Is the Main Hall step-free? I use a wheelchair.", "Yes — step-free throughout, and we've reserved you a space in the front stalls."]],
    ["Group booking for 12", EVENT.summit, "open", true, ["We'd like 12 passes for our studio. Is there a group rate?"]],
    ["Workshop materials", EVENT.brandWorkshop, "open", true, ["Running 10 minutes late — will I miss the audit exercise?"]],
    ["Packaging lab photos", EVENT.atlasLab, "closed", false, ["Will you share photos from the lab?", "Yes! Gallery link is in this week's newsletter."]],
    ["Meetup lightning talk", EVENT.meetupOct, "open", false, ["I'd love to do a 5-minute talk on type pairing.", "Love that — you're in slot 3."]],
    ["Membership renewal", null, "open", true, ["My Studio Friends membership renews next week — can I switch to annual?"]],
  ];
  const portal_threads = [];
  const portal_thread_messages = [];
  THREADS.forEach(([subject, eventId, status, unread, messages], i) => {
    const person = GUESTS[(i * 31 + 5) % GUESTS.length];
    const order = eventId ? ORDER_ROWS.find((o) => o.event_id === eventId && o.buyer_email === person.email) : null;
    const id = sid("thread", i + 1);
    let last = null;
    messages.forEach((body, k) => {
      const at = hoursAgo((i + 1) * 9 - k * 2 + 1);
      last = at;
      portal_thread_messages.push({ id: sid("threadMessage", portal_thread_messages.length + 1), thread_id: id, sender: k % 2 === 0 ? "member" : "organiser", body, created_at: at });
    });
    portal_threads.push({
      id, member_id: null, project_id: PROJECT_ID, event_id: eventId, order_id: order?.id ?? null, subject, status, last_message_at: last,
      member_unread: !unread && messages.length % 2 === 0, organiser_unread: unread, member_email: person.email, member_name: person.name,
      metadata: {}, created_at: hoursAgo((i + 1) * 9 + 2), updated_at: last,
    });
  });

  return { registrations, contacts, contact_tags, contact_segments, contact_activity, data_requests, registration_forms, dietary_config, dietary_requests, portal_threads, portal_thread_messages };
}

