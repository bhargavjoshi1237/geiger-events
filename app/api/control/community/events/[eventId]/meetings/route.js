import { COMMUNITY_KEY } from "@/lib/control/community/scope";
import { buildPeople, meetingView, requestView } from "@/lib/control/community/views";
import { withControl } from "@/lib/control/http";
import { eventScope, must } from "@/lib/control/scope";

// GET — an event's booked meetings and meeting requests, with each person named as the dashboard names them.
export async function GET(request, { params }) {
  const { eventId } = await params;
  return withControl(request, async (ctx) => {
    const { db } = await eventScope(ctx, eventId, COMMUNITY_KEY);
    const [meetings, requests, profiles, attendees] = await Promise.all([
      db
        .from("meetings")
        .select("*")
        .eq("event_id", eventId)
        .is("deleted_at", null)
        .order("starts_at", { ascending: true })
        .limit(1000)
        .then((r) => must(r, "community.meetings")),
      db
        .from("meeting_requests")
        .select("*")
        .eq("event_id", eventId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1000)
        .then((r) => must(r, "community.requests")),
      db
        .from("meeting_profiles")
        .select("member_id,display_name,email")
        .eq("event_id", eventId)
        .is("deleted_at", null)
        .limit(5000)
        .then((r) => must(r, "community.profiles")),
      db.rpc("meeting_attendees", { p_event: eventId }).then((r) => must(r, "community.attendees")),
    ]);
    const people = buildPeople(attendees || [], profiles);
    return {
      meetings: meetings.map((m) => meetingView(m, people)),
      requests: requests.map((r) => requestView(r, people)),
    };
  });
}
