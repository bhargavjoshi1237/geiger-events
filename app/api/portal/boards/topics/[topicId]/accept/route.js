import { acceptMemberAnswer, withMember } from "@/lib/portal/boards";

// Topic author marks (or clears, by sending the same id again) the accepted answer on a Q&A board.
export async function POST(request, { params }) {
  const { topicId } = await params;
  const { postId } = await request.json().catch(() => ({}));
  return withMember((member) => acceptMemberAnswer(member, topicId, postId || null));
}
