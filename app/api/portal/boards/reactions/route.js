import { toggleMemberReaction, withMember } from "@/lib/portal/boards";

// Toggle an upvote/like on a topic (postId omitted) or a reply.
export async function POST(request) {
  const { topicId, postId, kind } = await request.json().catch(() => ({}));
  return withMember((member) => toggleMemberReaction(member, { topicId, postId: postId || null, kind }));
}
