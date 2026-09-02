import { readFile } from "node:fs/promises";
import path from "node:path";

import { getSessionMember } from "@/lib/portal/session";
import { getMemberOrder } from "@/lib/portal/reads";
import { getQrTicketsConfig } from "@/lib/passes/ticket_qr_settings";
import { qrTicketSvg } from "@/lib/passes/qr_core";

// Inlined as a data: URI — this SVG is served standalone via <img src>, so a
// relative /logo1.svg href would never resolve.
let logoDataUriPromise = null;
function logoDataUri() {
  if (!logoDataUriPromise) {
    logoDataUriPromise = readFile(path.join(process.cwd(), "public", "logo1.svg"))
      .then((buf) => `data:image/svg+xml;base64,${buf.toString("base64")}`)
      .catch((e) => {
        console.error("[portal.qr] logo read failed", e);
        return "";
      });
  }
  return logoDataUriPromise;
}

export async function GET(_request, { params }) {
  const member = await getSessionMember();
  if (!member) return new Response("Not signed in.", { status: 401 });

  const { id } = await params;
  const order = await getMemberOrder(member.email, id);
  if (!order) return new Response("Not found.", { status: 404 });

  const [config, logoHref] = await Promise.all([
    getQrTicketsConfig(order.projectId),
    logoDataUri(),
  ]);

  const svg = qrTicketSvg({
    payload: order.id,
    errorCorrection: config.errorCorrection,
    brandColor: config.brandColor,
    showLogo: config.showLogo,
    logoHref,
    size: 240,
  });

  if (!svg) return new Response("QR unavailable.", { status: 500 });

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "private, max-age=300",
    },
  });
}
