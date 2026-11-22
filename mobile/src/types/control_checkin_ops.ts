// View models for Control's check-in operations (../../app/api/control/checkin_ops/**).

export type StaffRoleType = "staff" | "kiosk";

export type StaffRolePermissions = {
  canScan: boolean;
  canSell: boolean;
  canOverride: boolean;
  gates: string[];
  zones: string[];
};

export type StaffRole = {
  id: string;
  name: string;
  type: StaffRoleType;
  accessCode: string;
  active: boolean;
  permissions: StaffRolePermissions;
  createdAt: string | null;
};

export type NamedArea = { id: string; name: string };

export type StaffRolesResponse = { roles: StaffRole[]; gates: NamedArea[]; zones: NamedArea[] };

export type CapacityLevel = "none" | "ok" | "warn" | "full" | "over";
export type ReentryRule = "inherit" | "once" | "multi";

export type CapacityCard = {
  key: string;
  saveKey: string;
  name: string;
  venue: boolean;
  unlisted: boolean;
  cap: number | null;
  warnPct: number;
  reentry: ReentryRule;
  occupancy: number;
  admitted: number;
  exited: number;
  overCapacityAdmits: number;
  level: CapacityLevel;
  pct: number | null;
  lastMovementAt: string | null;
};

export type CapacityOverride = {
  id: string;
  zone: string;
  attendeeName: string;
  partySize: number;
  occupancy: number;
  cap: number;
  reason: string;
  roleName: string;
  staff: string;
  createdAt: string | null;
};

export type CapacityBoard = {
  event: { id: string; name: string; capacity: number | null };
  cards: CapacityCard[];
  overrides: CapacityOverride[];
};

export type LiveAttendance = {
  events: { id: string; name: string; when: string; date: string | null; time: string | null; venue: string | null; admitted: number; expected: number }[];
  totals: { admitted: number; expected: number };
  recent: { id: string; eventId: string | null; eventName: string; name: string; code: string; area: string; method: string; by: string; at: string }[];
};

export type Lead = {
  id: string;
  eventId: string | null;
  eventName: string;
  exhibitor: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  title: string;
  notes: string;
  capturedAt: string | null;
};

export type BadgeStatus = "active" | "unassigned" | "lost" | "revoked" | "replaced";

export type SmartBadge = {
  id: string;
  serial: string;
  label: string;
  uid: string;
  status: BadgeStatus;
  holderName: string;
  holderEmail: string;
  notes: string;
  issuedAt: string | null;
};

export type BadgesResponse = { badges: SmartBadge[]; total: number; counts: Record<BadgeStatus, number> };
