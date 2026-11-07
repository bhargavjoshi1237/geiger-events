import { deleteMemberPost, updateMemberPost, withMember } from "@/lib/portal/boards";

export async function PATCH(request, { params }) {
  const { postId } = await params;
  const body = await request.json().catch(() => ({}));
  return withMember((member) => updateMemberPost(member, postId, body));
}

export async function DELETE(_request, { params }) {
  const { postId } = await params;
  return withMember((member) => deleteMemberPost(member, postId));
}
