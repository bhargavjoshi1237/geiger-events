import { expandPatterns, matchesAny } from "@geiger/rbac";

import { ApiError } from "../../staff_access/errors.js";

// Team & roles for Control, mirroring the dashboard's use_team.js and roles_permissions.jsx rules.

export const DEFAULT_SEAT_LIMIT = 25;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function invalid(message) {
  return new ApiError("invalid_input", 400, message);
}

// Owner is whichever role holds the wildcard; the screens never edit it or leave it without a holder.
export function isOwnerRole(role) {
  return role?.key === "owner" || (role?.permissions || []).includes("*");
}

export function ownerRoleIds(roles) {
  return new Set(roles.filter(isOwnerRole).map((r) => r.id));
}

// A member's active grant decides their role; the roster's own role_id only covers an invite with no account yet.
export function activeGrantsByUser(grants) {
  const map = new Map();
  for (const g of grants) if (g.user_id && g.status === "active" && !g.deleted_at) map.set(g.user_id, g);
  return map;
}

export function roleIdOf(member, grantByUser) {
  return (member.user_id && grantByUser.get(member.user_id)?.role_id) || member.role_id || null;
}

export function isLastOwner(member, { grantByUser, owners }) {
  const roleId = roleIdOf(member, grantByUser);
  if (!owners.has(roleId)) return false;
  const holders = [...grantByUser.values()].filter((g) => owners.has(g.role_id)).length;
  return holders <= 1;
}

// "a@x.io, b@x.io" or an array → a clean, de-duplicated list, refused when it would overrun the seats.
export function parseInviteEmails(value, { seatsUsed, seatLimit = DEFAULT_SEAT_LIMIT, existing = [] }) {
  const raw = Array.isArray(value) ? value.join(" ") : String(value ?? "");
  const list = [...new Set(raw.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (!list.length) throw invalid("Enter at least one email.");
  const bad = list.find((e) => !EMAIL.test(e) || e.length > 254);
  if (bad) throw invalid(`${bad} isn't an email address.`);
  const taken = new Set(existing.map((e) => String(e || "").toLowerCase()));
  const fresh = list.filter((e) => !taken.has(e));
  if (!fresh.length) throw invalid(list.length === 1 ? "They're already on the team." : "They're all already on the team.");
  if (seatsUsed + fresh.length > seatLimit) throw invalid("Not enough seats for that many invites.");
  return fresh;
}

export function memberView(row, roleId, roleById) {
  const role = roleId ? roleById.get(roleId) : null;
  return {
    id: row.id,
    userId: row.user_id ?? null,
    name: row.name ?? "",
    email: row.email ?? "",
    status: row.status ?? "active",
    roleId: roleId ?? null,
    roleName: role?.name ?? null,
    invitedAt: row.invited_at ?? null,
    joinedAt: row.joined_at ?? null,
    lastActiveAt: row.last_active_at ?? null,
  };
}

// Roles store patterns, so "granted" is what they reach in the catalog, not a literal includes().
export function grantedKeys(role, allKeys) {
  return allKeys.filter((key) => matchesAny(role?.permissions || [], key));
}

export function roleView(role, allKeys, memberCount = 0) {
  return {
    id: role.id,
    key: role.key ?? null,
    name: role.name ?? "",
    description: role.description ?? "",
    color: role.color ?? "slate",
    isSystem: Boolean(role.is_system),
    isOwner: isOwnerRole(role),
    granted: grantedKeys(role, allKeys).length,
    memberCount,
  };
}

// Toggling one key inside a pattern first expands the role to the concrete keys it reaches, as the dashboard does.
export function togglePermission(role, key, on, allKeys) {
  if (isOwnerRole(role)) throw new ApiError("forbidden", 403, "The Owner role always has every permission.");
  if (!allKeys.includes(key)) throw invalid("That permission doesn't exist.");
  const patterns = role.permissions || [];
  const base = patterns.some((p) => p.includes("*")) ? expandPatterns(patterns, allKeys) : [...patterns];
  return on ? [...new Set([...base, key])] : base.filter((k) => k !== key);
}
