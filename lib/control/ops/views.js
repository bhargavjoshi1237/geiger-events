import { ApiError } from "../../staff_access/errors.js";

// View models and validators for Control's templates, series, venues, workflows and campaigns screens, mirroring the dashboard's data layers.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function invalid(message, key) {
  return new ApiError("invalid_input", 400, message, key ? { [key]: message } : undefined);
}

const bag = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});

// --- Templates (events.event_templates) ---------------------------------------

export function templateView(row) {
  const blueprint = bag(bag(row.metadata).blueprint);
  return {
    id: row.id,
    name: row.name ?? "",
    description: row.description ?? "",
    category: row.category ?? "Community",
    uses: Number(row.uses ?? 0),
    blueprint: {
      type: blueprint.type || "In-person",
      capacity: Number(blueprint.capacity) || 0,
      visibility: blueprint.visibility || "Public",
      timezone: blueprint.timezone || "Europe/London",
      summary: blueprint.summary || "",
    },
  };
}

// The draft the dashboard's "Use template" creates, minus its placeholder date and venue: the organiser sets those next.
export function eventFromTemplate(template, { projectId, userId }) {
  const { blueprint } = templateView(template);
  return {
    name: template.name || "Untitled event",
    status: "Draft",
    type: blueprint.type,
    timezone: blueprint.timezone,
    capacity: blueprint.capacity,
    visibility: blueprint.visibility,
    summary: blueprint.summary,
    project_id: projectId,
    created_by: userId,
  };
}

// --- Series (events.event_series) ---------------------------------------------

export function seriesView(row, eventCount = 0) {
  const settings = bag(row.settings);
  return {
    id: row.id,
    name: row.name ?? "",
    description: row.description ?? "",
    status: row.status ?? "Draft",
    cadence: row.cadence ?? "Monthly",
    visibility: row.visibility ?? "Public",
    followPage: Boolean(settings.followPage),
    eventCount,
  };
}

// --- Venues (events.venues + venue_spaces) ------------------------------------

export const VENUE_TYPES = ["Indoor", "Outdoor", "Hybrid", "Virtual"];
export const VENUE_STATUSES = ["Active", "Inactive", "Archived"];

export function venueView(row) {
  return {
    id: row.id,
    name: row.name ?? "",
    type: row.type ?? "Indoor",
    status: row.status ?? "Active",
    description: row.description ?? "",
    address: row.address ?? "",
    city: row.city ?? "",
    region: row.region ?? "",
    postcode: row.postcode ?? "",
    country: row.country ?? "",
    timezone: row.timezone ?? "Europe/London",
    seatedCapacity: Number(row.seated_capacity ?? 0),
    standingCapacity: Number(row.standing_capacity ?? 0),
    spaces: Number(row.spaces ?? 0),
    parkingNotes: row.parking_notes ?? "",
    transitNotes: row.transit_notes ?? "",
    contactName: row.contact_name ?? "",
    contactEmail: row.contact_email ?? "",
    contactPhone: row.contact_phone ?? "",
    website: row.website ?? "",
    coverUrl: row.cover_url ?? "",
  };
}

const VENUE_TEXT = {
  name: ["name", 200],
  description: ["description", 5000],
  address: ["address", 300],
  city: ["city", 120],
  region: ["region", 120],
  postcode: ["postcode", 40],
  country: ["country", 120],
  parkingNotes: ["parking_notes", 2000],
  transitNotes: ["transit_notes", 2000],
  contactName: ["contact_name", 200],
  contactPhone: ["contact_phone", 60],
};

function validZone(zone) {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

// The venue editor's core fields → a column patch; anything left out stays as it is.
export function parseVenuePatch(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw invalid("Send the fields to change.");
  const row = {};
  for (const [key, [column, max]] of Object.entries(VENUE_TEXT)) {
    if (!(key in body)) continue;
    const value = typeof body[key] === "string" ? body[key].trim() : body[key] == null ? "" : null;
    if (value === null) throw invalid(`${key} must be text.`, key);
    if (value.length > max) throw invalid(`${key} must be ${max} characters or fewer.`, key);
    row[column] = value;
  }
  if ("name" in row && !row.name) throw invalid("Give the venue a name.", "name");
  if ("type" in body) {
    if (!VENUE_TYPES.includes(body.type)) throw invalid(`Type must be one of ${VENUE_TYPES.join(", ")}.`, "type");
    row.type = body.type;
  }
  if ("status" in body) {
    if (!VENUE_STATUSES.includes(body.status)) throw invalid(`Status must be one of ${VENUE_STATUSES.join(", ")}.`, "status");
    row.status = body.status;
  }
  if ("timezone" in body) {
    if (typeof body.timezone !== "string" || !validZone(body.timezone)) throw invalid("That time zone isn't recognised.", "timezone");
    row.timezone = body.timezone;
  }
  for (const [key, column] of [["seatedCapacity", "seated_capacity"], ["standingCapacity", "standing_capacity"]]) {
    if (!(key in body)) continue;
    const n = Number(body[key]);
    if (!Number.isInteger(n) || n < 0 || n > 10_000_000) throw invalid("Capacity must be a whole number, 0 or more.", key);
    row[column] = n;
  }
  if ("contactEmail" in body) {
    const email = String(body.contactEmail ?? "").trim().toLowerCase();
    if (email && !EMAIL.test(email)) throw invalid("Enter a valid email address, or leave it blank.", "contactEmail");
    row.contact_email = email;
  }
  if ("website" in body) {
    const url = String(body.website ?? "").trim();
    if (url && !/^https?:\/\/\S+$/i.test(url)) throw invalid("The website must start with http:// or https://.", "website");
    row.website = url;
  }
  if (!Object.keys(row).length) throw invalid("Send at least one field to change.");
  return row;
}

export function spaceView(row) {
  const capacities = bag(row.capacities);
  const counts = Object.values(capacities).map(Number).filter((n) => Number.isFinite(n) && n > 0);
  return {
    id: row.id,
    name: row.name ?? "",
    kind: row.kind ?? "room",
    floor: row.floor ?? "",
    maxCapacity: counts.length ? Math.max(...counts) : 0,
    bookable: row.bookable === true,
    currency: row.rate_currency || "GBP",
    rateHourly: row.rate_hourly == null ? null : Number(row.rate_hourly),
  };
}

// --- Workflows (events.workflows + workflow_runs) -----------------------------

export const TRIGGER_LABELS = {
  "ticket.purchased": "Ticket purchased",
  "registration.submitted": "Registration submitted",
  "rsvp.confirmed": "RSVP confirmed",
  "refund.issued": "Refund issued",
  "payment.failed": "Payment failed",
  "attendee.checked_in": "Attendee checked in",
  "waitlist.joined": "Waitlist joined",
  "event.published": "Event published",
  "event.starting_soon": "Event starting soon",
  "attendee.no_show": "Attendee no-show",
};

export function workflowView(row) {
  return {
    id: row.id,
    name: row.name ?? "",
    description: row.description ?? "",
    status: row.status ?? "Draft",
    trigger: row.trigger ?? "",
    triggerLabel: TRIGGER_LABELS[row.trigger] || row.trigger || "No trigger",
    scope: row.scope ?? "workspace",
    eventId: row.event_id ?? null,
    steps: Array.isArray(row.steps) ? row.steps.length : 0,
    runCount: Number(row.run_count ?? 0),
    lastRunAt: row.last_run_at ?? null,
  };
}

// Same toggle as the dashboard: Active ↔ Paused; a draft is published by switching it on.
export function parseWorkflowStatus(body) {
  if (body?.status !== "Active" && body?.status !== "Paused") throw invalid("Status must be Active or Paused.", "status");
  return body.status;
}

export function runView(row, workflowName = "") {
  return {
    id: row.id,
    workflowId: row.workflow_id ?? null,
    workflowName,
    trigger: row.trigger ?? "",
    triggerLabel: TRIGGER_LABELS[row.trigger] || row.trigger || "",
    status: row.status ?? "Success",
    startedAt: row.started_at ?? null,
    durationMs: Number(row.duration_ms ?? 0),
    stepsTotal: Number(row.steps_total ?? 0),
    stepsCompleted: Number(row.steps_completed ?? 0),
    error: row.error ?? "",
  };
}

// --- Campaigns (events.campaigns) ---------------------------------------------

// The dashboard's sidebar lenses over one campaigns table.
export const CAMPAIGN_LENSES = {
  newsletters: { channel: "email", type: "newsletter", title: "Newsletters" },
  invites: { channel: "email", type: "invite", title: "Email Invites" },
  reminders: { channel: null, type: "reminder", title: "Automated Reminders" },
};

export function campaignView(row) {
  const content = bag(row.content);
  const metrics = bag(row.metrics);
  return {
    id: row.id,
    name: row.name ?? "Untitled campaign",
    channel: row.channel ?? "email",
    type: row.type ?? "newsletter",
    status: row.status ?? "draft",
    segmentId: row.segment_id ?? null,
    eventId: row.event_id ?? null,
    scheduledAt: row.scheduled_at ?? null,
    sentAt: row.sent_at ?? null,
    subject: content.subject || content.pushTitle || "",
    body: typeof content.body === "string" ? content.body : "",
    metrics: {
      recipients: Number(metrics.recipients) || 0,
      delivered: Number(metrics.delivered) || 0,
      opened: Number(metrics.opened) || 0,
      clicked: Number(metrics.clicked) || 0,
    },
  };
}

const DEFAULT_METRICS = { recipients: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 };

// The campaign editor's buttons as transitions. The dashboard records sends; it doesn't dispatch mail from here either.
export function campaignTransition(row, action, { scheduledAt = null, recipients = 0, now = new Date() } = {}) {
  const status = row.status ?? "draft";
  if (action === "schedule") {
    if (status !== "draft") throw new ApiError("invalid_state", 409, "Only a draft can be scheduled.");
    const at = typeof scheduledAt === "string" ? Date.parse(scheduledAt) : NaN;
    if (Number.isNaN(at)) throw invalid("Pick a send date and time first.", "scheduledAt");
    return { status: "scheduled", scheduled_at: new Date(at).toISOString() };
  }
  if (action === "send") {
    if (status !== "draft" && status !== "scheduled") throw new ApiError("invalid_state", 409, "This campaign has already gone out.");
    return {
      status: "sent",
      sent_at: now.toISOString(),
      metrics: { ...DEFAULT_METRICS, ...bag(row.metrics), recipients, delivered: recipients },
    };
  }
  if (action === "unschedule") {
    if (status !== "scheduled") throw new ApiError("invalid_state", 409, "Only a scheduled campaign can be unscheduled.");
    return { status: "draft", scheduled_at: null };
  }
  if (action === "draft") {
    if (status === "draft") throw new ApiError("invalid_state", 409, "This campaign is already a draft.");
    return { status: "draft" };
  }
  throw invalid("Unknown action.", "action");
}

export function deliverabilityView(config) {
  const d = bag(bag(config).deliverability);
  return {
    fromName: d.fromName || "",
    fromEmail: d.fromEmail || "",
    replyTo: d.replyTo || "",
    sendingDomain: d.sendingDomain || "",
    domainVerified: Boolean(d.domainVerified),
    dkim: Boolean(d.dkim),
    spf: Boolean(d.spf),
    dailyCap: Number(d.dailyCap) || 0,
  };
}
