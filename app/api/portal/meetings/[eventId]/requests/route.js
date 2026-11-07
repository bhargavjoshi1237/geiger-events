import { createMeetingRequest } from "@/lib/portal/meetings";
import { readBody, reply, withMember } from "@/lib/portal/meetings_http";

// Send a meeting request: { toMemberId, slots: [{ start, end }], message }.
export async function POST(request, { params }) {
  const { eventId } = await params;
  return withMember(async (member) =>
    reply(request, await createMeetingRequest(member, eventId, await readBody(request))),
  );
}
