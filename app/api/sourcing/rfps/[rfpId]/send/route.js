import { sendNotificationEmail } from "@/lib/email/notifications";
import { RFP_EMAILS, renderRfpEmail, rfpEmailContext } from "@/lib/sourcing/email";
import { isEmail, validateRfpForSend } from "@/lib/sourcing/rfp_model";
import { normalizeRecipient, normalizeRfp } from "@/lib/sourcing/rows";
import {
  UUID_RE,
  json,
  mapLimit,
  newLinkToken,
  publicBaseUrl,
  rfpResponseUrl,
  userClient,
} from "@/lib/sourcing/server";

// Emails each recipient a fresh tokenised response link: mode "invite" (default) or "reminder".
// Every send rotates the token, so only the newest link works; the links come back for copying.
export async function POST(request, { params }) {
  const { rfpId } = await params;
  if (!UUID_RE.test(rfpId || "")) return json({ error: "Invalid RFP." }, 400);

  const auth = await userClient(request);
  if (!auth) return json({ error: "Sign in to continue." }, 401);
  const { sb } = auth;

  const body = await request.json().catch(() => ({}));
  const mode = body?.mode === "reminder" ? "reminder" : "invite";
  const ids = Array.isArray(body?.recipientIds) ? body.recipientIds.filter((id) => UUID_RE.test(id)) : null;

  const { data: rfpRow, error: rfpError } = await sb
    .from("rfps")
    .select("*")
    .eq("id", rfpId)
    .is("deleted_at", null)
    .maybeSingle();
  if (rfpError) {
    console.error("[rfp.send] load", rfpError.message);
    return json({ error: "Couldn't load the RFP." }, 500);
  }
  if (!rfpRow) return json({ error: "RFP not found." }, 404);
  const rfp = normalizeRfp(rfpRow);
  if (!["draft", "sent"].includes(rfp.status)) {
    return json({ error: "This RFP is no longer taking proposals." }, 409);
  }
  const issues = validateRfpForSend(rfp, Date.now());
  if (issues.length) return json({ error: issues[0], issues }, 422);

  const base = publicBaseUrl(request);
  if (!base) return json({ error: "The app's public URL isn't configured, so links can't be built." }, 500);

  const { data: recRows, error: recError } = await sb
    .from("rfp_recipients")
    .select("*")
    .eq("rfp_id", rfpId)
    .is("deleted_at", null);
  if (recError) {
    console.error("[rfp.send] recipients", recError.message);
    return json({ error: "Couldn't load the recipients." }, 500);
  }

  let targets = (recRows || []).map(normalizeRecipient);
  if (ids) targets = targets.filter((r) => ids.includes(r.id));
  targets =
    mode === "reminder"
      ? targets.filter((r) => r.invitedAt && ["invited", "viewed"].includes(r.status))
      : targets.filter((r) => !["awarded", "lost"].includes(r.status) && (ids ? true : !r.invitedAt));
  const skipped = targets.filter((r) => !isEmail(r.email)).map((r) => ({ recipientId: r.id, name: r.name }));
  targets = targets.filter((r) => isEmail(r.email)).slice(0, 100);
  if (!targets.length) {
    return json(
      {
        error: skipped.length
          ? "None of the selected recipients has a valid email address."
          : mode === "reminder"
            ? "Everyone has already responded or declined."
            : "Everyone on the list has already been invited.",
        results: [],
        skipped,
      },
      422,
    );
  }

  // The link only resolves once the RFP is out, so flip it before any email leaves.
  if (rfp.status === "draft") {
    const { error } = await sb
      .from("rfps")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", rfpId);
    if (error) {
      console.error("[rfp.send] status", error.message);
      return json({ error: "Couldn't mark the RFP as sent." }, 500);
    }
  }

  const [eventRes, projectRes] = await Promise.all([
    rfp.eventId
      ? sb.from("events").select("name").eq("id", rfp.eventId).maybeSingle()
      : Promise.resolve({ data: null }),
    sb.schema("public").from("projects").select("name").eq("id", rfp.projectId).maybeSingle(),
  ]);
  const eventName = eventRes?.data?.name || "";
  const organizerName = projectRes?.data?.name || "";
  const kind = mode === "reminder" ? "reminder" : "invitation";
  const { notification, template } = RFP_EMAILS[kind];

  const results = await mapLimit(targets, 4, async (r) => {
    const { token, tokenHash } = newLinkToken();
    const at = new Date().toISOString();
    const patch = { token_hash: tokenHash, last_emailed_at: at };
    if (!r.invitedAt) patch.invited_at = at;
    const { error: linkError } = await sb.from("rfp_recipients").update(patch).eq("id", r.id);
    if (linkError) {
      console.error("[rfp.send] link", linkError.message);
      return { recipientId: r.id, name: r.name, email: r.email, url: null, emailed: false, error: "Couldn't create a link." };
    }
    const url = rfpResponseUrl(base, token);
    const ctx = rfpEmailContext({ rfp, recipient: r, organizerName, eventName, url });
    const { subject, html } = renderRfpEmail(kind, ctx);
    const res = await sendNotificationEmail({
      projectId: rfp.projectId,
      notification,
      template,
      to: r.email,
      subject,
      html,
      data: { rfpTitle: ctx.title, venueName: ctx.venueName, responseUrl: url, deadline: ctx.deadline },
    });
    const emailStatus = {
      kind,
      status: res.ok ? "sent" : res.skipped ? "off" : "failed",
      at,
      ...(res.ok || res.skipped ? {} : { error: String(res.error || "send failed") }),
    };
    await sb.from("rfp_recipients").update({ email_status: emailStatus }).eq("id", r.id);
    return { recipientId: r.id, name: r.name, email: r.email, url, emailed: res.ok, emailStatus };
  });

  return json({ ok: true, status: "sent", mode, results, skipped });
}
