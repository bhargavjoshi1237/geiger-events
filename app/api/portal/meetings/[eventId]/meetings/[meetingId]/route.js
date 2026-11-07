import { cancelMemberMeeting } from "@/lib/portal/meetings";
import { readBody, reply, withMember } from "@/lib/portal/meetings_http";

// Cancel one of the member's own upcoming meetings: { action: "cancel", reason }.
export async function POST(request, { params }) {
  const { eventId, meetingId } = await params;
  return withMember(async (member) => {
    const body = await readBody(request);
    if (body.action !== "cancel") return reply(request, { error: "Unknown action.", status: 400 });
    return reply(request, await cancelMemberMeeting(member, eventId, meetingId, body.reason));
  });
}
