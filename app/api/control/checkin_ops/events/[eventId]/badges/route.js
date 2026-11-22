import { BADGE_STATUSES } from "@/lib/control/checkin_ops/constants";
import { badgeCounts, badgeView } from "@/lib/control/checkin_ops/views";
import { withControl } from "@/lib/control/http";
import { CONTROL_CAPABILITIES } from "@/lib/control/profile";
import { eventScope, must } from "@/lib/control/scope";
import { selectAll } from "@/lib/supabase/select_all";

const SHOWN = 300;

// GET ?status=&q= — the event's NFC badges with counts per status; search matches serial, label, UID or holder.
export async function GET(request, { params }) {
  const { eventId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await eventScope(ctx, eventId, CONTROL_CAPABILITIES.checkIn);
    const query = new URL(request.url).searchParams;
    const rows = must(
      await selectAll(
        () =>
          scope.db
            .from("nfc_credentials")
            .select("id,serial,label,nfc_uid,status,active,metadata,notes,issued_at,created_at")
            .eq("event_id", eventId)
            .is("deleted_at", null)
            .order("created_at", { ascending: false })
            .order("id"),
        { max: 20000 },
      ),
      "badges.list",
    );
    const status = query.get("status");
    const q = String(query.get("q") ?? "").trim().toLowerCase().slice(0, 80);
    const badges = rows
      .map(badgeView)
      .filter((b) => !BADGE_STATUSES.includes(status) || b.status === status)
      .filter((b) => !q || [b.serial, b.label, b.uid, b.holderName, b.holderEmail].some((v) => v.toLowerCase().includes(q)));
    return { badges: badges.slice(0, SHOWN), total: badges.length, counts: badgeCounts(rows) };
  });
}
