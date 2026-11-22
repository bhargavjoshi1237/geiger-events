import type { ControlEvent, ControlTotals } from "@/types/portal";

// View models for Control's templates, series, venues, workflows, campaigns and analytics screens (../app/api/control/ops/*).

export type OpsTemplate = {
  id: string;
  name: string;
  description: string;
  category: string;
  uses: number;
  blueprint: { type: string; capacity: number; visibility: string; timezone: string; summary: string };
};

export type OpsSeries = {
  id: string;
  name: string;
  description: string;
  status: string;
  cadence: string;
  visibility: string;
  followPage: boolean;
  eventCount: number;
};

export type OpsSeriesDetail = { series: OpsSeries; events: ControlEvent[]; candidates: ControlEvent[] };

export type OpsVenue = {
  id: string;
  name: string;
  type: "Indoor" | "Outdoor" | "Hybrid" | "Virtual";
  status: "Active" | "Inactive" | "Archived";
  description: string;
  address: string;
  city: string;
  region: string;
  postcode: string;
  country: string;
  timezone: string;
  seatedCapacity: number;
  standingCapacity: number;
  spaces: number;
  parkingNotes: string;
  transitNotes: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  website: string;
  coverUrl: string;
};

export type OpsSpace = {
  id: string;
  name: string;
  kind: string;
  floor: string;
  maxCapacity: number;
  bookable: boolean;
  currency: string;
  rateHourly: number | null;
};

export type OpsVenueDetail = { venue: OpsVenue; spaces: OpsSpace[] };

export type OpsWorkflow = {
  id: string;
  name: string;
  description: string;
  status: "Active" | "Paused" | "Draft";
  trigger: string;
  triggerLabel: string;
  scope: string;
  eventId: string | null;
  steps: number;
  runCount: number;
  lastRunAt: string | null;
};

export type OpsRun = {
  id: string;
  workflowId: string | null;
  workflowName: string;
  trigger: string;
  triggerLabel: string;
  status: "Success" | "Failed" | "Running" | "Skipped";
  startedAt: string | null;
  durationMs: number;
  stepsTotal: number;
  stepsCompleted: number;
  error: string;
};

export type OpsCampaignLens = "newsletters" | "invites" | "reminders";

export type OpsCampaign = {
  id: string;
  name: string;
  channel: string;
  type: string;
  status: "draft" | "scheduled" | "sending" | "sent" | "paused";
  segmentId: string | null;
  eventId: string | null;
  scheduledAt: string | null;
  sentAt: string | null;
  subject: string;
  body: string;
  metrics: { recipients: number; delivered: number; opened: number; clicked: number };
};

export type OpsCampaignDetail = { campaign: OpsCampaign; audience: string; estimate: number };

export type OpsDeliverability = {
  fromName: string;
  fromEmail: string;
  replyTo: string;
  sendingDomain: string;
  domainVerified: boolean;
  dkim: boolean;
  spf: boolean;
  dailyCap: number;
};

export type OpsTopEvent = {
  id: string;
  name: string;
  date: string | null;
  status: string;
  revenue: number;
  sold: number;
  checkedIn: number;
  capacity: number;
};

export type OpsSummary = {
  totals: ControlTotals & { events: number; checkedIn: number; showRate: number };
  recent: ControlTotals;
  byDay: { date: string; sold: number; revenue: number }[];
  topEvents: OpsTopEvent[];
};
