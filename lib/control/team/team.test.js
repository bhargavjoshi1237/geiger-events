import test from "node:test";
import assert from "node:assert/strict";

import {
  activeGrantsByUser,
  isLastOwner,
  memberView,
  ownerRoleIds,
  parseInviteEmails,
  roleIdOf,
  roleView,
  togglePermission,
} from "./members.js";
import { notificationsView, parseNotificationsPatch } from "./notifications.js";
import { parseProfilePatch, parseWallPatch, profileView, slugify, wallView } from "./profiles.js";

const KEYS = ["events.events.view", "events.orders.view", "events.event.edit"];
const owner = { id: "r-owner", key: "owner", name: "Owner", permissions: ["*"] };
const manager = { id: "r-mgr", key: "manager", name: "Manager", permissions: ["events.events.view", "events.orders.*"] };

test("a member's active grant decides their role; an invite falls back to the roster", () => {
  const grants = activeGrantsByUser([
    { user_id: "u1", role_id: "r-mgr", status: "active", deleted_at: null },
    { user_id: "u2", role_id: "r-owner", status: "revoked", deleted_at: null },
  ]);
  assert.equal(roleIdOf({ user_id: "u1", role_id: "r-owner" }, grants), "r-mgr");
  assert.equal(roleIdOf({ user_id: null, role_id: "r-owner" }, grants), "r-owner");
  assert.equal(roleIdOf({ user_id: "u2", role_id: null }, grants), null);
});

test("the last owner can't be demoted or removed; a second owner frees it", () => {
  const owners = ownerRoleIds([owner, manager]);
  const one = activeGrantsByUser([{ user_id: "u1", role_id: "r-owner", status: "active" }]);
  assert.equal(isLastOwner({ user_id: "u1" }, { grantByUser: one, owners }), true);
  const two = activeGrantsByUser([
    { user_id: "u1", role_id: "r-owner", status: "active" },
    { user_id: "u2", role_id: "r-owner", status: "active" },
  ]);
  assert.equal(isLastOwner({ user_id: "u1" }, { grantByUser: two, owners }), false);
  assert.equal(isLastOwner({ user_id: "u3" }, { grantByUser: one, owners }), false);
});

test("invites are cleaned, de-duplicated, checked against the roster and the seats", () => {
  assert.deepEqual(parseInviteEmails(" A@x.io, b@x.io; a@x.io ", { seatsUsed: 1 }), ["a@x.io", "b@x.io"]);
  assert.deepEqual(parseInviteEmails(["c@x.io", "a@x.io"], { seatsUsed: 1, existing: ["A@x.io"] }), ["c@x.io"]);
  assert.throws(() => parseInviteEmails("", { seatsUsed: 0 }), (e) => e.status === 400);
  assert.throws(() => parseInviteEmails("nope", { seatsUsed: 0 }), (e) => e.status === 400);
  assert.throws(() => parseInviteEmails("a@x.io", { seatsUsed: 25 }), (e) => /seats/.test(e.message));
  assert.throws(() => parseInviteEmails("a@x.io", { seatsUsed: 1, existing: ["a@x.io"] }), (e) => /already/.test(e.message));
});

test("views name the role and count what a pattern actually grants", () => {
  const roles = new Map([[manager.id, manager]]);
  assert.equal(memberView({ id: "m1", email: "a@x.io", status: "active" }, "r-mgr", roles).roleName, "Manager");
  assert.equal(roleView(owner, KEYS).granted, 3);
  assert.equal(roleView(owner, KEYS).isOwner, true);
  assert.equal(roleView(manager, KEYS).granted, 2);
});

test("toggling a permission expands patterns first and never touches Owner", () => {
  assert.deepEqual(togglePermission(manager, "events.orders.view", false, KEYS), ["events.events.view"]);
  assert.deepEqual(togglePermission(manager, "events.event.edit", true, KEYS).sort(), [...KEYS].sort());
  assert.throws(() => togglePermission(owner, "events.events.view", false, KEYS), (e) => e.status === 403);
  assert.throws(() => togglePermission(manager, "events.nope", true, KEYS), (e) => e.status === 400);
});

test("notifications read over the defaults and accept only known emails", () => {
  const view = notificationsView({ enabled: false, types: { registration_confirmed: false } });
  assert.equal(view.enabled, false);
  const item = view.groups.flatMap((g) => g.items).find((i) => i.key === "registration_confirmed");
  assert.equal(item.on, false);
  const next = parseNotificationsPatch({ types: { registration_confirmed: true } }, { enabled: false, types: { registration_confirmed: false }, extra: 1 });
  assert.equal(next.enabled, false);
  assert.equal(next.types.registration_confirmed, true);
  assert.equal(next.extra, 1);
  assert.throws(() => parseNotificationsPatch({ types: { made_up: true } }, {}), (e) => e.status === 400);
  assert.throws(() => parseNotificationsPatch({ enabled: "yes" }, {}), (e) => e.status === 400);
  assert.throws(() => parseNotificationsPatch({}, {}), (e) => e.status === 400);
});

test("profile and wall patches validate like the dashboard and drop empty links", () => {
  assert.deepEqual(parseProfilePatch({ displayName: " Acme ", links: [{ label: "X", url: "https://x.com" }, { label: "Blank", url: "" }] }), {
    display_name: "Acme",
    links: [{ label: "X", url: "https://x.com" }],
  });
  assert.throws(() => parseProfilePatch({ website: "x.com" }), (e) => e.status === 400);
  assert.throws(() => parseProfilePatch({ contactEmail: "nope" }), (e) => e.status === 400);
  assert.equal(profileView({ display_name: "A", links: null }).links.length, 0);

  assert.equal(slugify("  Summer Events! "), "summer-events");
  const { row, cta } = parseWallPatch({ slug: "My Wall", cta: { label: "Sponsor", url: "mailto:a@x.io", style: "bold" } });
  assert.deepEqual(row, { slug: "my-wall" });
  assert.deepEqual(cta, { label: "Sponsor", url: "mailto:a@x.io", style: "solid" });
  assert.throws(() => parseWallPatch({ slug: "!!!" }), (e) => e.status === 400);
  assert.throws(() => parseWallPatch({ name: "" }), (e) => e.status === 400);
  assert.equal(wallView({ metadata: { cta: { style: "outline" } } }).cta.style, "outline");
});
