import { defineRbacConfig, defineRole } from "@geiger/rbac";

import { ADDON_PERMISSIONS } from "@/addons";

export function navSlug(title) {
  return String(title || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function navPermissionKey(title) {
  return `events.${navSlug(title)}.view`;
}

const NAV_SECTIONS = [
  "Overview",
  "Events",
  "Packages",
  "Venues",
  "Event Design",
  "Sourcing",
  "Registrations",
  "Guests",
  "Tickets",
  "Orders",
  "Inventory",
  "Memberships",
  "Check-in",
  "Analytics",
  "Campaigns",
  "Advertising",
  "Workflows",
  "Discovery",
  "Community",
  "Program",
  "Speakers",
  "Sponsors & Expo",
  "Broadcast & On-demand",
  "Settings",
];

const navPermissions = NAV_SECTIONS.map((title) => ({
  key: navPermissionKey(title),
  label: title,
  group: "Workspace views",
}));

const addonPermissions = (ADDON_PERMISSIONS || [])
  .filter((p) => typeof p?.key === "string" && p.key.startsWith("view."))
  .map((p) => ({
    key: `events.${navSlug(p.key.slice("view.".length))}.view`,
    label: p.label || p.key,
    group: p.group || "Workspace views",
  }));

const operationPermissions = [
  {
    key: "events.event.edit",
    label: "Edit an event",
    group: "Events",
    scopeBy: "event",
  },
  {
    key: "events.event.publish",
    label: "Publish an event",
    group: "Events",
    scopeBy: "event",
  },
  {
    key: "events.event.delete",
    label: "Delete an event",
    group: "Events",
    scopeBy: "event",
  },
  {
    key: "events.page.customcode",
    label: "Add custom code to a page",
    group: "Events",
    scopeBy: "event",
  },
  {
    key: "events.order.refund",
    label: "Refund an order",
    group: "Orders",
    scopeBy: "event",
    condition: { field: "order.status", op: "ne", value: "refunded" },
  },
  {
    key: "events.team.invite",
    label: "Invite Members",
    group: "Team Control",
  },
  {
    key: "events.team.assign",
    label: "Assign roles",
    group: "Team Control",
  },
  {
    key: "events.role.manage",
    label: "Create and edit roles",
    group: "Team Control",
  },
  {
    key: "events.billing.manage",
    label: "Manage billing",
    group: "Administration",
  },
  {
    key: "events.settings.manage",
    label: "Manage settings",
    group: "Administration",
  },
];

const permissions = [
  ...navPermissions,
  ...addonPermissions,
  ...operationPermissions,
];

const uniquePermissions = Array.from(
  new Map(permissions.map((p) => [p.key, p])).values(),
);

const viewKeys = uniquePermissions
  .filter((p) => p.key.endsWith(".view"))
  .map((p) => p.key);

const systemRoles = [
  defineRole({
    key: "owner",
    name: "Owner",
    description: "Full access to everything, including billing.",
    color: "violet",
    permissions: ["*"],
    sort: 0,
  }),
  defineRole({
    key: "admin",
    name: "Admin",
    description: "Manage the workspace, team and roles — no billing control.",
    color: "blue",
    permissions: [
      ...viewKeys,
      "events.event.edit",
      "events.event.publish",
      "events.event.delete",
      "events.page.customcode",
      "events.order.refund",
      "events.team.invite",
      "events.team.assign",
      "events.role.manage",
      "events.settings.manage",
    ],
    sort: 1,
  }),
  defineRole({
    key: "manager",
    name: "Manager",
    description: "Run events and invite teammates; can't edit roles or billing.",
    color: "emerald",
    permissions: [
      ...viewKeys,
      "events.event.edit",
      "events.event.publish",
      "events.order.refund",
      "events.team.invite",
      "events.team.assign",
    ],
    sort: 2,
  }),
  defineRole({
    key: "member",
    name: "Member",
    description: "Day-to-day operational access to the workspace.",
    color: "amber",
    permissions: [
      "events.overview.view",
      "events.events.view",
      "events.registrations.view",
      "events.guests.view",
      "events.check_in.view",
      "events.analytics.view",
      "events.community.view",
      "events.workflows.view",
      "events.event.edit",
    ],
    sort: 3,
  }),
  defineRole({
    key: "viewer",
    name: "Viewer",
    description: "Read-only access to the overview and reports.",
    color: "slate",
    permissions: ["events.overview.view", "events.analytics.view"],
    sort: 4,
  }),
];

export default defineRbacConfig({
  product: "events",
  permissions: uniquePermissions,
  systemRoles,
});
