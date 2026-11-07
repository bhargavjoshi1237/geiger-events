import { getMeetingState } from "@/lib/portal/meetings";
import { reply, withMember } from "@/lib/portal/meetings_http";

// The member's networking state for one event: settings, own profile, requests and meetings.
export async function GET(request, { params }) {
  const { eventId } = await params;
  return withMember(async (member) => reply(request, await getMeetingState(member, eventId)));
}
