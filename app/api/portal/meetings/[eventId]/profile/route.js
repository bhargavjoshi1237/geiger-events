import { saveMeetingProfile } from "@/lib/portal/meetings";
import { readBody, reply, withMember } from "@/lib/portal/meetings_http";

// Opt in/out and save the member's networking profile.
export async function POST(request, { params }) {
  const { eventId } = await params;
  return withMember(async (member) =>
    reply(request, await saveMeetingProfile(member, eventId, await readBody(request))),
  );
}
