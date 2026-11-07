import { planContent } from "./plan.js";

// Collaboration helpers: share-link state and expiry, comment threads and pin placement, version snapshots. Pure.

export const SHARE_PERMISSIONS = [
  { value: "view", label: "Can view" },
  { value: "comment", label: "Can comment" },
];

export const SHARE_EXPIRY_OPTIONS = [
  { value: "never", label: "Never expires", days: null },
  { value: "1", label: "24 hours", days: 1 },
  { value: "7", label: "7 days", days: 7 },
  { value: "30", label: "30 days", days: 30 },
  { value: "90", label: "90 days", days: 90 },
];

export const COMMENT_MAX_CHARS = 2000;
export const GUEST_NAME_MAX_CHARS = 80;

const DAY_MS = 24 * 60 * 60 * 1000;
const time = (v) => {
  const t = v ? new Date(v).getTime() : NaN;
  return Number.isFinite(t) ? t : null;
};

// ISO expiry for an option value ("never" | days), counted from `now`.
export function expiryFromOption(value, now = Date.now()) {
  const option = SHARE_EXPIRY_OPTIONS.find((o) => o.value === String(value));
  if (!option?.days) return null;
  return new Date(now + option.days * DAY_MS).toISOString();
}

// Pushes an expiry `days` further out — from the current expiry if it is still ahead, else from now.
export function extendExpiry(expiresAt, days, now = Date.now()) {
  const current = time(expiresAt);
  const from = current && current > now ? current : now;
  return new Date(from + days * DAY_MS).toISOString();
}

// "active" | "expired" | "revoked".
export function shareState(share, now = Date.now()) {
  if (!share) return "revoked";
  if (share.revokedAt) return "revoked";
  const expires = time(share.expiresAt);
  if (expires !== null && expires <= now) return "expired";
  return "active";
}

export const planShareUrl = (base, token) => `${String(base || "").replace(/\/$/, "")}/plan/${token}`;

// Top-level threads with their replies (oldest first); open threads first, then newest activity.
export function threadsOf(comments) {
  const list = (comments || []).filter((c) => c && !c.deletedAt);
  const byId = new Map(list.map((c) => [c.id, c]));
  const roots = new Map();
  for (const c of list) {
    if (!c.parentId || !byId.has(c.parentId)) roots.set(c.id, { ...c, replies: [] });
  }
  for (const c of list) {
    if (c.parentId && roots.has(c.parentId)) roots.get(c.parentId).replies.push(c);
  }
  const lastActivity = (t) => Math.max(time(t.createdAt) || 0, ...t.replies.map((r) => time(r.createdAt) || 0));
  return [...roots.values()]
    .map((t) => ({ ...t, replies: t.replies.sort((a, b) => (time(a.createdAt) || 0) - (time(b.createdAt) || 0)) }))
    .sort((a, b) => Number(Boolean(a.resolvedAt)) - Number(Boolean(b.resolvedAt)) || lastActivity(b) - lastActivity(a));
}

const hasPoint = (t) =>
  t?.xM !== null && t?.xM !== undefined && t?.yM !== null && t?.yM !== undefined &&
  Number.isFinite(Number(t.xM)) && Number.isFinite(Number(t.yM));

// Stable pin numbers: every pinned thread (open or resolved) numbered by creation order.
export function pinNumbers(threads, objectById) {
  const pinned = (threads || [])
    .filter((t) => hasPoint(t) || (t.itemId && objectById?.has?.(t.itemId)))
    .sort((a, b) => (time(a.createdAt) || 0) - (time(b.createdAt) || 0));
  return new Map(pinned.map((t, i) => [t.id, i + 1]));
}

// Where a thread's pin sits: on its object while that object exists (so it follows moves), else where it was dropped.
export function pinPoint(thread, objectById) {
  if (!thread || thread.parentId) return null;
  const item = thread.itemId ? objectById?.get?.(thread.itemId) : null;
  if (item) return [item.x_m, item.y_m];
  return hasPoint(thread) ? [Number(thread.xM), Number(thread.yM)] : null;
}

// "Table 7", the object's name, or "" — what a comment is attached to.
export function itemLabel(objectById, itemId) {
  const item = itemId ? objectById?.get?.(itemId) : null;
  if (!item) return "";
  if (item.label) return /^\d+$/.test(item.label) ? `Table ${item.label}` : item.label;
  return item.name || "";
}

// A version snapshot as a renderable / saveable plan.
export function snapshotToPlan(snapshot) {
  const s = snapshot && typeof snapshot === "object" ? snapshot : {};
  return { name: s.name || "", ...planContent(s) };
}

// "just now", "5 min ago", "3 h ago", "yesterday", "4 days ago", else a short date.
export function formatAgo(value, now = Date.now()) {
  const t = time(value);
  if (t === null) return "—";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d === 1) return "yesterday";
  if (d < 7) return `${d} days ago`;
  return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: d > 300 ? "numeric" : undefined });
}

// "12 Nov 2026" / "Never".
export function formatExpiry(value) {
  const t = time(value);
  if (t === null) return "Never";
  return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
