import { emailLayout } from "../portal/emails.js";
import { escapeHtml } from "./template.js";

// The public address of this app when there's no request to read it from (background runs).
export function backgroundBaseUrl() {
  for (const value of [process.env.GEIGER_EVENTS_PUBLIC_URL, process.env.GEIGER_OPERATIONS_PUBLIC_URL]) {
    try {
      if (value) {
        const url = new URL(value);
        if (["http:", "https:"].includes(url.protocol)) return url.href.replace(/\/$/, "");
      }
    } catch { /* fall through */ }
  }
  return process.env.NODE_ENV === "production" ? "https://geiger.studio/events" : "http://localhost:3000";
}

export const recordPortalUrl = (eventId, objectKey, number) => `${backgroundBaseUrl()}/e/${eventId}/workspace/r/${objectKey}/${number}`;
export const dashboardUrl = (projectId, eventId, section) =>
  `${backgroundBaseUrl()}/project/${projectId}/allevents?event=${eventId}${section ? `&section=${encodeURIComponent(section)}` : ""}`;

// An organiser-written email: the rendered body (already-escaped HTML) inside the event's branded frame.
export function automationEmail({ event, brand, subject, bodyHtml }) {
  return { subject, html: emailLayout({ event, brand, title: subject, body: `<div style="margin:0">${bodyHtml}</div>` }) };
}

export function approvalEmail({ event, brand, title, message, url }) {
  return {
    subject: `Approval needed: ${title}`,
    html: emailLayout({
      event, brand, title: "Your approval is needed",
      body: `<p style="margin:0 0 12px;font-weight:600">${escapeHtml(title)}</p>
${message ? `<p style="margin:0 0 12px;white-space:pre-line">${escapeHtml(message)}</p>` : ""}
<p style="margin:20px 0"><a href="${escapeHtml(url)}" style="display:inline-block;background:{{color}};color:#ffffff;text-decoration:none;padding:11px 18px;border-radius:8px;font-weight:600">Review and decide</a></p>`,
    }),
  };
}
