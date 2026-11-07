// RFP emails rendered here and delivered pre-rendered through the suite email API.
// kind: "invitation" | "reminder" | "award" | "regret".

import { formatDateRange, formatDeadline, formatMoney } from "./rfp_model.js";

export const RFP_EMAILS = {
  invitation: { notification: "venue_rfp", template: "events.venue_rfp" },
  reminder: { notification: "venue_rfp_reminder", template: "events.venue_rfp_reminder" },
  award: { notification: "venue_rfp_award", template: "events.venue_rfp_award" },
  regret: { notification: "venue_rfp_regret", template: "events.venue_rfp_regret" },
};

const esc = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const p = (html) => `<p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#374151">${html}</p>`;

function row(label, value) {
  if (!value) return "";
  return `<tr><td style="padding:6px 0;color:#6b7280;font-size:13px;width:150px;vertical-align:top">${esc(label)}</td><td style="padding:6px 0;color:#111827;font-size:13px">${esc(value)}</td></tr>`;
}

function shell({ heading, body, cta, footer }) {
  const button = cta?.url
    ? `<div style="margin:6px 0 14px"><a href="${esc(cta.url)}" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#111827;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none">${esc(cta.label)}</a></div>`
    : "";
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px">
<tr><td style="padding:28px 28px 8px">
<p style="margin:0 0 18px;font-size:13px;font-weight:600;color:#6b7280">Geiger Events · Request for proposal</p>
<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#111827">${esc(heading)}</h1>
${body}${button}
</td></tr>
<tr><td style="padding:14px 28px 24px;border-top:1px solid #f0f0f0;font-size:12px;line-height:1.5;color:#9ca3af">${esc(footer)}</td></tr>
</table></td></tr></table></body></html>`;
}

// Everything an email needs about the RFP, from normalized rows.
export function rfpEmailContext({ rfp, recipient, organizerName, eventName, url, total }) {
  const organizer = rfp?.contactName ? `${rfp.contactName}${organizerName ? ` (${organizerName})` : ""}` : organizerName || "The organiser";
  return {
    recipientName: recipient?.contactName || recipient?.name || "there",
    venueName: recipient?.name || "",
    organizer,
    organizerShort: organizerName || rfp?.contactName || "The organiser",
    title: rfp?.title || "Request for proposal",
    eventName: eventName || "",
    dates: rfp?.startDate ? `${formatDateRange(rfp.startDate, rfp.endDate)}${rfp.datesFlexible ? " (flexible)" : ""}` : rfp?.datesFlexible ? "Flexible" : "",
    attendees: Number(rfp?.attendees) > 0 ? `${Number(rfp.attendees).toLocaleString("en-US")} people` : "",
    location: rfp?.location || "",
    deadline: formatDeadline(rfp?.responseDeadline, "UTC"),
    contactEmail: rfp?.contactEmail || "",
    total: total != null ? formatMoney(total, rfp?.currency || "USD") : "",
    url: url || "",
  };
}

export function renderRfpEmail(kind, ctx) {
  const facts = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #f0f0f0;border-bottom:1px solid #f0f0f0;margin:4px 0 18px">
${row("Event", ctx.eventName)}${row("Dates", ctx.dates)}${row("Attendees", ctx.attendees)}${row("Location", ctx.location)}${row("Respond by", ctx.deadline)}
</table>`;
  const replyTo = ctx.contactEmail ? ` Questions? Reply to ${esc(ctx.contactEmail)}.` : "";
  const hi = p(`Hi ${esc(ctx.recipientName)},`);

  if (kind === "reminder") {
    return {
      subject: `Reminder: proposal due for ${ctx.title}`,
      html: shell({
        heading: "Your proposal is still open",
        body: `${hi}${p(`${esc(ctx.organizer)} is still waiting on a proposal from ${esc(ctx.venueName || "you")} for <strong>${esc(ctx.title)}</strong>.${ctx.deadline ? ` Responses close ${esc(ctx.deadline)}.` : ""}`)}${facts}${p(`Use the link below to price the brief or let them know you'll pass.${replyTo}`)}`,
        cta: { url: ctx.url, label: "Open the RFP" },
        footer: "This link is unique to your venue and replaces any earlier link — don't forward it.",
      }),
    };
  }
  if (kind === "award") {
    return {
      subject: `Your proposal was selected: ${ctx.title}`,
      html: shell({
        heading: "Your proposal was selected",
        body: `${hi}${p(`Good news — ${esc(ctx.organizer)} has selected ${esc(ctx.venueName || "your venue")} for <strong>${esc(ctx.title)}</strong>${ctx.total ? ` at ${esc(ctx.total)}` : ""}.`)}${facts}${p(`They'll be in touch to confirm the contract and next steps.${replyTo}`)}`,
        footer: "Sent by Geiger Events on behalf of the event organiser.",
      }),
    };
  }
  if (kind === "regret") {
    return {
      subject: `Update on ${ctx.title}`,
      html: shell({
        heading: "Thank you for your proposal",
        body: `${hi}${p(`Thank you for responding to <strong>${esc(ctx.title)}</strong>. ${esc(ctx.organizerShort)} has chosen another venue this time.`)}${p(`They appreciated the time you put into your proposal and hope to work with ${esc(ctx.venueName || "you")} on a future event.${replyTo}`)}`,
        footer: "Sent by Geiger Events on behalf of the event organiser.",
      }),
    };
  }
  return {
    subject: `Request for proposal: ${ctx.title}`,
    html: shell({
      heading: `You're invited to bid on ${ctx.title}`,
      body: `${hi}${p(`${esc(ctx.organizer)} would like a proposal from ${esc(ctx.venueName || "your venue")}.`)}${facts}${p(`Open the brief to see the meeting space, room block, F&B and AV requirements, then price it line by line. No account is needed, and you can revise your proposal until the deadline.${replyTo}`)}`,
      cta: { url: ctx.url, label: "View the brief and respond" },
      footer: "This link is unique to your venue — don't forward it.",
    }),
  };
}
