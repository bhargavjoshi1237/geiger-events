import { deliverBoardEmails } from "@/lib/portal/boards";
import { postScope } from "@/lib/control/community/scope";
import { parsePostStatus, postView } from "@/lib/control/community/views";
import { withControl } from "@/lib/control/http";
import { must, readJson } from "@/lib/control/scope";

// PATCH { status: "published" | "hidden" } — approve a held reply or hide one; approving sends its queued emails.
export async function PATCH(request, { params }) {
  const { postId } = await params;
  return withControl(request, async (ctx) => {
    const status = parsePostStatus(await readJson(request));
    const { db, row: current } = await postScope(ctx, postId);
    const row = must(await db.from("board_posts").update({ status }).eq("id", postId).select("*").single(), "community.postStatus");
    if (status === "published" && current.status !== "published") {
      await deliverBoardEmails({ topicId: row.topic_id, origin: new URL(request.url).origin }).catch(() => null);
    }
    return { post: postView(row) };
  });
}

export async function DELETE(request, { params }) {
  const { postId } = await params;
  return withControl(request, async (ctx) => {
    const { db } = await postScope(ctx, postId);
    must(await db.from("board_posts").update({ deleted_at: new Date().toISOString() }).eq("id", postId), "community.postDelete");
    return { deleted: true };
  });
}
