// Control's Sourcing view models (Smart Custom Proposals, Instant Book), as /api/control/sourcing/* returns them.

export type RfpStatus = "draft" | "sent" | "closed" | "awarded" | "cancelled";

export type RfpListRow = {
  id: string;
  title: string;
  status: RfpStatus;
  eventId: string | null;
  eventName: string;
  attendees: number;
  location: string;
  currency: string;
  responseDeadline: string | null;
  invited: number;
  responded: number;
  best: number | null;
  createdAt: string | null;
};

export type RfpList = {
  rfps: RfpListRow[];
  stats: { open: number; drafts: number; waiting: number; received: number; avgVsBudget: number | null };
  events: { id: string; name: string }[];
};

export type Rfp = {
  id: string;
  projectId: string;
  eventId: string | null;
  title: string;
  summary: string;
  startDate: string;
  endDate: string;
  datesFlexible: boolean;
  attendees: number;
  location: string;
  fnbRequirements: string;
  avNeeds: string;
  budgetMin: number | null;
  budgetMax: number | null;
  currency: string;
  responseDeadline: string | null;
  decisionDate: string;
  status: RfpStatus;
  awardedAt: string | null;
  sentAt: string | null;
  notes: string;
};

export type RfpBidStatus = "submitted" | "shortlisted" | "awarded" | "rejected";

export type RfpRecipient = {
  id: string;
  name: string;
  contactName: string;
  email: string;
  source: string;
  status: "pending" | "invited" | "viewed" | "responded" | "declined" | "awarded" | "lost";
  invitedAt: string | null;
  declineReason: string;
  emailStatus: string;
  bid: {
    id: string;
    total: number;
    currency: string;
    status: RfpBidStatus;
    revision: number;
    submittedAt: string | null;
    capacity: number | null;
    message: string;
    validUntil: string;
  } | null;
};

export type RfpDetail = {
  rfp: Rfp;
  eventName: string;
  recipients: RfpRecipient[];
  readiness: string[];
  hasRequirements: boolean;
};

export type BookingDisplayStatus = "Confirmed" | "Hold" | "Hold expired" | "Completed" | "Cancelled";

export type VenueBooking = {
  id: string;
  reference: string;
  title: string;
  status: "confirmed" | "hold" | "cancelled";
  displayStatus: BookingDisplayStatus;
  liveHold: boolean;
  holdExpiresAt: string | null;
  startsAt: string;
  endsAt: string;
  when: string;
  timezone: string;
  spaceId: string;
  spaceName: string;
  venueId: string;
  venueName: string;
  eventId: string | null;
  eventName: string;
  setupStyle: string;
  attendees: number;
  total: number;
  currency: string;
  totalLabel: string;
  priceLines: { date: string; amount: string; detail: string }[];
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  notes: string;
  cancelReason: string;
  emails: { role: string; to: string; status: string; kind: string; at: string }[];
  calendarUrl: string;
};

export type BookingStats = {
  upcoming: number;
  hoursThisMonth: number;
  holds: number;
  holdsExpiringSoon: number;
  bookedValue: string;
  otherCurrencies: number;
};

export type BookingEmailResult = { ok: boolean; error: string; sent: { to: string; status: string }[] } | null;

export type Bookables = {
  venues: { id: string; name: string; city: string; timezone: string }[];
  spaces: {
    id: string;
    venueId: string;
    name: string;
    minHours: number;
    rates: string;
    capacities: { key: string; label: string; capacity: number }[];
  }[];
  events: { id: string; name: string }[];
  setupStyles: { value: string; label: string }[];
  holdHours: number[];
};

export type BookingQuote = {
  ok: boolean;
  message: string;
  timeZone: string;
  quote: { currency: string; total: string; priced: boolean; lines: { date: string; amount: string; detail: string }[] } | null;
};
