import {
  deleteMemberTopic,
  getTopicForMember,
  updateMemberTopic,
  withMember,
} from "@/lib/portal/boards";

export async function GET(_request, { params }) {
  const { topicId } = await params;
  return withMember((member) => getTopicForMember(member, topicId));
}

export async function PATCH(request, { params }) {
  const { topicId } = await params;
  const body = await request.json().catch(() => ({}));
  return withMember((member) => updateMemberTopic(member, topicId, body));
}

export async function DELETE(_request, { params }) {
  const { topicId } = await params;
  return withMember((member) => deleteMemberTopic(member, topicId));
}
