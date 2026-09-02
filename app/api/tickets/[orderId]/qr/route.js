import { readFile } from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";
import sharp from "sharp";

import { getOrderPublic } from "@/lib/portal/reads";
import { getQrTicketsConfig } from "@/lib/passes/ticket_qr_settings";
import { logoEligible, qrErrorCorrection } from "@/lib/passes/qr_core";

// Unauthenticated by design: this is the image an emailed ticket hotlinks to,
// so it has to render for a recipient who isn't signed in. The order id is
// the bearer secret — same threat model as the "Order ID" QR encoding option
// and the /checkin scanner, both of which already treat a bare order id as
// sufficient to prove possession of the ticket.

const QR_PX = 480;

let logoSvgPromise = null;
function logoSvgBuffer() {
  if (!logoSvgPromise) {
    logoSvgPromise = readFile(path.join(process.cwd(), "public", "logo1.svg")).catch((e) => {
      console.error("[tickets.qr] logo read failed", e);
      return null;
    });
  }
  return logoSvgPromise;
}

async function brandedQrPng({ payload, errorCorrection, brandColor, showLogo }) {
  const ec = qrErrorCorrection(errorCorrection);
  const dark = brandColor || "#111111";

  const qrBuffer = await QRCode.toBuffer(payload, {
    type: "png",
    errorCorrectionLevel: ec,
    margin: 2,
    width: QR_PX,
    color: { dark, light: "#ffffff" },
  });

  if (!showLogo || !logoEligible(ec)) return qrBuffer;

  const logoSvg = await logoSvgBuffer();
  if (!logoSvg) return qrBuffer;

  const plate = Math.round(QR_PX * 0.24);
  const at = Math.round((QR_PX - plate) / 2);
  const logoSize = Math.round(plate * 0.68);
  const logoAt = Math.round((QR_PX - logoSize) / 2);

  const plateSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${plate}" height="${plate}">` +
      `<rect width="100%" height="100%" rx="${Math.round(plate * 0.15)}" fill="${dark}"/></svg>`,
  );

  const [plateBuf, logoBuf] = await Promise.all([
    sharp(plateSvg).png().toBuffer(),
    sharp(logoSvg)
      .resize(logoSize, logoSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer(),
  ]);

  return sharp(qrBuffer)
    .composite([
      { input: plateBuf, left: at, top: at },
      { input: logoBuf, left: logoAt, top: logoAt },
    ])
    .png()
    .toBuffer();
}

export async function GET(_request, { params }) {
  const { orderId } = await params;
  const order = await getOrderPublic(orderId);
  if (!order) return new Response("Not found.", { status: 404 });

  const config = await getQrTicketsConfig(order.projectId);

  let png;
  try {
    png = await brandedQrPng({
      payload: order.id,
      errorCorrection: config.errorCorrection,
      brandColor: config.brandColor,
      showLogo: config.showLogo,
    });
  } catch (e) {
    console.error("[tickets.qr]", e);
    return new Response("QR unavailable.", { status: 500 });
  }

  return new Response(png, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
