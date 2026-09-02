// Server-only: resolve the project's QR Tickets appearance config
// (events.checkin_settings.config.qrTickets) for the ticket-QR routes.
// Not "use client" — this runs in Route Handlers via the admin client.

import { adminClient } from "@/lib/supabase/admin";

// Mirrors defaultQrTickets() in components/internal/screens/checkin/constants.js.
// Duplicated (not imported) because that module chain pulls in "use client"
// files not meant for a Route Handler's server bundle.
function defaultQrTickets() {
  return {
    size: "medium",
    errorCorrection: "M",
    encode: "ticketCode",
    dynamic: false,
    showLogo: true,
    brandColor: "",
  };
}

export async function getQrTicketsConfig(projectId) {
  if (!projectId) return defaultQrTickets();
  const sb = adminClient();
  if (!sb) return defaultQrTickets();
  try {
    const { data, error } = await sb
      .from("checkin_settings")
      .select("config")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) {
      console.error("[ticket_qr_settings]", error.message);
      return defaultQrTickets();
    }
    return { ...defaultQrTickets(), ...(data?.config?.qrTickets || {}) };
  } catch (e) {
    console.error("[ticket_qr_settings]", e);
    return defaultQrTickets();
  }
}
