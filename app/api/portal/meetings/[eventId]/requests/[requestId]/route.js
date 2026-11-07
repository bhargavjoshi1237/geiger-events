import { respondToRequest } from "@/lib/portal/meetings";
import { readBody, reply, withMember } from "@/lib/portal/meetings_http";

// Answer or withdraw a request: { action: "accept", start, end } | { action: "decline", note } | { action: "cancel" }.
export async function POST(request, { params }) {
  const { eventId, requestId } = await params;
  return withMember(async (member) =>
    reply(request, await respondToRequest(member, eventId, requestId, await readBody(request))),
  );
}
