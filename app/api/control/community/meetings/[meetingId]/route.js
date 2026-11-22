import { after } from "next/server";

import { meetingScope } from "@/lib/control/community/scope";
import { buildPeople, meetingView, parseMeetingPatch } from "@/lib/control/community/views";
import { withControl } from "@/lib/control/http";
import { must, readJson } from "@/lib/control/scope";
import { publicBaseUrl, runMeetingNotice } from "@/lib/meetings/notify";

// PATCH { status?, cancelReason?, notes? } — mark completed or no-show, cancel, restore or annotate a meeting.
// Cancelling emails both attendees, exactly as the dashboard's cancel does.
export async function PATCH(request, { params }) {
  const { meetingId } = await params;
  return withControl(request, async (ctx) => {
    const patch = parseMeetingPatch(await readJson(request));
    const { db, row: current } = await meetingScope(ctx, meetingId);
    const row = must(await db.from("meetings").update(patch).eq("id", meetingId).select("*").single(), "community.meetingUpdate");
    if (patch.status === "cancelled" && current.status !== "cancelled") {
      const baseUrl = publicBaseUrl(request);
      after(() => runMeetingNotice({ kind: "meeting_cancelled", meetingId }, { baseUrl }));
    }
    const ids = Array.isArray(row.participants) ? row.participants : [];
    const [attendees, profiles] = await Promise.all([
      db.rpc("meeting_attendees", { p_event: row.event_id }).then((r) => must(r, "community.meetingAttendees")),
      ids.length
        ? db
            .from("meeting_profiles")
            .select("member_id,display_name,email")
            .eq("event_id", row.event_id)
            .in("member_id", ids)
            .then((r) => must(r, "community.meetingPeople"))
        : [],
    ]);
    return { meeting: meetingView(row, buildPeople(attendees || [], profiles)) };
  });
}
