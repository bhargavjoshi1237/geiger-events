// Pre-rendered "reply in a discussion" email, sent through the suite email API's html mode (every value escaped).

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const safeHref = (url) => (/^https?:\/\//i.test(String(url || "")) ? esc(url) : "");

export function boardReplyEmailHtml({ recipientName, headline, boardName, excerpt, topicUrl }) {
  const href = safeHref(topicUrl);
  const button = href
    ? `<a href="${href}" style="display:inline-block;background:#171717;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;font-size:14px;font-weight:600">View the discussion</a>`
    : "";
  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#171717">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #e5e5e5;border-radius:12px">
<tr><td style="padding:24px 28px">
${boardName ? `<p style="margin:0 0 6px;font-size:12px;color:#737373">${esc(boardName)}</p>` : ""}
<h1 style="margin:0 0 16px;font-size:18px;line-height:1.35;font-weight:600">${esc(headline)}</h1>
<p style="margin:0 0 12px;font-size:14px;line-height:1.5">Hi ${esc(recipientName || "there")},</p>
${excerpt ? `<div style="margin:0 0 20px;padding:12px 14px;border-left:3px solid #d4d4d4;background:#fafafa;font-size:14px;line-height:1.5;color:#404040;white-space:pre-wrap">${esc(excerpt)}</div>` : ""}
${button}
<p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#a3a3a3">You're receiving this because you follow this topic. Turn reply emails off under Discussions &rarr; Reply emails in your members portal.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
