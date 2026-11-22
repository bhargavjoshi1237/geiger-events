import { ApiError } from "../../staff_access/errors.js";
import { defaultDecisionDate, defaultDeadline } from "../../sourcing/drafting.js";
import { RFP_STATUSES, isEmail, roomNights, toNumber } from "../../sourcing/rfp_model.js";
import { rfpToRow } from "../../sourcing/rows.js";
import { budgetReference } from "../../sourcing/scoring.js";

// Smart Custom Proposals for Control: the dashboard's list summary, brief edits and status moves, as pure functions.

const invalid = (message) => new ApiError("invalid_input", 400, message);

// Fields copied onto a duplicate, exactly as the dashboard's Duplicate does; recipients and bids never are.
export const COPY_KEYS = [
  "eventId", "summary", "startDate", "endDate", "datesFlexible", "alternateDates", "attendees", "location",
  "roomRequirements", "sleepingRooms", "fnbRequirements", "fnbMinimum", "avNeeds", "budgetMin", "budgetMax",
  "currency", "shareBudget", "decisionDate", "contactName", "contactEmail", "notes", "scoringWeights",
];

// The brief fields the app edits; nested requirement tables stay on the dashboard.
const BRIEF_TEXT = { title: 200, summary: 5000, location: 300, fnbRequirements: 5000, avNeeds: 5000, notes: 5000 };
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Per RFP: invited, responded, still waiting, live bids and the best total — the dashboard list's columns.
export function rfpSummaries(recipients, bids) {
  const out = {};
  const bidByRecipient = new Map(bids.map((b) => [b.recipientId, b]));
  for (const r of recipients) {
    const s = (out[r.rfpId] ||= { invited: 0, responded: 0, waiting: 0, best: null, bids: 0 });
    if (!r.invitedAt) continue;
    s.invited += 1;
    if (["invited", "viewed"].includes(r.status)) s.waiting += 1;
    const b = bidByRecipient.get(r.id);
    if (b && r.status !== "declined") {
      s.responded += 1;
      s.bids += 1;
      if (b.status !== "rejected" && (s.best === null || b.total < s.best)) s.best = b.total;
    }
  }
  return out;
}

export function rfpStats(rfps, recipients, bids, summaries) {
  const open = rfps.filter((r) => r.status === "sent").length;
  const drafts = rfps.filter((r) => r.status === "draft").length;
  const waiting = rfps.filter((r) => r.status === "sent").reduce((n, r) => n + (summaries[r.id]?.waiting || 0), 0);
  const received = rfps.reduce((n, r) => n + (summaries[r.id]?.bids || 0), 0);
  const byRfp = new Map(rfps.map((r) => [r.id, r]));
  const recipientRfp = new Map(recipients.map((r) => [r.id, r.rfpId]));
  const deltas = [];
  for (const b of bids) {
    const rfp = byRfp.get(recipientRfp.get(b.recipientId));
    const budget = rfp ? budgetReference(rfp) : null;
    if (budget && b.total > 0 && b.status !== "rejected") deltas.push(((b.total - budget) / budget) * 100);
  }
  return {
    open,
    drafts,
    waiting,
    received,
    avgVsBudget: deltas.length ? Math.round((deltas.reduce((s, d) => s + d, 0) / deltas.length) * 10) / 10 : null,
  };
}

export function rfpRow(rfp, summary, eventName = "") {
  return {
    id: rfp.id,
    title: rfp.title || "Untitled RFP",
    status: rfp.status,
    eventId: rfp.eventId,
    eventName,
    attendees: rfp.attendees,
    location: rfp.location,
    currency: rfp.currency,
    responseDeadline: rfp.responseDeadline,
    invited: summary?.invited ?? 0,
    responded: summary?.responded ?? 0,
    best: summary?.best ?? null,
    createdAt: rfp.createdAt,
  };
}

// Whether the brief still needs work before it can go out — the same checks as the dashboard's send.
export function briefNeeds(rfp) {
  const needs =
    rfp.roomRequirements.length > 0 || roomNights(rfp.sleepingRooms) > 0 || String(rfp.fnbRequirements || "").trim() || String(rfp.avNeeds || "").trim();
  return Boolean(needs);
}

function text(value, key, max) {
  if (value == null) return "";
  if (typeof value !== "string") throw invalid(`${key} must be text.`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw invalid(`${key} must be ${max} characters or fewer.`);
  return trimmed;
}

function dateOrEmpty(value, label) {
  if (value === "" || value == null) return "";
  if (typeof value !== "string" || !DATE.test(value)) throw invalid(`${label} must be YYYY-MM-DD.`);
  return value;
}

function moneyOrNull(value, label) {
  if (value === "" || value == null) return null;
  const n = toNumber(value);
  if (n === null || n < 0) throw invalid(`${label} must be 0 or more.`);
  return n;
}

// The app's brief edit → a camelCase patch the dashboard's rfpToRow understands. Only drafts take brief edits.
export function parseBrief(body) {
  if (!body || typeof body !== "object") throw invalid("Send the fields to change.");
  const patch = {};
  for (const [key, max] of Object.entries(BRIEF_TEXT)) if (key in body) patch[key] = text(body[key], key, max);
  if ("title" in patch && !patch.title) throw invalid("Give the RFP a title.");
  if ("startDate" in body) patch.startDate = dateOrEmpty(body.startDate, "Start date");
  if ("endDate" in body) patch.endDate = dateOrEmpty(body.endDate, "End date");
  if ("decisionDate" in body) patch.decisionDate = dateOrEmpty(body.decisionDate, "Decision date");
  if ("datesFlexible" in body) {
    if (typeof body.datesFlexible !== "boolean") throw invalid("Flexible dates must be on or off.");
    patch.datesFlexible = body.datesFlexible;
  }
  if ("attendees" in body) {
    const n = Number(body.attendees);
    if (!Number.isInteger(n) || n < 0 || n > 1_000_000) throw invalid("Attendees must be a whole number.");
    patch.attendees = n;
  }
  if ("budgetMin" in body) patch.budgetMin = moneyOrNull(body.budgetMin, "Budget minimum");
  if ("budgetMax" in body) patch.budgetMax = moneyOrNull(body.budgetMax, "Budget maximum");
  if ("responseDeadline" in body) {
    if (body.responseDeadline === "" || body.responseDeadline == null) patch.responseDeadline = null;
    else {
      const at = Date.parse(String(body.responseDeadline));
      if (Number.isNaN(at)) throw invalid("The response deadline must be a date and time.");
      patch.responseDeadline = new Date(at).toISOString();
    }
  }
  if ("eventId" in body) patch.eventId = body.eventId || null;
  if (!Object.keys(patch).length) throw invalid("Send at least one field to change.");
  if (patch.startDate && patch.endDate && patch.endDate < patch.startDate) throw invalid("The end date is before the start date.");
  return patch;
}

// A new draft the way the dashboard seeds one: two weeks to respond, a decision a week later, the creator as contact.
export function newRfpRow(body, { projectId, user, now = Date.now() }) {
  const brief = parseBrief({ ...body, title: body?.title ?? "" });
  const responseDeadline = brief.responseDeadline || defaultDeadline(now);
  return rfpToRow({
    ...brief,
    projectId,
    responseDeadline,
    decisionDate: brief.decisionDate || defaultDecisionDate(responseDeadline),
    status: "draft",
    createdBy: user.id,
    contactName: user.name || "",
    contactEmail: user.email || "",
  });
}

// The status moves the dashboard's list menu offers; anything else is refused.
const MOVES = {
  closed: ["sent"],
  sent: ["closed"],
  cancelled: ["draft", "sent", "closed"],
};

export function statusMove(current, next) {
  if (!RFP_STATUSES.includes(next) || !MOVES[next]) throw invalid("That status can't be set here.");
  if (!MOVES[next].includes(current)) throw new ApiError("invalid_state", 409, `An RFP that is ${current} can't move to ${next}.`);
  return next;
}

export function parseRecipient(body) {
  const name = text(body?.name, "Venue name", 200);
  if (!name) throw invalid("Name the venue.");
  const email = text(body?.email, "Email", 320).toLowerCase();
  if (email && !isEmail(email)) throw invalid("That email address doesn't look right.");
  return { source: "manual", name, contactName: text(body?.contactName, "Contact name", 200), email };
}

export const BID_MOVES = ["submitted", "shortlisted", "rejected"];

// rfp_award raises named errors; turn them into the dashboard's sentences.
export function awardError(message) {
  const known = {
    RFP_NOT_AWARDABLE: "This RFP can't be awarded in its current state.",
    BID_SUPERSEDED: "The venue has revised this bid — reload and award the latest version.",
    RECIPIENT_UNAVAILABLE: "This venue declined the RFP.",
    FORBIDDEN: "You don't have access to this RFP.",
  };
  const code = Object.keys(known).find((k) => String(message || "").includes(k));
  return code ? known[code] : "Couldn't award the bid.";
}
