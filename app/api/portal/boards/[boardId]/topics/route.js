import { createMemberTopic, withMember } from "@/lib/portal/boards";

export async function POST(request, { params }) {
  const { boardId } = await params;
  const body = await request.json().catch(() => ({}));
  return withMember((member) => createMemberTopic(member, boardId, body));
}
