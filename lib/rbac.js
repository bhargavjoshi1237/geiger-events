export const WORKSPACE_PERMISSIONS = [
  { key: "view.overview", label: "Overview", group: "Workspace views" },
  { key: "view.projects", label: "Projects", group: "Workspace views" },
  { key: "view.reporting", label: "Reporting", group: "Workspace views" },
  { key: "view.inbox", label: "Inbox", group: "Workspace views" },
  { key: "view.team", label: "Team", group: "Workspace views" },
  { key: "view.roles", label: "Roles", group: "Workspace views" },
  { key: "view.usage", label: "Usage", group: "Workspace views" },
  { key: "view.billing", label: "Billing", group: "Workspace views" },
  { key: "view.workflows", label: "Workflows", group: "Workspace views" },
  { key: "view.advertising", label: "Advertising", group: "Workspace views" },
  { key: "view.venues", label: "Venues", group: "Workspace views" },
  { key: "view.discovery", label: "Discovery", group: "Workspace views" },
  { key: "view.guests", label: "Guests", group: "Workspace views" },
  {
    key: "view.organization_settings",
    label: "Organization settings",
    group: "Workspace views",
  },
  { key: "team.invite", label: "Invite members", group: "Team control" },
  { key: "team.assign_roles", label: "Assign roles", group: "Team control" },
  { key: "roles.manage", label: "Create and edit roles", group: "Team control" },
  { key: "billing.manage", label: "Manage billing", group: "Administration" },
  { key: "settings.manage", label: "Manage settings", group: "Administration" },
];

export const ROLE_STORAGE_KEY = "flow.workspace.roles";

// Every permission key in the catalog (used for the Owner "grants everything").
export const ALL_PERMISSION_KEYS = WORKSPACE_PERMISSIONS.map((p) => p.key);

const VIEW_KEYS = WORKSPACE_PERMISSIONS.filter((p) =>
  p.key.startsWith("view."),
).map((p) => p.key);

// The five system roles seeded per project (events.roles, is_system=true). Their
// permission toggles are locked in the UI; a project always has at least one
// Owner. `key` is a stable slug; `permissions` are WORKSPACE_PERMISSIONS keys.
export const SYSTEM_ROLE_SEED = [
  {
    key: "owner",
    name: "Owner",
    description: "Full access to everything, including billing.",
    color: "violet",
    permissions: ALL_PERMISSION_KEYS,
  },
  {
    key: "admin",
    name: "Admin",
    description: "Manage the workspace, team and roles — no billing control.",
    color: "blue",
    permissions: ALL_PERMISSION_KEYS.filter((k) => k !== "billing.manage"),
  },
  {
    key: "manager",
    name: "Manager",
    description: "Run events and invite teammates; can't edit roles or billing.",
    color: "emerald",
    permissions: [...VIEW_KEYS, "team.invite", "team.assign_roles"],
  },
  {
    key: "member",
    name: "Member",
    description: "Day-to-day operational access to the workspace.",
    color: "amber",
    permissions: [
      "view.overview",
      "view.reporting",
      "view.inbox",
      "view.guests",
      "view.workflows",
      "view.advertising",
      "view.venues",
      "view.discovery",
    ],
  },
  {
    key: "viewer",
    name: "Viewer",
    description: "Read-only access to the overview and reports.",
    color: "slate",
    permissions: ["view.overview", "view.reporting", "view.usage"],
  },
];

export function normalizeRoleId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function mergeWorkspaceRoles(customRoles = []) {
  const byId = new Map();

  customRoles.forEach((role) => {
    if (!role?.id) return;
    byId.set(role.id, {
      ...role,
      permissions: Array.isArray(role.permissions) ? role.permissions : [],
      system: Boolean(role.system),
    });
  });

  return Array.from(byId.values());
}

export function getRoleById(roles, roleId) {
  return (
    roles.find((role) => role.id === roleId) ||
    roles.find((role) => role.id === "manager") ||
    roles[0]
  );
}

export function roleHasPermission(roles, roleId, permissionKey) {
  if (!roles?.length) {
    return true;
  }

  const role = getRoleById(roles, roleId);
  return Boolean(role?.permissions?.includes(permissionKey));
}

export function tabPermissionKey(title) {
  const normalized = normalizeRoleId(title);
  return `view.${normalized}`;
}
