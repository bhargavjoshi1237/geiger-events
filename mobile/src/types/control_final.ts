// View models for Control's Capacity Limits, Branded App and Workflow Templates screens (../app/api/control/final/*).

export type CapacityRow = {
  id: string;
  name: string;
  type: string;
  date: string | null;
  capacity: number;
  buffer: number;
  effective: number;
  seats: number;
  checkedIn: number;
  pending: number;
  waitlisted: number;
  fill: number;
  remaining: number;
  full: boolean;
};

export type CapacityPayload = {
  events: CapacityRow[];
  stats: { atCapacity: number; totalSeats: number; averageFill: number };
  canEdit: boolean;
};

export type AppSectionKey =
  | "memberships"
  | "live"
  | "watch"
  | "orders"
  | "community"
  | "qa"
  | "messages"
  | "notifications"
  | "agenda"
  | "speakers"
  | "sponsors"
  | "map"
  | "networking"
  | "discussions";

export type ShortcutKey = "community" | "watch" | "memberships" | "live" | "orders" | "qa";

export type BrandedAppConfig = {
  sections: Record<AppSectionKey, boolean>;
  home: { welcome: string; liveStrip: boolean; recentOrders: boolean; shortcuts: ShortcutKey[] };
  whiteLabel: { appName: string; orgName: string; version: string; themeMode: string; accent: string };
};

export type WorkflowTemplate = {
  id: string;
  name: string;
  description: string;
  category: "Ticketing" | "Engagement" | "Operations" | "Reminders";
  trigger: string;
  triggerLabel: string;
  steps: number;
};
