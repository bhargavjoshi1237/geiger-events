import { createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { WorkspaceError } from "../errors.js";
import { codeEmail, inviteEmail } from "./emails.js";
import { portalStore } from "./store.js";

const SESSION_DAYS = 30;
const CODE_MINUTES = 10;
const INVITE_DAYS = 7;
const CODES_PER_EMAIL_HOUR = 5;
const CODES_PER_EVENT_HOUR = 500;
const MAX_ATTEMPTS = 5;
const EMAIL = /^[^\s@<>"]{1,200}@[^\s@<>"]{1,100}\.[^\s@<>"]{2,40}$/;

export const sha256 = (value) => createHash("sha256").update(String(value)).digest("hex");
const wrongCode = () => new WorkspaceError("invalid_code", 400, "That code isn't right or has expired. Ask for a new one.");

export function cleanEmail(value) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!EMAIL.test(email) || email.length > 320) throw new WorkspaceError("invalid_email", 422, "Enter a valid email address.");
  return email;
}

const defaultSend = async (args) => (await import("../../email/notifications.js")).sendNotificationEmail(args);

// Sign-in for outside people: emailed one-time codes, single-use invite links and the shared portal session.
export function createPortalAuth({ store = portalStore, send = defaultSend, now = () => Date.now() } = {}) {
  async function startSession(memberId) {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(now() + SESSION_DAYS * 864e5).toISOString();
    await store.createSession(memberId, sha256(token), expiresAt);
    return { token, expiresAt, maxAge: SESSION_DAYS * 86400 };
  }

  async function memberFor(email) {
    return (await store.memberByEmail(email)) ?? store.createMember(email);
  }

  return {
    startSession,

    // Always answers the same way, so the response never reveals whether an email is known.
    async requestCode({ context, event, brand }, rawEmail) {
      const email = cleanEmail(rawEmail);
      const hour = new Date(now() - 3600_000).toISOString();
      if (await store.countCodes(context, { email, since: hour }) >= CODES_PER_EMAIL_HOUR) return { sent: true };
      if (await store.countCodes(context, { since: hour }) >= CODES_PER_EVENT_HOUR) return { sent: true };
      const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
      const id = randomUUID();
      await store.addToken({
        id, project_id: context.projectId, event_id: context.eventId, email, purpose: "code",
        token_hash: sha256(`${id}:${code}`), expires_at: new Date(now() + CODE_MINUTES * 60_000).toISOString(),
      });
      const mail = codeEmail({ event: event.name, brand, code });
      // Sign-in codes ignore the notification switches: without them nobody could get into the portal.
      await send({ projectId: context.projectId, template: "events.workspace_portal_code", to: email, subject: mail.subject, html: mail.html });
      return { sent: true };
    },

    async verifyCode({ context }, rawEmail, rawCode) {
      const email = cleanEmail(rawEmail);
      const code = typeof rawCode === "string" ? rawCode.replace(/\s+/g, "") : "";
      if (!/^\d{6}$/.test(code)) throw wrongCode();
      const token = await store.latestCode(context, email);
      if (!token || token.attempts >= MAX_ATTEMPTS) throw wrongCode();
      await store.updateToken(token.id, { attempts: token.attempts + 1 });
      const expected = Buffer.from(token.token_hash, "hex");
      const actual = Buffer.from(sha256(`${token.id}:${code}`), "hex");
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw wrongCode();
      if (!(await store.claimToken(token.id))) throw wrongCode();
      const member = await memberFor(email);
      await store.updateToken(token.id, { member_id: member.id });
      return { member, session: await startSession(member.id) };
    },

    // One email per person with a personal link; earlier unused invites for the same email are replaced.
    async invite({ context, event, brand, welcome, staffId, linkFor }, people) {
      const existing = await store.invites(context);
      let sent = 0;
      const failed = [];
      for (const person of people) {
        let email;
        try { email = cleanEmail(person.email); } catch { failed.push({ name: person.name, reason: "No valid email" }); continue; }
        for (const old of existing.filter((row) => row.email === email && !row.used_at && !row.revoked_at)) {
          await store.updateToken(old.id, { revoked_at: new Date(now()).toISOString() });
        }
        const token = randomBytes(32).toString("base64url");
        await store.addToken({
          project_id: context.projectId, event_id: context.eventId, email, purpose: "invite", token_hash: sha256(token),
          expires_at: new Date(now() + INVITE_DAYS * 864e5).toISOString(), created_by: staffId,
        });
        const mail = inviteEmail({ event: event.name, brand, name: person.name, url: linkFor(token), welcome });
        const result = await send({ projectId: context.projectId, notification: "workspace_portal_invite", template: "events.workspace_portal_invite", to: email, subject: mail.subject, html: mail.html });
        if (result?.ok === false && !result.skipped) failed.push({ name: person.name, email, reason: "Couldn't send the email" });
        else sent++;
      }
      return { sent, failed };
    },

    async acceptInvite(rawToken) {
      if (typeof rawToken !== "string" || !/^[A-Za-z0-9_-]{20,100}$/.test(rawToken)) return null;
      const token = await store.tokenByHash(sha256(rawToken));
      if (!token || token.purpose !== "invite" || token.used_at || token.revoked_at || Date.parse(token.expires_at) < now()) return null;
      if (!(await store.claimToken(token.id))) return null;
      const member = await memberFor(token.email);
      await store.updateToken(token.id, { member_id: member.id });
      return { eventId: token.event_id, member, session: await startSession(member.id) };
    },

    async revokeInvite(context, id) {
      const rows = await store.invites(context);
      if (!rows.some((row) => row.id === id)) throw new WorkspaceError("not_found", 404, "That invite no longer exists.");
      await store.updateToken(id, { revoked_at: new Date(now()).toISOString() });
      return { revoked: true };
    },

    async signOut(rawToken) {
      if (rawToken) await store.deleteSession(sha256(rawToken));
    },
  };
}

export const portalAuth = createPortalAuth();
