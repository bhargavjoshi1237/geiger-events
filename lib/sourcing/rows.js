// snake_case rows <-> camelCase view models for the RFP tables. Pure, so API routes and the client share it.

import {
  CURRENCIES,
  RFP_STATUSES,
  RECIPIENT_SOURCES,
  RECIPIENT_STATUSES,
  BID_STATUSES,
  normalizeAlternateDates,
  normalizeConcessions,
  normalizeLineItems,
  normalizeRoomRequirements,
  normalizeSleepingRooms,
  normalizeWeights,
  roomRequirementsToJson,
  toNumber,
} from "./rfp_model.js";

const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
const dateOnly = (v) => (v ? String(v).slice(0, 10) : "");

export function normalizeRfp(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    eventId: row.event_id ?? null,
    title: row.title ?? "",
    summary: row.summary ?? "",
    startDate: dateOnly(row.start_date),
    endDate: dateOnly(row.end_date),
    datesFlexible: Boolean(row.dates_flexible),
    alternateDates: normalizeAlternateDates(row.alternate_dates),
    attendees: Number(row.attendees ?? 0),
    location: row.location ?? "",
    roomRequirements: normalizeRoomRequirements(row.room_requirements),
    sleepingRooms: normalizeSleepingRooms(row.sleeping_rooms),
    fnbRequirements: row.fnb_requirements ?? "",
    fnbMinimum: toNumber(row.fnb_minimum),
    avNeeds: row.av_needs ?? "",
    budgetMin: toNumber(row.budget_min),
    budgetMax: toNumber(row.budget_max),
    currency: row.currency || "USD",
    shareBudget: Boolean(row.share_budget),
    responseDeadline: row.response_deadline ?? null,
    decisionDate: dateOnly(row.decision_date),
    status: RFP_STATUSES.includes(row.status) ? row.status : "draft",
    awardedBidId: row.awarded_bid_id ?? null,
    awardedVenueId: row.awarded_venue_id ?? null,
    awardedAt: row.awarded_at ?? null,
    sentAt: row.sent_at ?? null,
    scoringWeights: normalizeWeights(row.scoring_weights),
    contactName: row.contact_name ?? "",
    contactEmail: row.contact_email ?? "",
    notes: row.notes ?? "",
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

// Emits a column only when its key is present, so one update serves a full save or a single field.
export function rfpToRow(input) {
  const row = {};
  const has = (k) => k in input;
  if (has("projectId")) row.project_id = input.projectId;
  if (has("eventId")) row.event_id = input.eventId || null;
  if (has("title")) row.title = String(input.title || "").trim() || "Untitled RFP";
  if (has("summary")) row.summary = input.summary || "";
  if (has("startDate")) row.start_date = input.startDate || null;
  if (has("endDate")) row.end_date = input.endDate || null;
  if (has("datesFlexible")) row.dates_flexible = Boolean(input.datesFlexible);
  if (has("alternateDates")) row.alternate_dates = normalizeAlternateDates(input.alternateDates).filter((d) => d.start);
  if (has("attendees")) row.attendees = Math.max(0, Math.round(Number(input.attendees) || 0));
  if (has("location")) row.location = input.location || "";
  if (has("roomRequirements")) row.room_requirements = roomRequirementsToJson(input.roomRequirements);
  if (has("sleepingRooms")) row.sleeping_rooms = normalizeSleepingRooms(input.sleepingRooms);
  if (has("fnbRequirements")) row.fnb_requirements = input.fnbRequirements || "";
  if (has("fnbMinimum")) row.fnb_minimum = toNumber(input.fnbMinimum);
  if (has("avNeeds")) row.av_needs = input.avNeeds || "";
  if (has("budgetMin")) row.budget_min = toNumber(input.budgetMin);
  if (has("budgetMax")) row.budget_max = toNumber(input.budgetMax);
  if (has("currency")) row.currency = CURRENCIES.includes(input.currency) ? input.currency : "USD";
  if (has("shareBudget")) row.share_budget = Boolean(input.shareBudget);
  if (has("responseDeadline")) row.response_deadline = input.responseDeadline || null;
  if (has("decisionDate")) row.decision_date = input.decisionDate || null;
  if (has("status")) row.status = RFP_STATUSES.includes(input.status) ? input.status : "draft";
  if (has("scoringWeights")) row.scoring_weights = normalizeWeights(input.scoringWeights);
  if (has("contactName")) row.contact_name = input.contactName || "";
  if (has("contactEmail")) row.contact_email = String(input.contactEmail || "").trim();
  if (has("notes")) row.notes = input.notes || "";
  if (has("createdBy")) row.created_by = input.createdBy || null;
  return row;
}

export function normalizeRecipient(row) {
  if (!row) return null;
  return {
    id: row.id,
    rfpId: row.rfp_id ?? null,
    projectId: row.project_id ?? null,
    source: RECIPIENT_SOURCES.includes(row.source) ? row.source : "manual",
    venueId: row.venue_id ?? null,
    pipelineRecordId: row.pipeline_record_id ?? null,
    name: row.name ?? "",
    contactName: row.contact_name ?? "",
    email: row.email ?? "",
    details: obj(row.details),
    status: RECIPIENT_STATUSES.includes(row.status) ? row.status : "invited",
    invitedAt: row.invited_at ?? null,
    viewedAt: row.viewed_at ?? null,
    respondedAt: row.responded_at ?? null,
    declinedAt: row.declined_at ?? null,
    declineReason: row.decline_reason ?? "",
    lastEmailedAt: row.last_emailed_at ?? null,
    emailStatus: obj(row.email_status),
    createdAt: row.created_at ?? null,
  };
}

export function recipientToRow(input) {
  const row = {};
  const has = (k) => k in input;
  if (has("rfpId")) row.rfp_id = input.rfpId;
  if (has("projectId")) row.project_id = input.projectId;
  if (has("source")) row.source = RECIPIENT_SOURCES.includes(input.source) ? input.source : "manual";
  if (has("venueId")) row.venue_id = input.venueId || null;
  if (has("pipelineRecordId")) row.pipeline_record_id = input.pipelineRecordId || null;
  if (has("name")) row.name = String(input.name || "").trim();
  if (has("contactName")) row.contact_name = String(input.contactName || "").trim();
  if (has("email")) row.email = String(input.email || "").trim().toLowerCase();
  if (has("details")) row.details = obj(input.details);
  if (has("createdBy")) row.created_by = input.createdBy || null;
  return row;
}

export function normalizeBid(row) {
  if (!row) return null;
  return {
    id: row.id,
    rfpId: row.rfp_id ?? null,
    recipientId: row.recipient_id ?? null,
    projectId: row.project_id ?? null,
    revision: Number(row.revision ?? 1),
    isCurrent: row.is_current !== false,
    lineItems: normalizeLineItems(row.line_items),
    subtotal: Number(row.subtotal ?? 0),
    taxesFees: Number(row.taxes_fees ?? 0),
    total: Number(row.total ?? 0),
    currency: row.currency || "USD",
    capacity: toNumber(row.capacity),
    concessions: normalizeConcessions(row.concessions),
    depositPct: toNumber(row.deposit_pct),
    attritionPct: toNumber(row.attrition_pct),
    cancellationPolicy: row.cancellation_policy ?? "",
    availabilityNotes: row.availability_notes ?? "",
    validUntil: dateOnly(row.valid_until),
    message: row.message ?? "",
    submittedByName: row.submitted_by_name ?? "",
    submittedAt: row.submitted_at ?? null,
    status: BID_STATUSES.includes(row.status) ? row.status : "submitted",
  };
}

export function normalizePreset(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    name: row.name ?? "",
    description: row.description ?? "",
    requirements: obj(row.requirements),
    createdAt: row.created_at ?? null,
  };
}
