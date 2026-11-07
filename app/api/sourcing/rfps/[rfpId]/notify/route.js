import { sendNotificationEmail } from "@/lib/email/notifications";
import { RFP_EMAILS, renderRfpEmail, rfpEmailContext } from "@/lib/sourcing/email";
import { isEmail } from "@/lib/sourcing/rfp_model";
import { normalizeRecipient, normalizeRfp } from "@/lib/sourcing/rows";
import { UUID_RE, json, mapLimit, userClient } from "@/lib/sourcing/server";

// After an award: the award notice to the winner and regret notices to every other invited venue.
// Recipients already sent that notice are skipped, so a retry never double-mails.
export async function POST(request, { params }) {
  const { rfpId } = await params;
  if (!UUID_RE.test(rfpId || "")) return json({ error: "Invalid RFP." }, 400);

  const auth = await userClient(request);
  if (!auth) return json({ error: "Sign in to continue." }, 401);
  const { sb } = auth;

  const { data: rfpRow, error } = await sb
    .from("rfps")
    .select("*")
    .eq("id", rfpId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) {
    console.error("[rfp.notify] load", error.message);
    return json({ error: "Couldn't load the RFP." }, 500);
  }
  if (!rfpRow) return json({ error: "RFP not found." }, 404);
  const rfp = normalizeRfp(rfpRow);
  if (rfp.status !== "awarded") return json({ error: "Award the RFP before sending notices." }, 409);

  const [recRes, bidRes, eventRes, projectRes] = await Promise.all([
    sb.from("rfp_recipients").select("*").eq("rfp_id", rfpId).is("deleted_at", null),
    rfp.awardedBidId
      ? sb.from("rfp_bids").select("total").eq("id", rfp.awardedBidId).maybeSingle()
      : Promise.resolve({ data: null }),
    rfp.eventId
      ? sb.from("events").select("name").eq("id", rfp.eventId).maybeSingle()
      : Promise.resolve({ data: null }),
    sb.schema("public").from("projects").select("name").eq("id", rfp.projectId).maybeSingle(),
  ]);
  if (recRes.error) {
    console.error("[rfp.notify] recipients", recRes.error.message);
    return json({ error: "Couldn't load the recipients." }, 500);
  }

  const recipients = (recRes.data || []).map(normalizeRecipient);
  const jobs = [];
  for (const r of recipients) {
    if (!isEmail(r.email) || !r.invitedAt) continue;
    const kind = r.status === "awarded" ? "award" : r.status === "lost" ? "regret" : null;
    if (!kind) continue;
    if (r.emailStatus?.kind === kind && r.emailStatus?.status === "sent") continue;
    jobs.push({ r, kind });
  }

  const eventName = eventRes?.data?.name || "";
  const organizerName = projectRes?.data?.name || "";
  const total = bidRes?.data?.total ?? null;

  const results = await mapLimit(jobs, 4, async ({ r, kind }) => {
    const ctx = rfpEmailContext({ rfp, recipient: r, organizerName, eventName, total: kind === "award" ? total : null });
    const { subject, html } = renderRfpEmail(kind, ctx);
    const { notification, template } = RFP_EMAILS[kind];
    const res = await sendNotificationEmail({
      projectId: rfp.projectId,
      notification,
      template,
      to: r.email,
      subject,
      html,
      data: { rfpTitle: ctx.title, venueName: ctx.venueName },
    });
    const at = new Date().toISOString();
    const emailStatus = {
      kind,
      status: res.ok ? "sent" : res.skipped ? "off" : "failed",
      at,
      ...(res.ok || res.skipped ? {} : { error: String(res.error || "send failed") }),
    };
    await sb.from("rfp_recipients").update({ email_status: emailStatus, last_emailed_at: at }).eq("id", r.id);
    return { recipientId: r.id, name: r.name, kind, emailed: res.ok, emailStatus };
  });

  return json({ ok: true, results });
}
