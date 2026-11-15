// Event-branded portal emails, rendered here and sent through the suite email API as pre-built HTML.
const escape = (text) => String(text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const safeColor = (value) => (/^#[0-9a-f]{3,8}$/i.test(value ?? "") ? value : "#111827");

export function emailLayout({ event, brand, title, body }) {
  const color = safeColor(brand);
  return `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e4e4e7;border-radius:12px">
<tr><td style="padding:24px 28px 0;font-size:13px;color:#52525b">${escape(event)}</td></tr>
<tr><td style="padding:8px 28px 0;font-size:20px;font-weight:600;line-height:1.3">${escape(title)}</td></tr>
<tr><td style="padding:16px 28px 28px;font-size:15px;line-height:1.55">${body.replaceAll("{{color}}", color)}</td></tr>
</table>
<p style="font-size:12px;color:#71717a;margin:16px 0 0">Sent for ${escape(event)}. If you weren't expecting this, you can ignore it.</p>
</td></tr></table></body></html>`;
}

export function inviteEmail({ event, brand, name, url, welcome }) {
  return {
    subject: `You're invited to ${event}`,
    html: emailLayout({
      event, brand, title: `You're invited to ${event}`,
      body: `<p style="margin:0 0 12px">Hi ${escape(name || "there")},</p>
<p style="margin:0 0 12px">${escape(welcome || `The organisers of ${event} have given you access to their portal.`)}</p>
<p style="margin:20px 0"><a href="${escape(url)}" style="display:inline-block;background:{{color}};color:#ffffff;text-decoration:none;padding:11px 18px;border-radius:8px;font-weight:600">Open the portal</a></p>
<p style="margin:0;font-size:13px;color:#52525b">This link signs you in and works once, for 7 days. You can always ask for a sign-in code from the portal instead.</p>`,
    }),
  };
}

export function codeEmail({ event, brand, code }) {
  return {
    subject: `${code} is your sign-in code for ${event}`,
    html: emailLayout({
      event, brand, title: "Your sign-in code",
      body: `<p style="margin:0 0 16px">Enter this code to sign in to the ${escape(event)} portal:</p>
<p style="margin:0 0 16px;font-size:30px;font-weight:700;letter-spacing:6px;color:{{color}}">${escape(code)}</p>
<p style="margin:0;font-size:13px;color:#52525b">It expires in 10 minutes and can be used once.</p>`,
    }),
  };
}
