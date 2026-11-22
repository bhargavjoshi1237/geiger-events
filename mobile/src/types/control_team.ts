// View models for Control's Settings and Discovery screens (../app/api/control/team/**).

export type TeamMember = {
  id: string;
  userId: string | null;
  name: string;
  email: string;
  status: "active" | "invited" | "suspended" | string;
  roleId: string | null;
  roleName: string | null;
  invitedAt: string | null;
  joinedAt: string | null;
  lastActiveAt: string | null;
};

export type TeamRoleOption = { id: string; name: string; isOwner: boolean };

export type TeamRoster = {
  members: TeamMember[];
  roles: TeamRoleOption[];
  seats: { used: number; limit: number };
  can: { invite: boolean; assign: boolean };
  me: string;
};

export type TeamRole = {
  id: string;
  key: string | null;
  name: string;
  description: string;
  color: string;
  isSystem: boolean;
  isOwner: boolean;
  granted: number;
  memberCount: number;
};

export type TeamRoleList = { roles: TeamRole[]; total: number; canManage: boolean };

export type TeamRoleDetail = {
  role: TeamRole;
  groups: { group: string; permissions: { key: string; label: string; granted: boolean }[] }[];
  canManage: boolean;
};

export type TeamAddon = {
  id: string;
  name: string;
  description: string;
  category: string;
  version: string;
  features: string[];
  enabled: boolean;
};

export type TeamNotifications = {
  enabled: boolean;
  groups: {
    key: string;
    label: string;
    description: string;
    items: { key: string; label: string; description: string; audience: string; live: boolean; on: boolean }[];
  }[];
  canManage: boolean;
};

export type TeamApiKey = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string | null;
  status: "active" | "revoked" | "expired";
};

export type TeamWebhook = {
  id: string;
  url: string;
  description: string;
  eventTypes: string[];
  active: boolean;
  failureStreak: number;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  disabledReason: string;
};

export type TeamApi = {
  keys: TeamApiKey[];
  webhooks: TeamWebhook[];
  scopes: { key: string; label: string; description: string }[];
  expiries: { value: string; label: string }[];
  baseUrl: string;
  canManage: boolean;
};

export type TeamAiApp = { id: string; name: string; redirectUri: string; createdAt: string | null };

export type TeamAiApps = { serverUrl: string; apps: TeamAiApp[] };

export type TeamDomains = {
  organization: { id: string; name: string } | null;
  subdomainAddon: boolean;
  customDomainAddon: boolean;
  subdomain: { name: string; address: string; status: string; verified: boolean } | null;
  rootDomain: string;
  cnameTarget: string;
};

export type OrganiserProfile = {
  displayName: string;
  tagline: string;
  bio: string;
  avatarUrl: string;
  bannerUrl: string;
  website: string;
  location: string;
  contactEmail: string;
  links: { label: string; url: string }[];
};

export type EventWallSettings = {
  id: string | null;
  name: string;
  tagline: string;
  logoUrl: string;
  slug: string;
  cta: { label: string; url: string; style: "solid" | "outline" };
};
