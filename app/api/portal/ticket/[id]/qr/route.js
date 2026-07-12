import QRCode from "qrcode";
import { getSessionMember } from "@/lib/portal/session";
import { getMemberOrder } from "@/lib/portal/reads";

// GET /api/portal/ticket/<orderId>/qr — a scannable QR (image/svg+xml) encoding
// the order id, scoped to the signed-in member who owns that order. The door
// scanner (jsQR) reads the order id out of it.
export async function GET(_request, { params }) {
  const member = await getSessionMember();
  if (!member) return new Response("Not signed in.", { status: 401 });

  const { id } = await params;
  const order = await getMemberOrder(member.email, id);
  if (!order) return new Response("Not found.", { status: 404 });

  let svg;
  try {
    svg = await QRCode.toString(order.id, {
      type: "svg",
      margin: 1,
      width: 240,
      errorCorrectionLevel: "M",
      color: { dark: "#111111", light: "#ffffff" },
    });
  } catch (e) {
    console.error("[portal.qr]", e);
    return new Response("QR unavailable.", { status: 500 });
  }

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "private, max-age=300",
    },
  });
}
