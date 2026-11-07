import { slotsWith } from "@/lib/portal/meetings";
import { reply, withMember } from "@/lib/portal/meetings_http";

// Times that are free for both the member and ?with=<memberId>.
export async function GET(request, { params }) {
  const { eventId } = await params;
  const other = new URL(request.url).searchParams.get("with");
  return withMember(async (member) => reply(request, await slotsWith(member, eventId, other)));
}
