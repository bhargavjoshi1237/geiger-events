"use client";

import { Users, ShieldCheck, Webhook, Globe } from "lucide-react";

import {
  nameCol,
  statusCol,
  textCol,
  count,
  sum,
  statusFilter,
  configFilter,
  nameField,
  statusField,
  c,
  optionsFrom,
} from "@/components/internal/shared/records/builders";

// Settings modules (backed by events.settings_records). Advisory UI-level config
// records — team, roles, integrations, domains. (These gate/label the UI; real
// enforcement is server-side.) Usage stays a read-only dashboard, not here.

const MEMBER_STATUS_MAP = {
  Active: { label: "Active", variant: "success", dotClass: "bg-emerald-400" },
  Invited: { label: "Invited", variant: "info", dotClass: "bg-sky-400" },
  Suspended: { label: "Suspended", variant: "danger", dotClass: "bg-red-400" },
};
const ROLE_STATUS_MAP = {
  Active: { label: "Active", variant: "success", dotClass: "bg-emerald-400" },
  Archived: { label: "Archived", variant: "outline", dotClass: "bg-[#525252]" },
};
const KEY_STATUS_MAP = {
  Active: { label: "Active", variant: "success", dotClass: "bg-emerald-400" },
  Revoked: { label: "Revoked", variant: "neutral", dotClass: "bg-[#737373]" },
  Expired: { label: "Expired", variant: "warning", dotClass: "bg-amber-400" },
};
const DOMAIN_STATUS_MAP = {
  Verified: { label: "Verified", variant: "success", dotClass: "bg-emerald-400" },
  Pending: { label: "Pending", variant: "warning", dotClass: "bg-amber-400" },
  Failed: { label: "Failed", variant: "danger", dotClass: "bg-red-400" },
};

const ROLES = ["Owner", "Admin", "Member", "Viewer"];
const KEY_TYPES = ["API key", "Webhook"];
const DOMAIN_TYPES = ["Primary", "Redirect"];

export const MODULES = {
  member: {
    key: "member",
    title: "Team & Members",
    singular: "Member",
    icon: Users,
    description: "Everyone with access to this workspace — their role and account status.",
    createLabel: "Invite member",
    searchPlaceholder: "Search members, emails…",
    search: (r) => `${r.name} ${r.config.email || ""} ${r.config.role || ""}`,
    statusMap: MEMBER_STATUS_MAP,
    filters: [
      statusFilter(MEMBER_STATUS_MAP),
      configFilter("role", ROLES, "All roles"),
    ],
    columns: [
      nameCol((r) => r.config.email),
      textCol("role", "Role", (r) => r.config.role),
      statusCol(MEMBER_STATUS_MAP),
    ],
    stats: (records) => [
      { label: "Members", value: String(records.length), footer: "In workspace" },
      { label: "Active", value: String(count(records, (r) => r.status === "Active")), footer: "With access" },
      { label: "Invited", value: String(count(records, (r) => r.status === "Invited")), footer: "Pending" },
      { label: "Admins", value: String(count(records, (r) => ["Owner", "Admin"].includes(r.config.role))), footer: "Owners & admins" },
    ],
    defaults: { status: "Invited", config: { email: "", role: "Member", title: "" } },
    createFields: [
      nameField("Full name", "e.g. Sam Rivera"),
      c("email", "Email", "email", { placeholder: "name@example.com" }),
      c("role", "Role", "select", { options: optionsFrom(ROLES) }),
    ],
    detail: {
      depth: "light",
      panels: [
        {
          title: "Member",
          fields: [
            nameField("Full name"),
            statusField(MEMBER_STATUS_MAP),
            c("email", "Email", "email", { placeholder: "name@example.com" }),
            c("role", "Role", "select", { options: optionsFrom(ROLES) }),
            c("title", "Job title", "text", { placeholder: "e.g. Event Lead" }),
          ],
        },
      ],
    },
  },

  role: {
    key: "role",
    title: "Roles & Permissions",
    singular: "Role",
    icon: ShieldCheck,
    description: "Custom roles and the permissions they grant. Assign them to team members.",
    createLabel: "Add role",
    searchPlaceholder: "Search roles…",
    search: (r) => `${r.name} ${r.config.description || ""}`,
    statusMap: ROLE_STATUS_MAP,
    filters: [statusFilter(ROLE_STATUS_MAP)],
    columns: [
      nameCol((r) => r.config.description),
      textCol("permissions", "Permissions", (r) => (r.config.permissions || []).length || ""),
      statusCol(ROLE_STATUS_MAP),
    ],
    stats: (records) => [
      { label: "Roles", value: String(records.length), footer: "Defined" },
      { label: "Active", value: String(count(records, (r) => r.status === "Active")), footer: "Assignable" },
      { label: "Permissions", value: String(sum(records, (r) => (r.config.permissions || []).length)), footer: "Granted total" },
      { label: "Archived", value: String(count(records, (r) => r.status === "Archived")), footer: "Retired" },
    ],
    defaults: { status: "Active", config: { description: "", permissions: [] } },
    createFields: [
      nameField("Role name", "e.g. Event Manager"),
      c("description", "Description", "text", { placeholder: "What this role can do" }),
    ],
    detail: {
      depth: "light",
      panels: [
        {
          title: "Role",
          fields: [
            nameField("Role name"),
            statusField(ROLE_STATUS_MAP),
            c("description", "Description", "text", { placeholder: "What this role can do" }),
          ],
        },
        { title: "Permissions", fields: [c("permissions", "Permissions", "list", { placeholder: "e.g. events.edit" })] },
      ],
    },
  },

  apikey: {
    key: "apikey",
    title: "API & Webhooks",
    singular: "Key",
    icon: Webhook,
    description: "API keys and webhook endpoints for integrating this workspace with other tools.",
    createLabel: "Add key",
    searchPlaceholder: "Search keys, endpoints…",
    search: (r) => `${r.name} ${r.config.endpoint || ""} ${r.config.type || ""}`,
    statusMap: KEY_STATUS_MAP,
    filters: [
      statusFilter(KEY_STATUS_MAP),
      configFilter("type", KEY_TYPES, "All types"),
    ],
    columns: [
      nameCol((r) => r.config.type),
      textCol("endpoint", "Endpoint", (r) => r.config.endpoint),
      statusCol(KEY_STATUS_MAP),
    ],
    stats: (records) => [
      { label: "Keys", value: String(records.length), footer: "API & webhooks" },
      { label: "Active", value: String(count(records, (r) => r.status === "Active")), footer: "In use" },
      { label: "Webhooks", value: String(count(records, (r) => r.config.type === "Webhook")), footer: "Endpoints" },
      { label: "Revoked", value: String(count(records, (r) => r.status === "Revoked")), footer: "Disabled" },
    ],
    defaults: { status: "Active", config: { type: "API key", endpoint: "", token: "", events: [] } },
    createFields: [
      nameField("Name", "e.g. Zapier integration"),
      c("type", "Type", "select", { options: optionsFrom(KEY_TYPES) }),
    ],
    detail: {
      depth: "light",
      panels: [
        {
          title: "Details",
          fields: [
            nameField("Name"),
            statusField(KEY_STATUS_MAP),
            c("type", "Type", "select", { options: optionsFrom(KEY_TYPES) }),
            c("endpoint", "Endpoint URL", "text", { placeholder: "https://…" }),
            c("token", "Token / secret", "text", { placeholder: "sk_live_…" }),
          ],
        },
        { title: "Events", fields: [c("events", "Subscribed events", "list", { placeholder: "e.g. order.created" })] },
      ],
    },
  },

  domain: {
    key: "domain",
    title: "Custom Domains",
    singular: "Domain",
    icon: Globe,
    description: "Custom domains that point at your public event pages, with verification status.",
    createLabel: "Add domain",
    searchPlaceholder: "Search domains…",
    search: (r) => `${r.name} ${r.config.target || ""}`,
    statusMap: DOMAIN_STATUS_MAP,
    filters: [
      statusFilter(DOMAIN_STATUS_MAP),
      configFilter("type", DOMAIN_TYPES, "All types"),
    ],
    columns: [
      nameCol((r) => r.config.target),
      textCol("type", "Type", (r) => r.config.type),
      statusCol(DOMAIN_STATUS_MAP),
    ],
    stats: (records) => [
      { label: "Domains", value: String(records.length), footer: "Connected" },
      { label: "Verified", value: String(count(records, (r) => r.status === "Verified")), footer: "Live" },
      { label: "Pending", value: String(count(records, (r) => r.status === "Pending")), footer: "Awaiting DNS" },
      { label: "Primary", value: String(count(records, (r) => r.config.type === "Primary")), footer: "Main domains" },
    ],
    defaults: { status: "Pending", config: { type: "Primary", target: "", ssl: false } },
    createFields: [
      nameField("Domain", "e.g. events.example.com"),
      c("type", "Type", "select", { options: optionsFrom(DOMAIN_TYPES) }),
    ],
    detail: {
      depth: "light",
      panels: [
        {
          title: "Domain",
          fields: [
            nameField("Domain"),
            statusField(DOMAIN_STATUS_MAP),
            c("type", "Type", "select", { options: optionsFrom(DOMAIN_TYPES) }),
            c("target", "Points to", "text", { placeholder: "e.g. cname.geiger.app" }),
            c("ssl", "SSL enabled", "switch"),
          ],
        },
      ],
    },
  },
};
