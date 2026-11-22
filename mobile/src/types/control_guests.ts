// View models for Control's Guests and Registrations screens (../app/api/control/guests/*).

export type GuestNote = { id: string; body: string; createdAt: string | null };

export type GuestContact = {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  title: string;
  location: string;
  status: string;
  tags: string[];
  blocked: boolean;
  notes: GuestNote[];
  createdAt: string | null;
};

export type GuestContactPatch = Partial<Pick<GuestContact, "name" | "email" | "phone" | "company" | "title" | "location" | "tags">>;

export type GuestFeedNote = GuestNote & { createdBy: string | null; contactId: string; contactName: string; contactEmail: string };

export type GuestTag = { id: string | null; name: string; color: string; description: string; count: number };

export type GuestSegment = {
  id: string;
  name: string;
  description: string;
  color: string;
  rules: string[];
  handPicked: number;
  members: number;
};

export type DataRequestStatus = "New" | "In Progress" | "Completed" | "Rejected";

export type DataRequest = {
  id: string;
  email: string;
  type: "Export" | "Erasure" | "Rectification" | string;
  status: DataRequestStatus;
  note: string;
  dueAt: string | null;
  resolvedAt: string | null;
  overdue: boolean;
  createdAt: string | null;
};

export type RegistrationForm = {
  id: string;
  name: string;
  description: string;
  status: "Published" | "Draft";
  fields: number;
  updatedAt: string | null;
};

export type WaitlistEntry = { id: string; name: string; email: string; partySize: number; position: number | null; createdAt: string | null };

export type WaitlistPage = { waitlist: WaitlistEntry[]; canPromote: boolean; promoted?: number };

export type DietaryReport = {
  totals: { withNeeds: number; heads: number; dietary: number; accessibility: number };
  tags: { tag: string; count: number }[];
  questions: { question: string; counts: { label: string; count: number }[]; total: number }[];
  guests: { id: string; name: string; email: string; partySize: number; dietary: string; accessibility: string }[];
};

export type AttendeeExport = { filename: string; csv: string; count: number };
