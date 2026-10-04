import { randomUUID, timingSafeEqual } from "node:crypto";
import { OperationsError } from "../errors.js";

const invalid = (message) => new OperationsError("invalid_input", 422, message);
const templates = Object.freeze({
  placement: "events.operations_placement",
  "placement-published": "events.operations_placement",
  "evaluation-reminder": "events.operations_evaluation_reminder",
  "evaluation-due": "events.operations_evaluation_reminder",
});

export function authorizeWorker(authorization, secret = process.env.OPERATIONS_WORKER_SECRET) {
  if (typeof secret !== "string" || !secret.length || typeof authorization !== "string") return false;
  const actual = Buffer.from(authorization);
  const expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function buildOperationsEmail(notice, { origin = process.env.GEIGER_OPERATIONS_PUBLIC_URL } = {}) {
  if (!Object.hasOwn(templates, notice.kind)) throw invalid("Unsupported notice kind.");
  let base;
  try { base = new URL(origin); } catch { throw invalid("Configure GEIGER_OPERATIONS_PUBLIC_URL before sending notices."); }
  if (!["https:", "http:"].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
    throw invalid("Invalid operations public URL.");
  }
  if (typeof notice.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notice.email)) {
    throw invalid("Recipient does not have a valid operational email address.");
  }
  const operationsUrl = `${base.href.replace(/\/$/, "")}/operations/${encodeURIComponent(notice.eventId)}`;
  return {
    template: templates[notice.kind], to: notice.email,
    subject: notice.kind.startsWith("placement") ? "Your event placement has been published" : "Your event evaluation is due",
    data: { ...(notice.payload ?? {}), noticeId: notice.id, operationsUrl },
    idempotencyKey: `geiger-operations-${notice.id}`,
  };
}

async function defaultSender(notice) {
  let email;
  try { email = buildOperationsEmail(notice); }
  catch (error) { return { ok: false, error: error.message }; }
  const { sendSuiteEmail } = await import("../../email/client.js");
  return sendSuiteEmail({ ...email, signal: AbortSignal.timeout(15_000) });
}

export async function processOperationsNotices({ store, send = defaultSender, limit = 25, leaseId = randomUUID() } = {}) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw invalid("Worker batch must be between 1 and 100.");
  const source = store ?? (await import("../server/workflow_store.js")).workflowStore;
  const result = { processed: 0, accepted: 0, failed: 0, uncertain: 0 };
  while (result.processed < limit) {
    // Claim immediately before sending. A batch of 25 sequential 15-second sends
    // would otherwise outlive the five-minute database lease of later notices.
    const currentLease = result.processed === 0 ? leaseId : randomUUID();
    const notices = await source.claimNotices(1, currentLease);
    if (!Array.isArray(notices) || notices.length > 1) throw new Error("Invalid outbox claim result.");
    if (!notices.length) break;
    const notice = notices[0];
    let status;
    let providerId = null;
    let error = null;
    try {
      const response = await send(notice);
      if (response?.ok) { status = "accepted"; providerId = response.providerId ?? response.id ?? null; }
      else {
        status = response?.uncertain || response?.error === "request_failed" ? "uncertain" : "failed";
        error = String(response?.error ?? "Provider rejected the notice.").slice(0, 500);
      }
    } catch {
      status = "uncertain";
      error = "The provider outcome is unknown. Reconcile before retrying.";
    }
    // If persisting the outcome fails, leave the lease for reconciliation; never resend here.
    await source.finishNotice(notice.id, currentLease, status, providerId, error);
    result.processed += 1;
    result[status] += 1;
  }
  return result;
}
