import {
  UserPlus,
  ShieldCheck,
  Activity,
  UserMinus,
  UsersRound,
  Ban,
  Sparkles,
} from "lucide-react";

import { WORKSPACE_PERMISSIONS } from "@/lib/rbac";

// Lookups & formatters for the Settings area (Team & Members, Roles &
// Permissions). Config only — no row data. Status/type maps feed StatusPill;
// filter options seed the toolbar; formatters are imported, never re-inlined.

// --- Member status ---------------------------------------------------------

export const MEMBER_STATUS_MAP = {
  active: { label: "Active", variant: "success", dotClass: "bg-emerald-400" },
  invited: { label: "Invited", variant: "info", dotClass: "bg-sky-400" },
  suspended: { label: "Suspended", variant: "danger", dotClass: "bg-red-400" },
};

export const MEMBER_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "invited", label: "Invited" },
  { value: "suspended", label: "Suspended" },
];

// --- Role colors -----------------------------------------------------------

// A small palette of semantic accents for roles and groups. `dot` colors the
// list/pill marker; `chip` styles a filled badge at /10 bg + /20 border.
export const ROLE_COLORS = {
  violet: { dot: "bg-violet-400", chip: "border-violet-500/20 bg-violet-500/10 text-violet-300" },
  blue: { dot: "bg-blue-400", chip: "border-blue-500/20 bg-blue-500/10 text-blue-300" },
  sky: { dot: "bg-sky-400", chip: "border-sky-500/20 bg-sky-500/10 text-sky-300" },
  emerald: { dot: "bg-emerald-400", chip: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" },
  amber: { dot: "bg-amber-400", chip: "border-amber-500/20 bg-amber-500/10 text-amber-300" },
  rose: { dot: "bg-rose-400", chip: "border-rose-500/20 bg-rose-500/10 text-rose-300" },
  cyan: { dot: "bg-cyan-400", chip: "border-cyan-500/20 bg-cyan-500/10 text-cyan-300" },
  slate: { dot: "bg-slate-400", chip: "border-slate-500/20 bg-slate-500/10 text-slate-300" },
};

export const ROLE_COLOR_OPTIONS = Object.keys(ROLE_COLORS);

export function roleColor(key) {
  return ROLE_COLORS[key] || ROLE_COLORS.slate;
}

// --- Activity feed ---------------------------------------------------------

export const ACTIVITY_ACTION_MAP = {
  invited: { label: "invited", icon: UserPlus, tone: "text-sky-400" },
  role_changed: { label: "changed the role of", icon: ShieldCheck, tone: "text-violet-300" },
  status_changed: { label: "updated the status of", icon: Activity, tone: "text-amber-400" },
  suspended: { label: "suspended", icon: Ban, tone: "text-red-400" },
  removed: { label: "removed", icon: UserMinus, tone: "text-red-400" },
  group_changed: { label: "updated groups for", icon: UsersRound, tone: "text-emerald-400" },
  role_created: { label: "created role", icon: Sparkles, tone: "text-violet-300" },
  role_updated: { label: "updated role", icon: ShieldCheck, tone: "text-violet-300" },
  role_deleted: { label: "deleted role", icon: UserMinus, tone: "text-red-400" },
  group_created: { label: "created group", icon: UsersRound, tone: "text-emerald-400" },
};

// --- Permissions -----------------------------------------------------------

// WORKSPACE_PERMISSIONS grouped by `group`, preserving first-seen order. Powers
// the permission matrix (one SettingRow per key, one section per group).
export const PERMISSION_GROUPS = (() => {
  const order = [];
  const byGroup = new Map();
  for (const perm of WORKSPACE_PERMISSIONS) {
    if (!byGroup.has(perm.group)) {
      byGroup.set(perm.group, []);
      order.push(perm.group);
    }
    byGroup.get(perm.group).push(perm);
  }
  return order.map((group) => ({ group, permissions: byGroup.get(group) }));
})();

// --- Seats -----------------------------------------------------------------

// Default seat allowance until Billing wires a real plan limit (read from
// project metadata `seatLimit` when present).
export const DEFAULT_SEAT_LIMIT = 25;

// --- Formatters ------------------------------------------------------------

export function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatRelativeTime(value) {
  if (!value) return "Never";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Never";
  const diff = Date.now() - d.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(value);
}

export function initialsOf(name, email) {
  const src = (name || email || "?").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}
