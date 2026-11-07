import { after } from "next/server";

import { createMemberPost, deliverBoardEmails, withMember } from "@/lib/portal/boards";

// Reply to a topic; queued reply emails go out after the response is sent.
export async function POST(request, { params }) {
  const { topicId } = await params;
  const body = await request.json().catch(() => ({}));
  const origin = new URL(request.url).origin;
  return withMember(async (member) => {
    const result = await createMemberPost(member, topicId, {
      body: body.body,
      parentPostId: body.parentPostId || null,
    });
    if (result.post && !result.pending) {
      after(() => deliverBoardEmails({ postId: result.post.id, origin }));
    }
    return result;
  });
}
