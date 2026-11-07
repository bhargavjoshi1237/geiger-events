import { reportMemberContent, withMember } from "@/lib/portal/boards";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  return withMember((member) =>
    reportMemberContent(member, {
      topicId: body.topicId,
      postId: body.postId || null,
      reason: body.reason,
      details: body.details,
    }),
  );
}
