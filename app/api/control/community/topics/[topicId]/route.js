import { deliverBoardEmails } from "@/lib/portal/boards";
import { topicScope } from "@/lib/control/community/scope";
import { boardView, parseTopicPatch, postView, topicView } from "@/lib/control/community/views";
import { withControl } from "@/lib/control/http";
import { must, readJson } from "@/lib/control/scope";
import { ApiError } from "@/lib/staff_access/errors";

async function detail(db, row) {
  const [board, posts] = await Promise.all([
    db.from("boards").select("*").eq("id", row.board_id).maybeSingle().then((r) => must(r, "community.topicBoard")),
    db
      .from("board_posts")
      .select("*")
      .eq("topic_id", row.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(1000)
      .then((r) => must(r, "community.topicPosts")),
  ]);
  return { topic: topicView(row), board: board ? boardView(board) : null, posts: posts.map(postView) };
}

export async function GET(request, { params }) {
  const { topicId } = await params;
  return withControl(request, async (ctx) => {
    const { db, row } = await topicScope(ctx, topicId);
    return detail(db, row);
  });
}

// PATCH { pinned?, locked?, status?, acceptedPostId? } — the dashboard drawer's topic actions.
export async function PATCH(request, { params }) {
  const { topicId } = await params;
  return withControl(request, async (ctx) => {
    const patch = parseTopicPatch(await readJson(request));
    const { db, row: current } = await topicScope(ctx, topicId);
    if (patch.accepted_post_id) {
      const post = must(
        await db.from("board_posts").select("id").eq("id", patch.accepted_post_id).eq("topic_id", topicId).maybeSingle(),
        "community.acceptPost",
      );
      if (!post) throw new ApiError("not_found", 404, "That reply isn't in this topic.");
    }
    const row = must(await db.from("board_topics").update(patch).eq("id", topicId).select("*").single(), "community.topicUpdate");
    // Approving a held topic sends the emails the database queued for it, as the dashboard does.
    if (current.status === "pending" && row.status === "published") {
      await deliverBoardEmails({ topicId, origin: new URL(request.url).origin }).catch(() => null);
    }
    return detail(db, row);
  });
}

export async function DELETE(request, { params }) {
  const { topicId } = await params;
  return withControl(request, async (ctx) => {
    const { db } = await topicScope(ctx, topicId);
    must(await db.from("board_topics").update({ deleted_at: new Date().toISOString() }).eq("id", topicId), "community.topicDelete");
    return { deleted: true };
  });
}
