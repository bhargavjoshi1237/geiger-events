import { setMemberSubscription, withMember } from "@/lib/portal/boards";

export async function POST(request, { params }) {
  const { topicId } = await params;
  const { on } = await request.json().catch(() => ({}));
  return withMember((member) => setMemberSubscription(member, topicId, Boolean(on)));
}
