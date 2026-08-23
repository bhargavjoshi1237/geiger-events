import { defineRbacConfig, defineRole } from "@geiger/rbac";

import { ADDON_PERMISSIONS } from "@/addons";

// The @geiger/rbac catalog for Geiger Events.
//
// This is the TRUSTED half of authorization: permission keys, what each one is
// scoped by, and the conditions attached to it are all declared here, in
// versioned code. The database only ever stores which roles exist, which keys
// they carry, and who holds them — customers compose roles and narrow grants,
// they never author a predicate.
//
// Keys are "<product>.<resource>.<action>". The old catalog was nav-shaped
// (view.orders), which could only ever gate a sidebar entry; the resource/action
// split lets the same engine gate an operation and compile to an RLS policy.
//
// Titles below must match components/internal/sidebar/sidebar_nav.jsx exactly —
// navPermissionKey() derives a key from a nav title, so a renamed section needs
// its key renamed here too (and a migration to rewrite stored role rows).

// Nav-section slug, matching the old normalizeRoleId() so backfilled keys line
// up with what the migration rewrites.
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

// Every top-level sidebar section. Sub-items inherit their section's gate — the
// nav filter only ever tests top-level titles.
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

// An addon declares nav-shaped keys in its manifest (view.affiliates). Translate
// them into this namespace so an addon's gate rides the same code path as core
// nav and cannot route around RBAC.
const addonPermissions = (ADDON_PERMISSIONS || [])
  .filter((p) => typeof p?.key === "string" && p.key.startsWith("view."))
  .map((p) => ({
    key: `events.${navSlug(p.key.slice("view.".length))}.view`,
    label: p.label || p.key,
    group: p.group || "Workspace views",
  }));

// Real operations. These are the keys worth gating a button on — and the ones
// that will back RLS policies as tables are tightened one at a time.
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
    // Custom CSS/JS and raw-HTML blocks ship to the public page unfiltered, so
    // the page builder gates that surface separately from ordinary editing.
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
    // events.event_orders.status is 'confirmed' until a refund lands; a fully
    // refunded order must not be refundable again.
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

// De-duplicate: an addon may legitimately reuse a key a core section already
// declares (its nav title matching an existing section).
const uniquePermissions = Array.from(
  new Map(permissions.map((p) => [p.key, p])).values(),
);

const viewKeys = uniquePermissions
  .filter((p) => p.key.endsWith(".view"))
  .map((p) => p.key);

// The five roles seeded into public.roles for a project the first time it needs
// them. Owner holds "*" — the wildcard is what "the project owner can set all
// things" means, and it keeps granting new permissions automatically as the
// catalog grows.
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
