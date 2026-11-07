import { listDirectory } from "@/lib/portal/meetings";
import { reply, withMember } from "@/lib/portal/meetings_http";

// The attendee directory this member may see and request.
export async function GET(request, { params }) {
  const { eventId } = await params;
  return withMember(async (member) => reply(request, await listDirectory(member, eventId)));
}
